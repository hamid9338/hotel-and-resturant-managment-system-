import { z } from "zod";
import { paymentMethodEnum } from "@/lib/validation/hotel";

export const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  qty: z.number().int().min(1).max(50),
  notes: z.string().trim().optional(),
});

export const createOrderSchema = z
  .object({
    orderType: z.enum(["DINE_IN", "TAKEAWAY", "ROOM_SERVICE"]).default("DINE_IN"),
    tableId: z.string().min(1).optional(),
    roomId: z.string().min(1).optional(),
    items: z.array(orderItemSchema).min(1, { error: "Add at least one item." }),
    notes: z.string().trim().optional(),
  })
  .refine((d) => d.orderType !== "DINE_IN" || Boolean(d.tableId), {
    error: "A table is required for dine-in orders.",
    path: ["tableId"],
  })
  .refine((d) => d.orderType !== "ROOM_SERVICE" || Boolean(d.roomId), {
    error: "A room is required for room-service orders.",
    path: ["roomId"],
  });

export const addOrderItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, { error: "Add at least one item." }),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "READY", "SERVED", "BILLED", "CANCELLED"]),
});

export const billPaymentEntrySchema = z.object({
  method: paymentMethodEnum,
  amount: z.number().positive(),
});

// Split-by-payment-method billing: one settle action can pay part cash, part
// card, etc. The "sums to order.total exactly" check happens in the service
// layer, not here — Zod has no access to the order's actual total.
export const billOrderSchema = z.object({
  payments: z.array(billPaymentEntrySchema).min(1).max(4),
});

export const updateMenuItemSchema = z.object({
  name: z.string().trim().min(2).optional(),
  categoryId: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  prepTimeMins: z.number().int().positive().optional(),
  available: z.boolean().optional(),
});

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(2, { error: "Name is required." }),
  categoryId: z.string().min(1, { error: "A category is required." }),
  price: z.number().positive(),
  cost: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  prepTimeMins: z.number().int().positive().optional(),
  available: z.boolean().default(true),
});

export const createMenuCategorySchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }),
  sortOrder: z.number().int().optional(),
});

export const recipeLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantityUsed: z.number().positive(),
});

// Replace-the-whole-set, not per-line CRUD — matches how a chef/manager
// naturally thinks about "here's this dish's full ingredient list." An empty
// array is valid (a drink or item with nothing worth tracking).
export const setRecipeSchema = z.object({
  lines: z.array(recipeLineSchema),
});

export const updateKitchenItemStatusSchema = z.object({
  status: z.enum(["QUEUED", "COOKING", "READY", "SERVED"]),
});

export const refundOrderSchema = z.object({
  amount: z.number().positive(),
  method: paymentMethodEnum,
  reason: z.string().trim().min(3, { error: "A reason is required for a refund." }),
});
