import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, { error: "Username is required." }).trim(),
  pin: z.string().min(4, { error: "PIN must be at least 4 digits." }).max(8),
});

// Validates the JWT payload before trusting it as a fallback session when the
// database is unreachable — a pre-upgrade cookie missing these fields simply
// fails this parse rather than being trusted with an incomplete identity.
export const sessionClaimsSchema = z.object({
  sub: z.string().min(1),
  roleId: z.string().min(1),
  roleName: z.string().min(1),
  permissionKeys: z.array(z.string()),
  name: z.string().min(1),
  username: z.string().min(1),
  shift: z.string().nullable(),
});
