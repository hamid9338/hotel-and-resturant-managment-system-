import { z } from "zod";

export const ocrBillItemSchema = z.object({
  name: z.string().min(1),
  qty: z.string().optional(),
  unit: z.number().min(0),
  total: z.number().min(0),
});

export const scanBillSchema = z.object({
  billType: z.enum(["PURCHASE", "SALES"]).default("PURCHASE"),
  imageUrl: z.string().min(1, { error: "No image was uploaded." }),
});

export const updateOcrBillSchema = z.object({
  vendor: z.string().trim().optional(),
  billNo: z.string().trim().optional(),
  billDate: z.string().trim().optional(),
  items: z.array(ocrBillItemSchema).optional(),
  subtotal: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  verified: z.boolean().optional(),
});
