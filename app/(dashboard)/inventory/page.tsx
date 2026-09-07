import { requireSessionForPage } from "@/lib/auth/session";
import { InventoryList } from "@/components/inventory/inventory-list";

export default async function InventoryPage() {
  await requireSessionForPage();
  return <InventoryList />;
}
