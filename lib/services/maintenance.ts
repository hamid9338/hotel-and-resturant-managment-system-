import "server-only";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { updateRoomStatus } from "@/lib/services/rooms";
import type { SessionUser } from "@/lib/auth/session";
import type { createMaintenanceTicketSchema, updateMaintenanceTicketSchema } from "@/lib/validation/maintenance";

type CreateMaintenanceTicketInput = z.infer<typeof createMaintenanceTicketSchema>;
type UpdateMaintenanceTicketInput = z.infer<typeof updateMaintenanceTicketSchema>;

const ticketInclude = {
  room: true,
  reportedBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} as const;

export async function listMaintenanceTickets(filters: { status?: string }) {
  return prisma.maintenanceTicket.findMany({
    where: { status: filters.status ? (filters.status as never) : undefined },
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Upgrades the old bare "Report Issue" status flip into a real ticket: the
 * room-status change and the ticket record are composed into one atomic
 * transaction via updateRoomStatus's {tx} option. Only flips the room's
 * status when a room is actually attached — a general ticket ("kitchen
 * fridge broken") doesn't need one.
 */
export async function createMaintenanceTicket(session: SessionUser, input: CreateMaintenanceTicketInput) {
  const ticket = await prisma.$transaction(async (tx) => {
    if (input.roomId) {
      await updateRoomStatus(session, input.roomId, "MAINTENANCE", { tx });
    }
    return tx.maintenanceTicket.create({
      data: {
        roomId: input.roomId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        reportedById: session.id,
      },
      include: ticketInclude,
    });
  });

  await recordAudit({
    session,
    action: `Maintenance ticket reported: ${ticket.title}`,
    module: "Hotel",
    entityType: "MaintenanceTicket",
    entityId: ticket.id,
    details: ticket.room ? `Room ${ticket.room.number}` : undefined,
  });

  return ticket;
}

export async function updateMaintenanceTicket(session: SessionUser, id: string, input: UpdateMaintenanceTicketInput) {
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
  if (!ticket) throw new AppError("TICKET_NOT_FOUND", "Maintenance ticket not found.", 404);

  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      status: input.status,
      assignedToId: input.assignedToId,
      priority: input.priority,
      resolvedAt: input.status === "RESOLVED" ? new Date() : undefined,
    },
    include: ticketInclude,
  });

  await recordAudit({
    session,
    action: `Maintenance ticket updated: ${ticket.title}`,
    module: "Hotel",
    entityType: "MaintenanceTicket",
    entityId: ticket.id,
    newValue: input as Prisma.InputJsonValue,
  });

  return updated;
}
