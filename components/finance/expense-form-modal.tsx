"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, uploadFile, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

export function ExpenseFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      let receiptUrl: string | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await uploadFile<{ url: string }>("/api/expenses/receipt-upload", form);
        receiptUrl = uploaded.url;
      }
      await api.post("/api/expenses", {
        category: category.trim(),
        amount: Number(amount),
        method,
        notes: notes.trim() || undefined,
        receiptUrl,
      });
      toast.success("Expense logged");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not log expense.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Log Expense"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!category.trim() || !(Number(amount) > 0)} onClick={submit}>
            Log Expense
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Utilities, Repairs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="EASYPAISA">Easypaisa</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="BANK">Bank</option>
              <option value="CARD">Card</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <Label>Receipt (optional)</Label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-muted"
          />
        </div>
      </div>
    </Modal>
  );
}
