import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PurchaseOrdersBoard } from "@/components/inventory/purchase-orders-board";

export default async function PurchaseOrdersPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <PurchaseOrdersBoard currency={settings.currency} />;
}
