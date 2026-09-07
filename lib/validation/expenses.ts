import { z } from "zod";
import { paymentMethodEnum } from "@/lib/validation/hotel";

export const createExpenseSchema = z.object({
  category: z.string().trim().min(2, { error: "Category is required." }),
  amount: z.number().positive(),
  // Can't record how money left without knowing how, even though the Prisma
  // field itself stays nullable for flexibility.
  method: paymentMethodEnum,
  notes: z.string().trim().optional(),
  receiptUrl: z.string().trim().optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().trim().min(3, { error: "A reason is required to reject an expense." }).optional(),
});
