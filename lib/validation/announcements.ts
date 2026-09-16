import { z } from "zod";

export const sendAnnouncementSchema = z.object({
  templateName: z.string().trim().min(1, { error: "Choose a template." }),
  variables: z.array(z.string()).default([]),
  audience: z.enum(["all", "active"]).default("all"),
});
