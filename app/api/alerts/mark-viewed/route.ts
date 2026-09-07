import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { markAlertsViewed } from "@/lib/services/alerts";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST() {
  try {
    const session = await requireSession();
    await requirePermission(session, "alerts.view");
    await markAlertsViewed(session.id);
    return ok({ viewed: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
