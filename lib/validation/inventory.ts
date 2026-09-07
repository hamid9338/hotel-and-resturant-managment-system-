import { z } from "zod";

export const createInventoryItemSchema = z.object({
  sku: z.string().trim().min(1, { error: "SKU is required." }),
  name: z.string().trim().min(2, { error: "Name is required." }),
  category: z.string().trim().optional(),
  unit: z.string().trim().min(1, { error: "Unit is required (e.g. kg, pcs, ltr)." }),
  reorderLevel: z.number().min(0).default(0),
  costPerUnit: z.number().min(0).optional(),
  supplierId: z.string().optional(),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(2).optional(),
  category: z.string().trim().optional(),
  unit: z.string().trim().min(1).optional(),
  reorderLevel: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplierId: z.string().optional(),
  active: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
  quantityDelta: z.number().refine((v) => v !== 0, { error: "Adjustment cannot be zero." }),
  reason: z.string().trim().min(3, { error: "A reason is required for a manual stock adjustment." }),
});

// OCR line items are free-text ("5 kg", "2 dozen"), so posting to inventory
// asks staff to enter a clean quantity/cost per line rather than parsing it.
const postOcrLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
});

export const postOcrBillToInventorySchema = z.object({
  lines: z.array(postOcrLineSchema).min(1, { error: "Map at least one line item to a stock item." }),
});
