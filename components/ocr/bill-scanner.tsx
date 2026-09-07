"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, ScanLine, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, uploadFile, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PostOcrModal } from "@/components/inventory/post-ocr-modal";

type ExtractedItem = { name: string; qty: string; unit: number; total: number };
type Extracted = {
  vendor: string;
  billNo: string;
  date: string;
  items: ExtractedItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  confidence: number;
  notes: string;
};
type ScanResult = { bill: { id: string }; extracted: Extracted };
type PastBill = {
  id: string;
  billType: string;
  vendor: string | null;
  total: string;
  confidence: number;
  verified: boolean;
  inventoryPosted: boolean;
  items: ExtractedItem[];
  scannedAt: string;
  scannedBy: { name: string };
};

async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const confidenceTone = (c: number): "success" | "warning" | "danger" =>
  c >= 0.8 ? "success" : c >= 0.5 ? "warning" : "danger";

export function BillScanner({ ocrConfigured, currency }: { ocrConfigured: boolean; currency: string }) {
  const toast = useToast();
  const { has } = usePermissions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [billType, setBillType] = useState("PURCHASE");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [form, setForm] = useState<Extracted | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PastBill[] | null>(null);
  const [posting, setPosting] = useState<PastBill | null>(null);

  const loadHistory = () =>
    api
      .get<PastBill[]>("/api/ocr/bills")
      .then(setHistory)
      .catch(() => setHistory([]));

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFile = async (file: File) => {
    setResult(null);
    setForm(null);
    setScanning(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const { url } = await uploadFile<{ url: string }>("/api/ocr/upload", formData);
      const scanned = await api.post<ScanResult>("/api/ocr/scan", { billType, imageUrl: url });
      setResult(scanned);
      setForm(scanned.extracted);
      toast.success("Bill scanned — please review before saving");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not scan this bill.");
    } finally {
      setScanning(false);
    }
  };

  const save = async (verify: boolean) => {
    if (!result || !form) return;
    setSaving(true);
    try {
      await api.patch(`/api/ocr/bills/${result.bill.id}`, {
        vendor: form.vendor,
        billNo: form.billNo,
        billDate: form.date,
        items: form.items,
        subtotal: form.subtotal,
        discount: form.discount,
        tax: form.tax,
        total: form.total,
        verified: verify,
      });
      toast.success(verify ? "Bill verified and saved" : "Bill saved as draft");
      setResult(null);
      setForm(null);
      loadHistory();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save this bill.");
    } finally {
      setSaving(false);
    }
  };

  if (!ocrConfigured) {
    return (
      <EmptyState
        icon={ScanLine}
        title="Bill scanner is not configured"
        description="An administrator needs to add an ANTHROPIC_API_KEY environment variable to enable AI bill scanning."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Bill Scanner</h1>

      <Card>
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={billType} onChange={(e) => setBillType(e.target.value)} className="max-w-[180px]">
              <option value="PURCHASE">Purchase Bill</option>
              <option value="SALES">Sales Receipt</option>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="primary" loading={scanning} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Upload & Scan
            </Button>
          </div>

          {form && result && (
            <div className="space-y-4 rounded-lg border border-border-default bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Extracted Result</span>
                <Badge tone={confidenceTone(form.confidence)}>{Math.round(form.confidence * 100)}% confidence</Badge>
              </div>
              {form.confidence < 0.6 && (
                <div className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                  <AlertTriangle size={13} /> Low confidence — check every field carefully before saving.
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Vendor</Label>
                  <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <div>
                  <Label>Bill No.</Label>
                  <Input value={form.billNo} onChange={(e) => setForm({ ...form, billNo: e.target.value })} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input
                    type="number"
                    value={form.total}
                    onChange={(e) => setForm({ ...form, total: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Items</Label>
                <div className="space-y-1.5">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_90px] gap-1.5">
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: form.items.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it)),
                          })
                        }
                      />
                      <Input
                        value={item.qty}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: form.items.map((it, idx) => (idx === i ? { ...it, qty: e.target.value } : it)),
                          })
                        }
                      />
                      <Input
                        type="number"
                        value={item.total}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            items: form.items.map((it, idx) =>
                              idx === i ? { ...it, total: Number(e.target.value) } : it
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" loading={saving} onClick={() => save(false)}>
                  Save as Draft
                </Button>
                {has("ocr.verify") && (
                  <Button variant="primary" loading={saving} onClick={() => save(true)}>
                    <CheckCircle2 size={14} /> Verify & Save
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Scan History" />
        {history === null ? (
          <CardBody>
            <p className="text-sm text-muted">Loading…</p>
          </CardBody>
        ) : history.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No bills scanned yet.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-border-default">
            {history.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{b.vendor || "Unknown vendor"}</div>
                  <div className="text-xs text-muted">
                    {formatDateTime(b.scannedAt)} · {b.scannedBy.name} · {b.billType}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{formatCurrency(Number(b.total), currency)}</span>
                  <Badge tone={b.verified ? "success" : "warning"}>{b.verified ? "Verified" : "Unverified"}</Badge>
                  {b.billType === "PURCHASE" && b.inventoryPosted && <Badge tone="success">Posted</Badge>}
                  {b.billType === "PURCHASE" && b.verified && !b.inventoryPosted && has("inventory.manage") && (
                    <Button size="sm" variant="secondary" onClick={() => setPosting(b)}>
                      Post to Inventory
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {posting && (
        <PostOcrModal
          billId={posting.id}
          items={posting.items}
          onClose={() => setPosting(null)}
          onDone={() => {
            setPosting(null);
            loadHistory();
          }}
        />
      )}
    </div>
  );
}
