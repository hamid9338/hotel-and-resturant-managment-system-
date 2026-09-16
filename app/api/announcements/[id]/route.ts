import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getAnnouncement } from "@/lib/services/announcements";
import { ok, fail, handleRouteError } from "@/lib/api/respond";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "announcements.send");
    const { id } = await params;
    const announcement = await getAnnouncement(id);
    if (!announcement) return fail("NOT_FOUND", "Announcement not found.", 404);
    return ok(announcement);
  } catch (err) {
    return handleRouteError(err);
  }
}
