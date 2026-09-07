import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { recordStockMovement } from "@/lib/services/inventory";
import { round2, toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
} from "@/lib/validation/purchasing";

type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusSchema>;

const poInclude = {
  supplier: true,
  items: { include: { inventoryItem: true } },
  createdBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
} as const;

export async function listPurchaseOrders(filters: { status?: string }) {
  return prisma.purchaseOrder.findMany({
    where: { status: filters.status ? (filters.status as never) : undefined },
    include: poInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createPurchaseOrder(session: SessionUser, input: CreatePurchaseOrderInput) {
  const total = round2(input.items.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0));

  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId: input.supplierId,
      notes: input.notes,
      total,
      createdById: session.id,
      items: {
        create: input.items.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
        })),
      },
    },
    include: poInclude,
  });

  await recordAudit({
    session,
    action: `Purchase order created: ${po.supplier.name} — ${total}`,
    module: "Inventory",
    entityType: "PurchaseOrder",
    entityId: po.id,
    details: `${input.items.length} line item(s)`,
  });

  return po;
}

/**
 * One of possibly many receiving events against the same PO (multi-delivery
 * partial receiving) — quantityReceived on each line accumulates across
 * calls rather than being set once. Status recomputes from the lines'
 * current totals after applying this event: RECEIVED once every line is
 * fully received, PARTIALLY_RECEIVED if some but not all is in.
 */
export async function receivePurchaseOrder(session: SessionUser, poId: string, input: ReceivePurchaseOrderInput) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: poInclude });
  if (!po) throw new AppError("PO_NOT_FOUND", "Purchase order not found.", 404);
  if (po.status === "CANCELLED") {
    throw new AppError("INVALID_PO_STATE", "Cannot receive a cancelled purchase order.", 409);
  }
  if (po.status === "RECEIVED" || po.status === "VERIFIED" || po.status === "PAID") {
    throw new AppError("INVALID_PO_STATE", "This purchase order has already been fully received.", 409);
  }

  const lineById = new Map(po.items.map((line) => [line.id, line]));
  for (const receiveLine of input.lines) {
    const line = lineById.get(receiveLine.poItemId);
    if (!line) throw new AppError("PO_ITEM_NOT_FOUND", "One of the selected line items is not on this purchase order.", 404);
    const remaining = round2(toNumber(line.quantityOrdered) - toNumber(line.quantityReceived));
    if (receiveLine.quantityReceivedNow > remaining + 0.001) {
      throw new AppError(
        "OVER_RECEIPT",
        `Cannot receive ${receiveLine.quantityReceivedNow} of ${line.inventoryItem.name} — only ${remaining} remaining on this line.`,
        422
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const receiveLine of input.lines) {
      const line = lineById.get(receiveLine.poItemId)!;
      await tx.purchaseOrderItem.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: receiveLine.quantityReceivedNow } },
      });
      await recordStockMovement(tx, {
        inventoryItemId: line.inventoryItemId,
        quantityDelta: receiveLine.quantityReceivedNow,
        source: "PURCHASE_ORDER_RECEIVED",
        relatedId: poId,
        createdById: session.id,
      });
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
    const allFullyReceived = refreshedItems.every(
      (l) => toNumber(l.quantityReceived) >= toNumber(l.quantityOrdered) - 0.001
    );
    const someReceived = refreshedItems.some((l) => toNumber(l.quantityReceived) > 0);
    const newStatus = allFullyReceived ? "RECEIVED" : someReceived ? "PARTIALLY_RECEIVED" : po.status;

    return tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus, receivedById: session.id, receivedAt: new Date() },
      include: poInclude,
    });
    // See the matching comment in lib/services/orders.ts::billOrder — a
    // variable-length per-line loop can outrun the 5s default under a
    // cold-starting serverless connection.
  }, { timeout: 15_000 });

  await recordAudit({
    session,
    action: `PO received: ${po.supplier.name} — ${input.lines.length} line(s), now ${updated.status}`,
    module: "Inventory",
    entityType: "PurchaseOrder",
    entityId: po.id,
  });

  return updated;
}

// Receiving is its own dedicated action, not reachable through this generic
// endpoint — DRAFT/ORDERED move to RECEIVED only via receivePurchaseOrder.
// PARTIALLY_RECEIVED has no manual way out either: the only path forward is
// more receiving, which auto-transitions to RECEIVED once complete.
const VALID_PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ORDERED", "CANCELLED"],
  ORDERED: ["CANCELLED"],
  PARTIALLY_RECEIVED: [],
  RECEIVED: ["VERIFIED", "CANCELLED"],
  VERIFIED: ["PAID"],
  PAID: [],
  CANCELLED: [],
};

export async function updatePurchaseOrderStatus(
  session: SessionUser,
  poId: string,
  input: UpdatePurchaseOrderStatusInput
) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new AppError("PO_NOT_FOUND", "Purchase order not found.", 404);

  const allowedNext = VALID_PO_TRANSITIONS[po.status] ?? [];
  if (!allowedNext.includes(input.status)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move a purchase order from ${po.status} to ${input.status}.`, 409);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: input.status },
    include: poInclude,
  });

  await recordAudit({
    session,
    action: `Purchase order #${po.id.slice(0, 8)} → ${input.status}`,
    module: "Inventory",
    entityType: "PurchaseOrder",
    entityId: po.id,
  });

  return updated;
}
