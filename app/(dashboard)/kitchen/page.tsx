import { requireSessionForPage } from "@/lib/auth/session";
import { KitchenDisplay } from "@/components/restaurant/kitchen-display";

export default async function KitchenPage() {
  await requireSessionForPage();
  return <KitchenDisplay />;
}
