import { requireSessionForPage } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/services/settings";
import { rangeForPeriod, getDashboardSummary, getDailyTrend } from "@/lib/services/reports";
import { ReportPrintLayout } from "@/components/print/report-layout";

const PERIOD_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
};

// Deliberately not in lib/nav.ts — reached only from a "Print Report" link on
// the already-permissioned Reports page, not a top-level destination. Still
// independently permission-checked here, matching the booking/order print
// pages' own documented exception.
export default async function PrintReportPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireSessionForPage();
  await requirePermission(session, "reports.view");
  const { period = "30d" } = await searchParams;

  const [settings, summary, daily] = await Promise.all([
    getSettings(),
    getDashboardSummary(rangeForPeriod(period)),
    getDailyTrend(period === "month" ? 31 : period === "7d" ? 7 : period === "today" || period === "yesterday" ? 1 : 30),
  ]);

  return (
    <ReportPrintLayout
      businessName={settings.businessName}
      logoUrl={settings.logoUrl}
      currency={settings.currency}
      periodLabel={PERIOD_LABELS[period] ?? period}
      generatedAt={new Date()}
      summary={summary}
      daily={daily}
    />
  );
}
