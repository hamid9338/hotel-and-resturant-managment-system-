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

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "READY", "SERVED", "BILLED", "CANCELLED"]),
});

export const billOrderSchema = z.object({
  paymentMethod: paymentMethodEnum.default("CASH"),
});

export const updateMenuItemSchema = z.object({
  price: z.number().min(0).optional(),
  available: z.boolean().optional(),
});
