import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { OrdersBoard } from "@/components/restaurant/orders-board";

export default async function OrdersPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <OrdersBoard currency={settings.currency} />;
}
