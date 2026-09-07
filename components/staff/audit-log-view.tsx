"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

type LogRow = {
  id: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  riskLevel: string;
  details: string | null;
  createdAt: string;
};

const RISK_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  NONE: "neutral",
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "danger",
};
const RISK_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW", "NONE"];

export function AuditLogView() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [risk, setRisk] = useState("ALL");

  useEffect(() => {
    const qs = risk !== "ALL" ? `?risk=${risk}` : "";
    api
      .get<LogRow[]>(`/api/audit${qs}`)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [risk]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Audit Log</h1>
      <div className="flex flex-wrap gap-1.5">
        {RISK_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setRisk(r)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              risk === r
                ? "border-accent-border bg-accent-soft text-accent"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {logs === null ? (
        <SkeletonRows rows={8} />
      ) : logs.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No matching audit entries" />
      ) : (
        <Card>
          <div className="divide-y divide-border-default">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div>{log.action}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {log.userName} ({log.userRole}) · {log.module} · {formatDateTime(log.createdAt)}
                  </div>
                  {log.details && <div className="mt-0.5 text-xs text-muted-2">{log.details}</div>}
                </div>
                <Badge tone={RISK_TONE[log.riskLevel]}>{log.riskLevel}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
