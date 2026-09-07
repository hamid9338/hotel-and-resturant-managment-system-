"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { flushOutbox } from "@/lib/offline/sync-client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

type SyncOp = {
  id: string;
  operationKind: string;
  status: string;
  conflictReason: string | null;
  createdAt: string;
  user: { name: string };
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  APPLIED: "success",
  CONFLICT: "warning",
  FAILED: "danger",
};

export function SyncQueueView() {
  const toast = useToast();
  const { id: userId } = useSessionUser();
  const [ops, setOps] = useState<SyncOp[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    api
      .get<SyncOp[]>("/api/sync/queue")
      .then(setOps)
      .catch(() => setOps([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await flushOutbox(userId);
      const total = result.applied + result.conflicts + result.failed;
      toast.success(total === 0 ? "Nothing queued to sync" : `Synced ${result.applied} of ${total} queued action(s)`);
      load();
    } finally {
      setSyncing(false);
    }
  };

  if (ops === null) return <SkeletonRows rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Sync Status</h1>
        <Button variant="secondary" loading={syncing} onClick={syncNow}>
          <RefreshCw size={14} /> Sync Now
        </Button>
      </div>
      <p className="max-w-2xl text-sm text-muted">
        Actions taken while offline are queued on-device and pushed here once the connection returns. Conflicts
        (e.g. a room booked from two devices at once) are flagged for review rather than silently overwritten.
      </p>
      {ops.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Nothing queued" description="No offline actions have been synced yet." />
      ) : (
        <Card>
          <div className="divide-y divide-border-default">
            {ops.map((op) => (
              <div key={op.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-mono text-xs">{op.operationKind}</div>
                  <div className="text-xs text-muted">
                    {op.user.name} · {formatDateTime(op.createdAt)}
                  </div>
                  {op.conflictReason && <div className="mt-0.5 text-xs text-danger">{op.conflictReason}</div>}
                </div>
                <Badge tone={STATUS_TONE[op.status]}>{op.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
