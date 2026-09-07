import { z } from "zod";

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().min(2).optional(),
  currency: z.enum(["PKR", "USD", "GBP", "EUR", "SAR", "AED"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  taxRatePct: z.number().min(0).max(100).optional(),
  serviceChargePct: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().trim().min(1).max(10).optional(),
});
