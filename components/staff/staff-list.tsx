"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, UserCog } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { StaffFormModal } from "@/components/staff/staff-form-modal";

type StaffRow = {
  id: string;
  name: string;
  username: string;
  shift: string | null;
  active: boolean;
  role: { name: string; label: string };
};

export function StaffList() {
  const toast = useToast();
  const { has } = usePermissions();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; staff: StaffRow } | null>(null);

  const load = useCallback(() => {
    api
      .get<StaffRow[]>("/api/staff")
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (row: StaffRow) => {
    try {
      await api.patch(`/api/staff/${row.id}`, { active: !row.active });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update staff.");
    }
  };

  if (staff === null) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Staff</h1>
        {has("staff.create") && (
          <Button variant="primary" onClick={() => setModal({ mode: "create" })}>
            <UserPlus size={15} /> Add Staff
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" />
      ) : (
        <Card>
          <div className="divide-y divide-border-default">
            {staff.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">
                    @{s.username} · {s.shift ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="accent">{s.role.label}</Badge>
                  <button onClick={() => toggleActive(s)} disabled={!has("staff.edit")}>
                    <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge>
                  </button>
                  {has("staff.edit") && (
                    <Button size="sm" variant="ghost" onClick={() => setModal({ mode: "edit", staff: s })}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal && (
        <StaffFormModal
          mode={modal.mode}
          staff={modal.mode === "edit" ? modal.staff : undefined}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
