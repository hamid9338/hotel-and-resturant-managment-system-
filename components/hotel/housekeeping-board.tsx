"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Wrench } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { usePermissions } from "@/components/permissions-provider";
import { useToast } from "@/components/ui/toast";
import { ReportIssueModal } from "@/components/hotel/report-issue-modal";
import type { RoomWithBookings } from "@/lib/types/hotel";

export function HousekeepingBoard() {
  const { has } = usePermissions();
  const toast = useToast();
  const [rooms, setRooms] = useState<RoomWithBookings[] | null>(null);
  const [reportingRoom, setReportingRoom] = useState<{ id: string; number: string } | null>(null);

  const load = useCallback(() => {
    api
      .get<RoomWithBookings[]>("/api/rooms")
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (roomId: string, status: string) => {
    try {
      await api.patch(`/api/rooms/${roomId}/status`, { status });
      toast.success("Room status updated");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update room.");
    }
  };

  if (rooms === null) return <SkeletonRows rows={5} />;

  const cleaning = rooms.filter((r) => r.status === "CLEANING");
  const maintenance = rooms.filter((r) => r.status === "MAINTENANCE");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Housekeeping</h1>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <Sparkles size={15} /> Needs Cleaning ({cleaning.length})
        </h2>
        {cleaning.length === 0 ? (
          <EmptyState icon={Sparkles} title="All caught up" description="No rooms are awaiting cleaning right now." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cleaning.map((r) => (
              <div key={r.id} className="rounded-xl border border-border-default bg-surface-1 p-4">
                <div className="font-display text-lg font-semibold">{r.number}</div>
                <div className="text-xs text-muted">
                  {r.roomType.name} · Floor {r.floor}
                </div>
                {has("hotel.update_room_status") && (
                  <div className="mt-3 space-y-1.5">
                    <Button size="sm" variant="success" className="w-full" onClick={() => setStatus(r.id, "AVAILABLE")}>
                      Mark Clean
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setReportingRoom({ id: r.id, number: r.number })}
                    >
                      Report Issue
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <Wrench size={15} /> Maintenance ({maintenance.length})
        </h2>
        {maintenance.length === 0 ? (
          <EmptyState icon={Wrench} title="Nothing under maintenance" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {maintenance.map((r) => (
              <div key={r.id} className="rounded-xl border border-warning/30 bg-warning-soft/40 p-4">
                <div className="font-display text-lg font-semibold">{r.number}</div>
                <div className="text-xs text-muted">
                  {r.roomType.name} · Floor {r.floor}
                </div>
                {has("hotel.update_room_status") && (
                  <Button size="sm" variant="success" className="mt-3 w-full" onClick={() => setStatus(r.id, "AVAILABLE")}>
                    Resolved — Mark Available
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {reportingRoom && (
        <ReportIssueModal
          roomId={reportingRoom.id}
          roomNumber={reportingRoom.number}
          onClose={() => setReportingRoom(null)}
          onDone={() => {
            setReportingRoom(null);
            load();
          }}
        />
      )}
    </div>
  );
}
