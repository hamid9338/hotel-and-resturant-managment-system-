import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(2, { error: "Name is required." }),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  taxInfo: z.string().trim().optional(),
});

const poLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantityOrdered: z.number().positive(),
  unitCost: z.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().trim().optional(),
  items: z.array(poLineSchema).min(1, { error: "Add at least one line item." }),
});

const receiveLineSchema = z.object({
  poItemId: z.string().min(1),
  quantityReceivedNow: z.number().positive(),
});

// One receiving event; a PO can be received across several of these calls
// (multi-delivery partial receiving) — quantityReceived on each line
// accumulates across events rather than being set once.
export const receivePurchaseOrderSchema = z.object({
  lines: z.array(receiveLineSchema).min(1, { error: "Enter at least one received quantity." }),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(["ORDERED", "VERIFIED", "PAID", "CANCELLED"]),
});
