import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getUnreadAlertSummary } from "@/lib/services/alerts";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "alerts.view");
    const summary = await getUnreadAlertSummary(session.id);
    return ok(summary);
  } catch (err) {
    return handleRouteError(err);
  }
}
