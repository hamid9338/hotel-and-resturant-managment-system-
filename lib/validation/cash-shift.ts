import { z } from "zod";

export const openCashShiftSchema = z.object({
  openingFloat: z.number().min(0),
});

export const closeCashShiftSchema = z.object({
  closingCountedAmount: z.number().min(0),
  notes: z.string().trim().optional(),
});
