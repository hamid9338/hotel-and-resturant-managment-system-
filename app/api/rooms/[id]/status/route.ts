import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { roomStatusSchema } from "@/lib/validation/hotel";
import { updateRoomStatus } from "@/lib/services/rooms";
import { recordLocalMutation } from "@/lib/services/local-cloud-sync";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.update_room_status");
    const { status } = roomStatusSchema.parse(await request.json());
    const { id } = await params;
    const room = await updateRoomStatus(session, id, status);
    await recordLocalMutation(session, {
      operationKind: "rooms.updateStatus",
      entityId: room.id,
      payload: { roomId: id, status },
    });
    return ok(room);
  } catch (err) {
    return handleRouteError(err);
  }
}
