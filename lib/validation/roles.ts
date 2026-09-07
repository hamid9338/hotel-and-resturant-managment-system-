import { z } from "zod";

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});
