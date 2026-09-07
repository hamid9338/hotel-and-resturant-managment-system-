"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Permission = { id: string; key: string; module: string; description: string | null };
type RoleRow = { id: string; name: string; label: string; permissionKeys: string[] };
type RolesData = { permissions: Permission[]; roles: RoleRow[] };

function groupByModule(permissions: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const p of permissions) {
    if (!groups.has(p.module)) groups.set(p.module, []);
    groups.get(p.module)!.push(p);
  }
  return [...groups.entries()];
}

export function RolesPermissionMatrix() {
  const toast = useToast();
  const [data, setData] = useState<RolesData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<RolesData>("/api/roles")
      .then((res) => {
        setData(res);
        setDrafts(Object.fromEntries(res.roles.map((r) => [r.id, new Set(r.permissionKeys)])));
      })
      .catch(() => setData({ permissions: [], roles: [] }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => (data ? groupByModule(data.permissions) : []), [data]);

  const isDirty = (role: RoleRow) => {
    const draft = drafts[role.id];
    if (!draft) return false;
    if (draft.size !== role.permissionKeys.length) return true;
    return role.permissionKeys.some((k) => !draft.has(k));
  };

  const toggle = (role: RoleRow, key: string) => {
    if (role.name === "owner") return;
    setDrafts((prev) => {
      const next = new Set(prev[role.id]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [role.id]: next };
    });
  };

  const save = async (role: RoleRow) => {
    setSavingRoleId(role.id);
    try {
      const res = await api.patch<RolesData>(`/api/roles/${role.id}/permissions`, {
        permissionKeys: [...(drafts[role.id] ?? [])],
      });
      setData(res);
      setDrafts(Object.fromEntries(res.roles.map((r) => [r.id, new Set(r.permissionKeys)])));
      toast.success(`${role.label}'s permissions updated.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save permissions.");
    } finally {
      setSavingRoleId(null);
    }
  };

  if (data === null) return <SkeletonRows rows={8} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Roles &amp; Permissions</h1>
        <p className="mt-1 text-sm text-muted">
          Toggle which permissions each role has. Changes take effect immediately for anyone with that role, on
          their next action — no re-login needed.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Permission matrix"
          subtitle="The owner role always has every permission and can't be edited here."
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-2/60 text-left">
                <th className="px-5 py-3 font-medium text-muted">Permission</th>
                {data.roles.map((role) => (
                  <th key={role.id} className="px-3 py-3 text-center font-medium text-muted">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1">
                        {role.name === "owner" && <Lock size={11} />}
                        {role.label}
                      </span>
                      {role.name !== "owner" && isDirty(role) && (
                        <Button size="sm" variant="primary" loading={savingRoleId === role.id} onClick={() => save(role)}>
                          Save
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([module, perms]) => (
                <Fragment key={module}>
                  <tr className="border-b border-border-default bg-surface-2/30">
                    <td colSpan={data.roles.length + 1} className="px-5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
                      {module}
                    </td>
                  </tr>
                  {perms.map((perm) => (
                    <tr key={perm.id} className="border-b border-border-default last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{perm.key}</div>
                        {perm.description && <div className="text-xs text-muted">{perm.description}</div>}
                      </td>
                      {data.roles.map((role) => {
                        const checked = role.name === "owner" ? true : (drafts[role.id]?.has(perm.key) ?? false);
                        return (
                          <td key={role.id} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={role.name === "owner"}
                              onChange={() => toggle(role, perm.key)}
                              className="h-4 w-4 rounded border-border-default accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`${role.label} — ${perm.key}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck size={13} />
        Every change here is logged to the audit trail and raises a high-priority alert.
      </div>
    </div>
  );
}
