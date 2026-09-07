import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(2, { error: "Name is required." }).trim(),
  username: z
    .string()
    .min(3, { error: "Username must be at least 3 characters." })
    .trim()
    .toLowerCase(),
  pin: z.string().min(4, { error: "PIN must be at least 4 digits." }).max(8),
  roleName: z.string().min(1, { error: "Role is required." }),
  shift: z.string().trim().optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).optional(),
  roleName: z.string().min(1).optional(),
  shift: z.string().trim().optional(),
  active: z.boolean().optional(),
  pin: z.string().min(4).max(8).optional(),
});
