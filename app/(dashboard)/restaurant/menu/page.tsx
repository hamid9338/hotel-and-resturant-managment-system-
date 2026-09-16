import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { MenuManagement } from "@/components/restaurant/menu-management";

export default async function MenuManagementPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <MenuManagement currency={settings.currency} />;
}
