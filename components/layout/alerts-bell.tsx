"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

type AlertSummary = {
  count: number;
  recent: { id: string; message: string; severity: string; createdAt: string }[];
};

const SEVERITY_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  NONE: "neutral",
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "danger",
};

export function AlertsBell({ initial }: { initial: AlertSummary }) {
  const [summary, setSummary] = useState<AlertSummary>(initial);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(() => {
    api
      .get<AlertSummary>("/api/alerts/unread-count")
      .then(setSummary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Mounted globally in the shell (every page, every session) rather than
    // one board a single staff member is actively working — a page-local
    // 15s interval like orders-board.tsx would be needlessly aggressive here.
    const interval = setInterval(poll, 45000);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && summary.count > 0) {
      api
        .post("/api/alerts/mark-viewed")
        .then(() => setSummary((s) => ({ ...s, count: 0 })))
        .catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <Bell size={17} />
        {summary.count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-semibold text-white">
            {summary.count > 9 ? "9+" : summary.count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border-default bg-surface-1 shadow-lg">
          <div className="border-b border-border-default px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">
            Recent alerts
          </div>
          {summary.recent.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No active alerts.</div>
          ) : (
            <div className="max-h-80 divide-y divide-border-default overflow-y-auto">
              {summary.recent.map((a) => (
                <div key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">{a.message}</span>
                    <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-2">{formatDateTime(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/staff/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border-default px-4 py-2.5 text-center text-sm text-accent hover:bg-surface-2"
          >
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
}
