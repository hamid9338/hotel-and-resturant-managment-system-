import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, { error: "Username is required." }).trim(),
  pin: z.string().min(4, { error: "PIN must be at least 4 digits." }).max(8),
});
