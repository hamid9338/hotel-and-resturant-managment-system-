import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { ReportsView } from "@/components/reports/reports-view";

export default async function ReportsPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <ReportsView currency={settings.currency} />;
}
