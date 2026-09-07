import { requireSessionForPage } from "@/lib/auth/session";
import { MaintenanceBoard } from "@/components/hotel/maintenance-board";

export default async function MaintenancePage() {
  await requireSessionForPage();
  return <MaintenanceBoard />;
}
