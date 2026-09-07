import { requireSessionForPage } from "@/lib/auth/session";
import { SyncQueueView } from "@/components/sync/sync-queue-view";

export default async function SyncPage() {
  await requireSessionForPage();
  return <SyncQueueView />;
}
