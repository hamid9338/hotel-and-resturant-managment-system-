import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getDailyTrend } from "@/lib/services/reports";
import { ok, handleRouteError } from "@/lib/api/respond";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "reports.view");
    const daysParam = Number(request.nextUrl.searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 7;
    const data = await getDailyTrend(days);

    if (request.nextUrl.searchParams.get("format") === "csv") {
      const csv = toCsv(
        ["Date", "Hotel Revenue", "Restaurant Revenue", "Total"],
        data.map((d) => [d.date, d.hotel, d.restaurant, d.hotel + d.restaurant])
      );
      return csvResponse("daily-trend.csv", csv);
    }

    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
