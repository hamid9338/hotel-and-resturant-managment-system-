import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getDashboardSummary, rangeForPeriod } from "@/lib/services/reports";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "reports.view");
    const period = request.nextUrl.searchParams.get("period") ?? "today";
    const summary = await getDashboardSummary(rangeForPeriod(period));
    return ok({ period, ...summary });
  } catch (err) {
    return handleRouteError(err);
  }
}
