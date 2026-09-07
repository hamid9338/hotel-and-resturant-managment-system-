"use client";

import { useEffect, useState, useCallback } from "react";
import { Wrench } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

type Staff = { id: string; name: string };
type Ticket = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  createdAt: string;
  room: { number: string } | null;
  reportedBy: { name: string };
  assignedTo: { id: string; name: string } | null;
};

const PRIORITY_TONE: Record<string, "neutral" | "warning" | "danger" | "accent"> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
  URGENT: "danger",
};
const STATUS_TONE: Record<string, "warning" | "info" | "success" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CANCELLED: "neutral",
};
const STATUS_FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

export function MaintenanceBoard() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [active, setActive] = useState<Ticket | null>(null);

  const load = useCallback(() => {
    api
      .get<Ticket[]>("/api/maintenance-tickets")
      .then(setTickets)
      .catch(() => setTickets([]));
  }, []);

  useEffect(() => {
    load();
    api
      .get<Staff[]>("/api/staff")
      .then(setStaff)
      .catch(() => {});
  }, [load]);

  const update = async (id: string, patch: { status?: string; assignedToId?: string; priority?: string }) => {
    try {
      await api.patch(`/api/maintenance-tickets/${id}`, patch);
      toast.success("Ticket updated");
      setActive(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update ticket.");
    }
  };

  if (tickets === null) return <SkeletonRows rows={6} />;

  const visible = filter === "ALL" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Maintenance</h1>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              filter === s
                ? "border-accent-border bg-accent-soft text-accent"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Wrench} title="No tickets" description="Issues reported from Housekeeping will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className="rounded-xl border border-border-default bg-surface-1 p-4 text-left transition-colors hover:border-accent-border"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{t.title}</span>
                <Badge tone={STATUS_TONE[t.status]}>{t.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                {t.room && <span>Room {t.room.number}</span>}
                <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
              </div>
              <div className="text-xs text-muted-2">
                Reported by {t.reportedBy.name} · {formatDateTime(t.createdAt)}
              </div>
              {t.assignedTo && <div className="mt-1 text-xs text-accent">Assigned: {t.assignedTo.name}</div>}
            </button>
          ))}
        </div>
      )}

      {active && (
        <Modal title={active.title} onClose={() => setActive(null)}>
          <div className="space-y-3">
            {active.description && <p className="text-sm text-muted">{active.description}</p>}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Status</label>
              <Select value={active.status} onChange={(e) => update(active.id, { status: e.target.value })}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Priority</label>
              <Select value={active.priority} onChange={(e) => update(active.id, { priority: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Assign to</label>
              <Select
                value={active.assignedTo?.id ?? ""}
                onChange={(e) => update(active.id, { assignedToId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
