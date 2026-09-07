import { NextRequest } from "next/server";
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

    // Opportunistic and best-effort — a bug in this checker must never break
    // the primary dashboard-load path. Internally throttled, so most calls
    // here are a single cheap read, not a re-run of the full check. Awaited
    // (not fire-and-forget) because a serverless function's execution can be
    // frozen the moment the response is sent, which would silently cut off
    // any un-awaited work still in flight.
    try {
      await runAnomalyChecksIfDue();
    } catch (err) {
      console.error("anomaly check failed:", err);
    }

    return ok({ period, ...summary });
  } catch (err) {
    return handleRouteError(err);
  }
}
