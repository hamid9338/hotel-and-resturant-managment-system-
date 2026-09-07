"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { ROLES } from "@/lib/roles";

type StaffRow = { id: string; name: string; username: string; shift: string | null; role: { name: string } };

export function StaffFormModal({
  mode,
  staff,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  staff?: StaffRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: staff?.name ?? "",
    username: staff?.username ?? "",
    pin: "",
    roleName: staff?.role.name ?? "waiter",
    shift: staff?.shift ?? "Morning",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "create") {
        await api.post("/api/staff", form);
        toast.success("Staff account created");
      } else {
        await api.patch(`/api/staff/${staff!.id}`, {
          name: form.name,
          roleName: form.roleName,
          shift: form.shift,
          pin: form.pin || undefined,
        });
        toast.success("Staff account updated");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save staff account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={mode === "create" ? "Add Staff" : `Edit ${staff?.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label required>Full Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        {mode === "create" && (
          <div>
            <Label required>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
        )}
        <div>
          <Label required={mode === "create"}>{mode === "create" ? "PIN" : "New PIN (leave blank to keep current)"}</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
          />
        </div>
        <div>
          <Label required>Role</Label>
          <Select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r.name} value={r.name}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Shift</Label>
          <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
            <option>Morning</option>
            <option>Evening</option>
            <option>Night</option>
            <option>Remote</option>
          </Select>
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Modal>
  );
}
