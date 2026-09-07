"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";

type Supplier = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxInfo: string | null;
};

function SupplierModal({
  supplier,
  onClose,
  onDone,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(supplier?.name ?? "");
  const [company, setCompany] = useState(supplier?.company ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body = { name: name.trim(), company: company.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() };
      if (supplier) {
        await api.patch(`/api/suppliers/${supplier.id}`, body);
      } else {
        await api.post("/api/suppliers", body);
      }
      toast.success(supplier ? "Supplier updated" : "Supplier added");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save supplier.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={supplier ? "Edit Supplier" : "New Supplier"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!name.trim()} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Company</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

export function SuppliersList() {
  const { has } = usePermissions();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [modal, setModal] = useState<{ supplier: Supplier | null } | null>(null);

  const load = useCallback(() => {
    api
      .get<Supplier[]>("/api/suppliers")
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (suppliers === null) return <SkeletonRows rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Suppliers</h1>
        {has("inventory.manage") && (
          <Button variant="primary" onClick={() => setModal({ supplier: null })}>
            + Supplier
          </Button>
        )}
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers yet" description="Add a supplier to start creating purchase orders." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => setModal({ supplier: s })}
              className="rounded-xl border border-border-default bg-surface-1 p-4 text-left transition-colors hover:border-accent-border"
            >
              <div className="font-medium">{s.name}</div>
              {s.company && <div className="text-xs text-muted">{s.company}</div>}
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                {s.phone && <div>{s.phone}</div>}
                {s.email && <div>{s.email}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {modal && (
        <SupplierModal
          supplier={modal.supplier}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
