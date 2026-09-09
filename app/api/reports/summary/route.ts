import { NextRequest, after } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getDashboardSummary, rangeForPeriod } from "@/lib/services/reports";
import { runAnomalyChecksIfDue } from "@/lib/services/anomalies";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "reports.view");
    const period = request.nextUrl.searchParams.get("period") ?? "today";
    const summary = await getDashboardSummary(rangeForPeriod(period));

    // Opportunistic and best-effort — a bug in this checker must never
    // block or break the primary dashboard-load path. after() (Next 15+,
    // backed by Vercel's waitUntil) runs this once the response is already
    // on the wire, so a slow first-ever throttle window doesn't stall
    // whoever happens to trigger it, while still guaranteeing it completes
    // rather than risking a fire-and-forget call getting frozen mid-flight.
    after(async () => {
      try {
        await runAnomalyChecksIfDue();
      } catch (err) {
        console.error("anomaly check failed:", err);
      }
    });

    return ok({ period, ...summary });
  } catch (err) {
    return handleRouteError(err);
  }
}
