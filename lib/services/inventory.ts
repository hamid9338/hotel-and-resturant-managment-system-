import "server-only";
import type { Prisma, StockMovementSource } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
  postOcrBillToInventorySchema,
} from "@/lib/validation/inventory";

type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
type AdjustStockInput = z.infer<typeof adjustStockSchema>;
type PostOcrBillToInventoryInput = z.infer<typeof postOcrBillToInventorySchema>;

const LOW_STOCK_ALERT_TYPE = "low_stock";

/**
 * The one primitive every stock-changing action writes through — recipe
 * deduction at billing, purchase-order receiving, OCR-purchase posting, and
 * manual adjustments all call this instead of touching quantityOnHand
 * directly. Takes a Prisma.TransactionClient (same {tx} composability as
 * lib/services/availability.ts's assertRoomAvailable) so it nests inside a
 * caller's own transaction — e.g. a bill settlement and the ingredient
 * deductions it triggers must commit or roll back together.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  input: {
    inventoryItemId: string;
    quantityDelta: number;
    source: StockMovementSource;
    relatedId?: string;
    reason?: string;
    createdById: string;
  }
) {
  await tx.stockMovement.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      quantityDelta: input.quantityDelta,
      source: input.source,
      relatedId: input.relatedId,
      reason: input.reason,
      createdById: input.createdById,
    },
  });

  const item = await tx.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: { quantityOnHand: { increment: input.quantityDelta } },
  });

  await syncLowStockAlert(tx, item);
  return item;
}

async function syncLowStockAlert(
  tx: Prisma.TransactionClient,
  item: { id: string; name: string; quantityOnHand: Prisma.Decimal; reorderLevel: Prisma.Decimal; unit: string }
) {
  const onHand = toNumber(item.quantityOnHand);
  const reorderLevel = toNumber(item.reorderLevel);
  const isLow = onHand <= reorderLevel;

  const existing = await tx.alert.findFirst({
    where: { type: LOW_STOCK_ALERT_TYPE, entityId: item.id, resolved: false },
  });

  if (isLow && !existing) {
    await tx.alert.create({
      data: {
        type: LOW_STOCK_ALERT_TYPE,
        message: `${item.name} is low on stock (${onHand} ${item.unit} left, reorder at ${reorderLevel})`,
        severity: "MEDIUM",
        entityId: item.id,
      },
    });
  } else if (!isLow && existing) {
    await tx.alert.update({ where: { id: existing.id }, data: { resolved: true, resolvedAt: new Date() } });
  }
}

export async function listInventoryItems(includeInactive = false) {
  return prisma.inventoryItem.findMany({
    where: includeInactive ? undefined : { active: true },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createInventoryItem(session: SessionUser, input: CreateInventoryItemInput) {
  const existing = await prisma.inventoryItem.findUnique({ where: { sku: input.sku } });
  if (existing) throw new AppError("SKU_TAKEN", "An item with that SKU already exists.", 409);

  const item = await prisma.inventoryItem.create({
    data: {
      sku: input.sku,
      name: input.name,
      category: input.category,
      unit: input.unit,
      reorderLevel: input.reorderLevel,
      costPerUnit: input.costPerUnit,
      supplierId: input.supplierId,
    },
  });

  await recordAudit({
    session,
    action: `Inventory item created: ${item.name}`,
    module: "Inventory",
    entityType: "InventoryItem",
    entityId: item.id,
  });

  return item;
}

export async function updateInventoryItem(session: SessionUser, id: string, input: UpdateInventoryItemInput) {
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      reorderLevel: input.reorderLevel,
      costPerUnit: input.costPerUnit,
      supplierId: input.supplierId,
      active: input.active,
    },
  });

  await recordAudit({
    session,
    action: `Inventory item updated: ${item.name}`,
    module: "Inventory",
    entityType: "InventoryItem",
    entityId: item.id,
  });

  return item;
}

export async function adjustStock(session: SessionUser, itemId: string, input: AdjustStockInput) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError("INVENTORY_ITEM_NOT_FOUND", "Inventory item not found.", 404);

  const updated = await prisma.$transaction((tx) =>
    recordStockMovement(tx, {
      inventoryItemId: itemId,
      quantityDelta: input.quantityDelta,
      source: "MANUAL_ADJUSTMENT",
      reason: input.reason,
      createdById: session.id,
    })
  );

  await recordAudit({
    session,
    action: `Stock adjusted: ${item.name} (${input.quantityDelta > 0 ? "+" : ""}${input.quantityDelta} ${item.unit})`,
    module: "Inventory",
    entityType: "InventoryItem",
    entityId: item.id,
    riskLevel: "LOW",
    details: input.reason,
  });

  return updated;
}

/**
 * The lightweight alternative to a formal Supplier/PurchaseOrder — a
 * verified purchase-type OCR bill can be posted straight to the stock
 * ledger. Gated by inventory.manage (not just ocr.verify) in the route:
 * verifying a scan's transcription accuracy and being authorized to commit
 * to the stock ledger are different trust levels.
 */
export async function postOcrBillToInventory(
  session: SessionUser,
  ocrBillId: string,
  input: PostOcrBillToInventoryInput
) {
  const bill = await prisma.oCRBill.findUnique({ where: { id: ocrBillId } });
  if (!bill) throw new AppError("OCR_BILL_NOT_FOUND", "Scanned bill not found.", 404);
  if (bill.billType !== "PURCHASE") {
    throw new AppError("NOT_A_PURCHASE_BILL", "Only purchase bills can be posted to inventory.", 400);
  }
  if (!bill.verified) {
    throw new AppError("BILL_NOT_VERIFIED", "Verify this bill's transcription before posting it to inventory.", 409);
  }
  if (bill.inventoryPosted) {
    throw new AppError("ALREADY_POSTED", "This bill has already been posted to inventory.", 409);
  }

  await prisma.$transaction(async (tx) => {
    for (const line of input.lines) {
      await recordStockMovement(tx, {
        inventoryItemId: line.inventoryItemId,
        quantityDelta: line.quantity,
        source: "OCR_PURCHASE_POSTED",
        relatedId: ocrBillId,
        createdById: session.id,
      });
    }
    await tx.oCRBill.update({ where: { id: ocrBillId }, data: { inventoryPosted: true } });
    // See the matching comment in lib/services/orders.ts::billOrder.
  }, { timeout: 15_000 });

  await recordAudit({
    session,
    action: `OCR bill posted to inventory: ${bill.vendor ?? "Unknown vendor"} — ${input.lines.length} item(s)`,
    module: "Inventory",
    entityType: "OCRBill",
    entityId: bill.id,
  });

  return { posted: true };
}

export async function listStockMovements(itemId: string) {
  return prisma.stockMovement.findMany({
    where: { inventoryItemId: itemId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
