import { getSession, clearSessionCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/services/audit";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST() {
  try {
    const session = await getSession();
    await clearSessionCookie();
    if (session) {
      await recordAudit({ session, action: "Logout", module: "System" });
    }
    return ok({ message: "Logged out" });
  } catch (err) {
    return handleRouteError(err);
  }
}
