"use client";

import { useEffect, useState, useCallback } from "react";
import { BellRing, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatDateTime } from "@/lib/format";

type AlertRow = {
  id: string;
  message: string;
  detail: string | null;
  severity: string;
  createdAt: string;
  user: { name: string } | null;
};

const SEVERITY_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  NONE: "neutral",
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "danger",
};

export function AlertsView() {
  const toast = useToast();
  const { has } = usePermissions();
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);

  const load = useCallback(() => {
    api
      .get<AlertRow[]>("/api/alerts")
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string) => {
    try {
      await api.patch(`/api/alerts/${id}/resolve`);
      toast.success("Alert resolved");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not resolve alert.");
    }
  };

  if (alerts === null) return <SkeletonRows rows={5} />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Alerts</h1>
      {alerts.length === 0 ? (
        <EmptyState icon={BellRing} title="No active alerts" description="Suspicious or unauthorized activity will show up here." />
      ) : (
        <Card>
          <div className="divide-y divide-border-default">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {a.message} <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  </div>
                  {a.detail && <div className="mt-0.5 text-xs text-muted">{a.detail}</div>}
                  <div className="mt-0.5 text-xs text-muted-2">
                    {formatDateTime(a.createdAt)}
                    {a.user ? ` · ${a.user.name}` : ""}
                  </div>
                </div>
                {has("alerts.resolve") && (
                  <Button size="sm" variant="secondary" onClick={() => resolve(a.id)}>
                    <Check size={13} /> Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
