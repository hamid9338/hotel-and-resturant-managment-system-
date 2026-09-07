import { getPendingOperations, markSynced, type QueuedOperation } from "@/lib/offline/outbox";

export type FlushResult = { applied: number; conflicts: number; failed: number };
type PushResultRow = { id: string; status: "applied" | "duplicate" | "conflict" | "rejected"; reason?: string };

export async function flushOutbox(userId: string): Promise<FlushResult> {
  const pending = await getPendingOperations(userId);
  if (pending.length === 0) return { applied: 0, conflicts: 0, failed: 0 };

  const operations = pending.map((op: QueuedOperation) => ({
    id: op.id,
    deviceId: op.deviceId,
    operationKind: op.operationKind,
    entityId: op.entityId,
    payload: op.payload,
    clientTimestamp: op.clientTimestamp,
  }));

  let res: Response;
  try {
    res = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations }),
    });
  } catch {
    // Still offline (or the server is unreachable) — leave everything queued.
    return { applied: 0, conflicts: 0, failed: 0 };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) return { applied: 0, conflicts: 0, failed: 0 };

  const results = body.data.results as PushResultRow[];
  const appliedIds = results.filter((r) => r.status === "applied" || r.status === "duplicate").map((r) => r.id);
  await markSynced(appliedIds);

  return {
    applied: appliedIds.length,
    conflicts: results.filter((r) => r.status === "conflict").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

/**
 * Attempts the normal online call; if the network itself is unreachable
 * (offline, or a request that never got a response), queues the operation
 * for later sync instead of showing a hard error. A real server-side
 * rejection (validation failed, permission denied, room unavailable) is
 * NOT queued — it's surfaced to the user immediately, same as online.
 */
export async function submitOrQueue<T>(opts: {
  operationKind: QueuedOperation["operationKind"];
  entityId: string;
  userId: string;
  payload: Record<string, unknown>;
  onlineCall: () => Promise<T>;
}): Promise<{ queued: boolean; result?: T }> {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const result = await opts.onlineCall();
      return { queued: false, result };
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      // fall through to queueing below — this was a network failure, not a rejection
    }
  }

  const { queueOperation } = await import("@/lib/offline/outbox");
  await queueOperation({
    id: opts.entityId,
    operationKind: opts.operationKind,
    entityId: opts.entityId,
    payload: opts.payload,
    userId: opts.userId,
  });
  return { queued: true };
}
