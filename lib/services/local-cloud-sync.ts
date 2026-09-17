import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import type { SyncOperationInput } from "@/lib/validation/sync";

export type LocalMutationKind = SyncOperationInput["operationKind"];

const LOCAL_SERVER_DEVICE_ID = "local-server";

/**
 * Records a mutation this server just applied directly (the normal online
 * route path) so scripts/cloud-sync-worker.ts can later forward it to the
 * cloud database — see DEPLOYMENT-LOCAL.md. A browser's own offline-outbox
 * flush already gets a SyncOperation row for free via applySyncOperation()
 * in lib/services/sync.ts; this covers the far more common path on a
 * local-server deployment — a LAN device hitting this server while "online"
 * relative to it, which writes no such row today.
 *
 * No-ops when this isn't a local-server deployment with Phase 2 enabled
 * (CLOUD_SYNC_TARGET_URL unset — the cloud deployment never sets this, so
 * it's always a no-op there). Never throws: this runs after the real
 * mutation has already committed, so a logging hiccup here must never turn
 * a successful booking/order/etc. into a failed response to the clerk who
 * made it.
 */
export async function recordLocalMutation(
  session: SessionUser,
  input: { operationKind: LocalMutationKind; entityId: string; payload: Record<string, unknown> }
): Promise<void> {
  if (!process.env.CLOUD_SYNC_TARGET_URL) return;

  try {
    await prisma.syncOperation.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: LOCAL_SERVER_DEVICE_ID,
        userId: session.id,
        operationKind: input.operationKind,
        entityId: input.entityId,
        payload: input.payload as Prisma.InputJsonValue,
        clientTimestamp: new Date(),
        status: "APPLIED",
        serverAppliedAt: new Date(),
        cloudPushStatus: "PENDING",
      },
    });
  } catch (err) {
    console.error("[local-cloud-sync] failed to record a local mutation for later forwarding:", err);
  }
}
