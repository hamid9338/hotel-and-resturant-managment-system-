import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { getSettings } from "@/lib/services/settings";
import { recordAudit, recordAlert } from "@/lib/services/audit";
import { recordStockMovement } from "@/lib/services/inventory";
import { round2, toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type {
  createOrderSchema,
  updateOrderStatusSchema,
  billOrderSchema,
  updateKitchenItemStatusSchema,
  refundOrderSchema,
} from "@/lib/validation/restaurant";

type CreateOrderInput = z.infer<typeof createOrderSchema>;
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
type BillOrderInput = z.infer<typeof billOrderSchema>;
type UpdateKitchenItemStatusInput = z.infer<typeof updateKitchenItemStatusSchema>;
type RefundOrderInput = z.infer<typeof refundOrderSchema>;

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
            status: "QUEUED" as const,
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

  // Split-by-payment-method billing must sum to exactly the total — unlike
  // booking checkout, an order has no partial-payment concept.
  const paidSum = round2(input.payments.reduce((sum, p) => sum + p.amount, 0));
  const orderTotal = round2(toNumber(order.total));
  if (paidSum !== orderTotal) {
    throw new AppError("AMOUNT_MISMATCH", `Payments total ${paidSum} but the bill is ${orderTotal}.`, 422);
  }
  // RestaurantOrder.paymentMethod stays a best-effort single label (the
  // largest entry) for the existing badge/list views; the payments[] rows
  // (via the Payment relation) are the authoritative record.
  const primaryMethod = input.payments.reduce((largest, p) => (p.amount > largest.amount ? p : largest)).method;

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic claim of the next invoice number — the increment happens first
    // and its returned row is what THIS transaction claimed, so concurrent
    // settlements never race onto the same number.
    const settingsAfter = await tx.systemSetting.update({
      where: { id: 1 },
      data: { invoiceNextSeq: { increment: 1 } },
    });
    const invoiceNo = `${settingsAfter.invoicePrefix}-${settingsAfter.invoiceNextSeq - 1}`;

    const result = await tx.restaurantOrder.update({
      where: { id: orderId },
      data: {
        status: "BILLED",
        paymentStatus: "PAID",
        paymentMethod: primaryMethod,
        billedAt: new Date(),
        invoiceNo,
      },
      include: orderInclude,
    });

    for (const p of input.payments) {
      await tx.payment.create({
        data: { orderId, amount: p.amount, method: p.method, receivedById: session.id },
      });
    }

    // Recipe-based stock deduction happens at bill time, not order creation
    // (an order can still be cancelled before then) — this is the point the
    // food is definitively consumed. Items with no recipe lines defined
    // simply produce zero movements.
    for (const line of order.items) {
      const recipeLines = await tx.recipeItem.findMany({ where: { menuItemId: line.menuItemId } });
      for (const recipe of recipeLines) {
        await recordStockMovement(tx, {
          inventoryItemId: recipe.inventoryItemId,
          quantityDelta: -(toNumber(recipe.quantityUsed) * line.qty),
          source: "RECIPE_DEDUCTION",
          relatedId: order.id,
          createdById: session.id,
        });
      }
    }

    return result;
    // Default interactive-transaction timeout is 5s — too tight once this
    // does a variable number of sequential writes (N payments + recipe
    // deduction per item) on top of a cold-starting serverless connection.
  }, { timeout: 15_000 });

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
    action: `Bill settled: ${order.table?.label ?? order.orderType} — ${orderTotal}`,
    module: "Restaurant",
    entityType: "RestaurantOrder",
    entityId: order.id,
    details: input.payments.map((p) => `${p.method} ${p.amount}`).join(", "),
  });

  return updated;
}

/**
 * Refunds are rarer/more anomalous than a routine discount, so unlike the
 * discount tiering (only ≥5%/≥15% raise a flag), a refund is always HIGH-risk
 * audit + always an alert. Payment.reference (unused elsewhere in M1) holds
 * the required reason text.
 */
export async function refundOrderPayment(session: SessionUser, orderId: string, input: RefundOrderInput) {
  const order = await prisma.restaurantOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("ORDER_NOT_FOUND", "Order not found.", 404);
  if (order.status !== "BILLED") {
    throw new AppError("INVALID_ORDER_STATE", "Only a billed order can be refunded.", 409);
  }

  const [{ _sum: paidAgg }, { _sum: refundedAgg }] = await Promise.all([
    prisma.payment.aggregate({ where: { orderId, direction: "IN" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { orderId, direction: "OUT" }, _sum: { amount: true } }),
  ]);
  const netCollected = round2(toNumber(paidAgg.amount) - toNumber(refundedAgg.amount));
  if (input.amount > netCollected) {
    throw new AppError("REFUND_EXCEEDS_COLLECTED", `Cannot refund more than the ${netCollected} collected so far.`, 422);
  }

  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount: input.amount,
      method: input.method,
      direction: "OUT",
      reference: input.reason,
      receivedById: session.id,
    },
  });

  await recordAudit({
    session,
    action: `Refund issued: Order #${order.id.slice(0, 8)} — ${input.amount}`,
    module: "Restaurant",
    entityType: "RestaurantOrder",
    entityId: order.id,
    riskLevel: "HIGH",
    details: input.reason,
  });

  await recordAlert({
    type: "refund",
    message: `${session.name} refunded ${input.amount} on order #${order.id.slice(0, 8)}`,
    detail: input.reason,
    severity: "HIGH",
    userId: session.id,
    entityId: order.id,
  });

  return payment;
}

// Any item COOKING pulls the order to PREPARING; all READY pulls it to READY;
// all SERVED pulls it to SERVED. BILL/CANCEL stay explicit human actions on
// their own endpoints — those are real decisions (settling money, voiding),
// not states the system can infer from item progress. Pure function so it's
// unit-testable without a DB, alongside lib/money.ts's tests.
export function deriveOrderStatusFromItems(
  items: { status: string | null }[],
  currentStatus: string
): string {
  if (currentStatus === "BILLED" || currentStatus === "CANCELLED") return currentStatus;
  if (items.length === 0) return currentStatus;
  if (items.every((i) => i.status === "SERVED")) return "SERVED";
  if (items.every((i) => i.status === "READY" || i.status === "SERVED")) return "READY";
  if (items.some((i) => i.status === "COOKING" || i.status === "READY" || i.status === "SERVED")) return "PREPARING";
  return currentStatus;
}

export async function updateOrderItemStatus(
  session: SessionUser,
  orderId: string,
  itemId: string,
  input: UpdateKitchenItemStatusInput
) {
  const order = await prisma.restaurantOrder.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new AppError("ORDER_NOT_FOUND", "Order not found.", 404);
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new AppError("ORDER_ITEM_NOT_FOUND", "Order item not found.", 404);
  if (order.status === "BILLED" || order.status === "CANCELLED") {
    throw new AppError("INVALID_ORDER_STATE", "Cannot update items on a settled or cancelled order.", 409);
  }

  const updatedItems = order.items.map((i) => (i.id === itemId ? { ...i, status: input.status } : i));
  const derivedOrderStatus = deriveOrderStatusFromItems(updatedItems, order.status);

  const [, updatedOrder] = await prisma.$transaction([
    prisma.orderItem.update({ where: { id: itemId }, data: { status: input.status } }),
    prisma.restaurantOrder.update({
      where: { id: orderId },
      data: { status: derivedOrderStatus as never },
      include: orderInclude,
    }),
  ]);

  return updatedOrder;
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
