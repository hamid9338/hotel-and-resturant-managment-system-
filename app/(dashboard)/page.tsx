import { requireSessionForPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/services/settings";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { WelcomePanel } from "@/components/dashboard/welcome-panel";

export default async function DashboardPage() {
  const session = await requireSessionForPage();
  const canViewReports = await hasPermission(session, "reports.view");

  if (!canViewReports) {
    return <WelcomePanel session={session} />;
  }

  const settings = await getSettings();
  return <DashboardContent currency={settings.currency} />;
}
