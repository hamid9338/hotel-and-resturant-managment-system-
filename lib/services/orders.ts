import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { getSettings } from "@/lib/services/settings";
import { recordAudit } from "@/lib/services/audit";
import { round2, toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type { createOrderSchema, updateOrderStatusSchema, billOrderSchema } from "@/lib/validation/restaurant";

type CreateOrderInput = z.infer<typeof createOrderSchema>;
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
type BillOrderInput = z.infer<typeof billOrderSchema>;

const orderInclude = {
  items: { include: { menuItem: true } },
  table: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export async function createOrder(
  session: SessionUser,
  input: CreateOrderInput,
  opts?: { id?: string }
) {
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: input.items.map((i) => i.menuItemId) } },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  for (const line of input.items) {
    const item = byId.get(line.menuItemId);
    if (!item) throw new AppError("MENU_ITEM_NOT_FOUND", "One of the selected menu items no longer exists.", 404);
    if (!item.available) throw new AppError("MENU_ITEM_UNAVAILABLE", `${item.name} is currently unavailable.`, 409);
  }

  const subtotal = round2(
    input.items.reduce((sum, line) => sum + toNumber(byId.get(line.menuItemId)!.price) * line.qty, 0)
  );
  const settings = await getSettings();
  const taxAmount = round2((subtotal * toNumber(settings.taxRatePct)) / 100);
  const total = round2(subtotal + taxAmount);

  let bookingId: string | null = null;
  if (input.orderType === "ROOM_SERVICE" && input.roomId) {
    const activeBooking = await prisma.booking.findFirst({
      where: { roomId: input.roomId, status: "CHECKED_IN" },
    });
    if (!activeBooking) {
      throw new AppError("NO_ACTIVE_STAY", "This room has no active check-in to bill room service to.", 409);
    }
    bookingId = activeBooking.id;
  }

  const order = await prisma.restaurantOrder.create({
    data: {
      // See the matching comment in lib/services/bookings.ts createBooking().
      id: opts?.id,
      orderType: input.orderType,
      tableId: input.orderType === "DINE_IN" ? input.tableId : null,
      bookingId,
      subtotal,
      taxAmount,
      total,
      status: "PENDING",
      notes: input.notes,
      createdById: session.id,
      items: {
        create: input.items.map((line) => {
          const item = byId.get(line.menuItemId)!;
          return {
            menuItemId: item.id,
            nameSnapshot: item.name,
            priceSnapshot: item.price,
            qty: line.qty,
            notes: line.notes,
          };
        }),
      },
    },
    include: orderInclude,
  });

  if (order.tableId) {
    await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "occupied" } });
  }

  await recordAudit({
    session,
    action: `Order placed: ${order.table?.label ?? input.orderType} — ${total}`,
    module: "Restaurant",
    entityType: "RestaurantOrder",
    entityId: order.id,
    details: `${input.items.length} item(s)`,
  });

  return order;
}

export async function listOrders(filters: { status?: string; tableId?: string; date?: string }) {
  return prisma.restaurantOrder.findMany({
    where: {
      status: filters.status ? (filters.status as never) : undefined,
      tableId: filters.tableId || undefined,
      createdAt: filters.date
        ? { gte: new Date(`${filters.date}T00:00:00`), lt: new Date(`${filters.date}T23:59:59.999`) }
        : undefined,
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// BILLED is deliberately excluded here — it has its own endpoint (billOrder)
// because settling a bill also has to create a Payment row and set
// paymentStatus/paymentMethod/billedAt together. Allowing this endpoint to
// set status="BILLED" directly would leave an order that *looks* billed with
// no payment trail at all. CANCELLED/BILLED are terminal: nothing transitions
// out of them here.
const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["CANCELLED"],
  BILLED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(session: SessionUser, orderId: string, input: UpdateOrderStatusInput) {
  const order = await prisma.restaurantOrder.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new AppError("ORDER_NOT_FOUND", "Order not found.", 404);

  if (input.status === "BILLED") {
    throw new AppError(
      "USE_BILL_ENDPOINT",
      "Use the bill action to settle an order — it also records the payment.",
      400
    );
  }
  const allowedNext = VALID_ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowedNext.includes(input.status)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move an order from ${order.status} to ${input.status}.`, 409);
  }

  const updated = await prisma.restaurantOrder.update({
    where: { id: orderId },
    data: { status: input.status },
    include: orderInclude,
  });

  if (input.status === "CANCELLED" && order.tableId) {
    const stillOpen = await prisma.restaurantOrder.count({
      where: { tableId: order.tableId, status: { notIn: ["BILLED", "CANCELLED"] } },
    });
    if (stillOpen === 0) {
      await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "available" } });
    }
  }

  await recordAudit({
    session,
    action: `Order #${order.id.slice(0, 8)} → ${input.status}`,
    module: "Restaurant",
    entityType: "RestaurantOrder",
    entityId: order.id,
    riskLevel: input.status === "CANCELLED" ? "MEDIUM" : "NONE",
  });

  return updated;
}

export async function billOrder(session: SessionUser, orderId: string, input: BillOrderInput) {
  const order = await prisma.restaurantOrder.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new AppError("ORDER_NOT_FOUND", "Order not found.", 404);
  if (order.status === "BILLED" || order.status === "CANCELLED") {
    throw new AppError("INVALID_ORDER_STATE", "This order is already settled or cancelled.", 409);
  }

  const [updated] = await prisma.$transaction([
    prisma.restaurantOrder.update({
      where: { id: orderId },
      data: {
        status: "BILLED",
        paymentStatus: "PAID",
        paymentMethod: input.paymentMethod,
        billedAt: new Date(),
      },
      include: orderInclude,
    }),
    prisma.payment.create({
      data: {
        orderId,
        amount: order.total,
        method: input.paymentMethod,
        receivedById: session.id,
      },
    }),
  ]);

  if (order.tableId) {
    const stillOpen = await prisma.restaurantOrder.count({
      where: { tableId: order.tableId, status: { notIn: ["BILLED", "CANCELLED"] } },
    });
    if (stillOpen === 0) {
      await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: "available" } });
    }
  }

  await recordAudit({
    session,
    action: `Bill settled: ${order.table?.label ?? order.orderType} — ${toNumber(order.total)}`,
    module: "Restaurant",
    entityType: "RestaurantOrder",
    entityId: order.id,
    details: input.paymentMethod,
  });

  return updated;
}

/** Surfaced on the checkout screen so front desk doesn't miss an unpaid room-service tab. */
export async function getUnbilledRoomServiceOrders(bookingId: string) {
  const orders = await prisma.restaurantOrder.findMany({
    where: { bookingId, paymentStatus: { not: "PAID" }, status: { not: "CANCELLED" } },
    include: orderInclude,
  });
  const total = round2(orders.reduce((sum, o) => sum + toNumber(o.total), 0));
  return { orders, total };
}
