import { requireSessionForPage } from "@/lib/auth/session";
import { AlertsView } from "@/components/staff/alerts-view";

export default async function AlertsPage() {
  await requireSessionForPage();
  return <AlertsView />;
}
