import { z } from "zod";

export const generateNarrativeSchema = z.object({
  period: z.string().min(1),
});
