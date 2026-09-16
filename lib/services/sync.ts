import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import type { Prisma } from "@prisma/client";
import { requirePermission, ForbiddenError } from "@/lib/auth/permissions";
import { createBooking, checkInBooking, checkOutBooking } from "@/lib/services/bookings";
import { createOrder, addOrderItems, updateOrderStatus } from "@/lib/services/orders";
import { updateRoomStatus } from "@/lib/services/rooms";
import { createPurchaseOrder } from "@/lib/services/purchase-orders";
import { createExpense } from "@/lib/services/expenses";
import { adjustStock } from "@/lib/services/inventory";
import { createBookingSchema, checkoutSchema, roomStatusSchema } from "@/lib/validation/hotel";
import { createOrderSchema, addOrderItemsSchema, updateOrderStatusSchema } from "@/lib/validation/restaurant";
import { createPurchaseOrderSchema } from "@/lib/validation/purchasing";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { adjustStockSchema } from "@/lib/validation/inventory";
import type { SessionUser } from "@/lib/auth/session";
import type { SyncOperationInput } from "@/lib/validation/sync";

export type SyncResult =
  | { id: string; status: "applied"; entityId?: string }
  | { id: string; status: "duplicate"; entityId?: string }
  | { id: string; status: "conflict"; reason: string }
  | { id: string; status: "rejected"; reason: string };

/**
 * Dispatches ONE queued offline operation through the exact same service
 * functions the online routes call — so Q4's double-booking guarantee, for
 * example, covers an offline-queued reservation automatically, with no
 * separate business logic to keep in sync.
 *
 * Conflict detection here is intentionally coarse: a create/transition that
 * fails its normal business-rule check (room no longer available, booking
 * already in a different state) comes back as `conflict` for a human to
 * review — this is last-write-wins-with-a-visible-flag, not field-level
 * merge.
 */
export async function applySyncOperation(session: SessionUser, op: SyncOperationInput): Promise<SyncResult> {
  const existing = await prisma.syncOperation.findUnique({ where: { id: op.id } });
  if (existing?.status === "APPLIED") {
    return { id: op.id, status: "duplicate", entityId: existing.entityId ?? undefined };
  }

  await prisma.syncOperation.upsert({
    where: { id: op.id },
    update: { status: "PENDING" },
    create: {
      id: op.id,
      deviceId: op.deviceId,
      userId: session.id,
      operationKind: op.operationKind,
      entityId: op.entityId,
      payload: op.payload as Prisma.InputJsonValue,
      clientTimestamp: new Date(op.clientTimestamp),
      status: "PENDING",
    },
  });

  try {
    const entityId = await dispatch(session, op);
    await prisma.syncOperation.update({
      where: { id: op.id },
      data: { status: "APPLIED", entityId, serverAppliedAt: new Date() },
    });
    return { id: op.id, status: "applied", entityId };
  } catch (err) {
    const reason =
      err instanceof AppError || err instanceof ForbiddenError
        ? err.message
        : "This action could not be completed.";
    const isConflict = err instanceof AppError && err.status === 409;
    await prisma.syncOperation.update({
      where: { id: op.id },
      data: { status: isConflict ? "CONFLICT" : "FAILED", conflictReason: reason },
    });
    return isConflict ? { id: op.id, status: "conflict", reason } : { id: op.id, status: "rejected", reason };
  }
}

// createBooking/checkInBooking/checkOutBooking/createOrder/updateOrderStatus/
// createPurchaseOrder/createExpense/adjustStock all trust their caller to
// have already checked permissions — that's the online route handler's job
// for the online path. This dispatcher IS the caller for the offline path,
// so it must repeat each route's exact requirePermission() call itself;
// skipping it would let any authenticated device bypass RBAC for every
// whitelisted offline operation kind. updateRoomStatus is the one exception:
// it enforces its own role-based transition table internally (see
// lib/services/rooms.ts), so no separate check is needed here for it.
async function dispatch(session: SessionUser, op: SyncOperationInput): Promise<string | undefined> {
  switch (op.operationKind) {
    case "bookings.create": {
      await requirePermission(session, "hotel.create_booking");
      const input = createBookingSchema.parse(op.payload);
      const booking = await createBooking(session, input, { id: op.entityId });
      return booking.id;
    }
    case "bookings.checkin": {
      await requirePermission(session, "hotel.checkin");
      const { bookingId } = op.payload as { bookingId: string };
      const booking = await checkInBooking(session, String(bookingId));
      return booking.id;
    }
    case "bookings.checkout": {
      await requirePermission(session, "hotel.checkout");
      const { bookingId, ...rest } = op.payload as { bookingId: string } & Record<string, unknown>;
      const input = checkoutSchema.parse(rest);
      const booking = await checkOutBooking(session, String(bookingId), input);
      return booking.id;
    }
    case "orders.create": {
      await requirePermission(session, "restaurant.create_order");
      const input = createOrderSchema.parse(op.payload);
      const order = await createOrder(session, input, { id: op.entityId });
      return order.id;
    }
    case "orders.addItems": {
      await requirePermission(session, "restaurant.create_order");
      // orderId travels inside the payload rather than as op.entityId — see
      // the matching comment on inventory.adjustStock just below. op.entityId
      // is this queued operation's own idempotency key; reusing the order's
      // id there would make a second offline add-items call against the same
      // order collide with the first's dedup record.
      const { orderId, ...rest } = op.payload as { orderId: string } & Record<string, unknown>;
      const input = addOrderItemsSchema.parse(rest);
      const order = await addOrderItems(session, String(orderId), input);
      return order.id;
    }
    case "orders.updateStatus": {
      await requirePermission(session, "restaurant.update_order_status");
      const { orderId, ...rest } = op.payload as { orderId: string } & Record<string, unknown>;
      const input = updateOrderStatusSchema.parse(rest);
      // Mirrors the online route's two-tier check: cancelling needs a second,
      // higher-bar permission on top of the general update permission.
      if (input.status === "CANCELLED") {
        await requirePermission(session, "restaurant.cancel_order");
      }
      const order = await updateOrderStatus(session, String(orderId), input);
      return order.id;
    }
    case "rooms.updateStatus": {
      const { roomId, status } = op.payload as { roomId: string; status: string };
      const input = roomStatusSchema.parse({ status });
      const room = await updateRoomStatus(session, String(roomId), input.status);
      return room.id;
    }
    case "purchaseOrders.create": {
      await requirePermission(session, "inventory.manage");
      const input = createPurchaseOrderSchema.parse(op.payload);
      const po = await createPurchaseOrder(session, input, { id: op.entityId });
      return po.id;
    }
    case "expenses.create": {
      await requirePermission(session, "finance.log_expense");
      const input = createExpenseSchema.parse(op.payload);
      const expense = await createExpense(session, input, { id: op.entityId });
      return expense.id;
    }
    case "inventory.adjustStock": {
      await requirePermission(session, "inventory.adjust_stock");
      // The target item's id travels inside the payload, not op.entityId —
      // see the matching comment in components/inventory/inventory-item-modal.tsx:
      // entityId is this queued operation's own idempotency key, and reusing
      // the item's id there would make a second offline adjustment to the
      // same item collide with the first's dedup record.
      const { inventoryItemId, ...rest } = op.payload as { inventoryItemId: string } & Record<string, unknown>;
      const input = adjustStockSchema.parse(rest);
      const item = await adjustStock(session, String(inventoryItemId), input);
      return item.id;
    }
    default:
      throw new AppError("UNKNOWN_OPERATION", `Unknown operation kind.`, 400);
  }
}
