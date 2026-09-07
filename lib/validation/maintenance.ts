import { z } from "zod";

export const createMaintenanceTicketSchema = z.object({
  roomId: z.string().optional(),
  title: z.string().trim().min(3, { error: "A short title is required." }),
  description: z.string().trim().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const updateMaintenanceTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"]).optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});
