import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { RoomStatus } from "@prisma/client";

// Shared by the online PATCH /api/rooms/[id]/status route and the offline
// sync dispatcher, so a queued housekeeping update gets the identical rule.
const VALID_TRANSITIONS: Record<string, RoomStatus[]> = {
  owner: ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"],
  manager: ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"],
  // Housekeeping can also flag a room into maintenance (a broken AC, etc.);
  // only owner/manager can take it all the way to OUT_OF_SERVICE.
  housekeeper: ["AVAILABLE", "CLEANING", "MAINTENANCE"],
};

export async function updateRoomStatus(session: SessionUser, roomId: string, status: RoomStatus) {
  const allowed = VALID_TRANSITIONS[session.roleName] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError("INVALID_TRANSITION", `${session.roleName} cannot set room status to ${status}.`, 403);
  }

  const room = await prisma.room.update({ where: { id: roomId }, data: { status } });

  await recordAudit({
    session,
    action: `Room ${room.number} status → ${status}`,
    module: "Hotel",
    entityType: "Room",
    entityId: room.id,
  });

  return room;
}
