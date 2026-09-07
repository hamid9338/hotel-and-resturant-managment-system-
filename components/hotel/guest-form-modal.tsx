"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

export function GuestFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", cnic: "", email: "", address: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await api.post("/api/guests", {
        ...form,
        cnic: form.cnic || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      });
      toast.success("Guest added");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add guest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Guest"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!form.name || !form.phone} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label required>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label required>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>CNIC</Label>
          <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Modal>
  );
}
