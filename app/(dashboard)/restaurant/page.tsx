import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { Pos } from "@/components/restaurant/pos";

export default async function RestaurantPosPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <Pos currency={settings.currency} />;
}
