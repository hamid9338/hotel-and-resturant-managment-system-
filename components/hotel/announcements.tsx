"use client";

import { useEffect, useState } from "react";
import { Send, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Guest = { id: string; name: string; phone: string };
type Recipient = {
  id: string;
  phone: string;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  guest: { id: string; name: string };
};
type AnnouncementDetail = {
  id: string;
  templateName: string;
  createdAt: string;
  recipients: Recipient[];
};

export function Announcements({ whatsappConfigured }: { whatsappConfigured: boolean }) {
  const toast = useToast();
  const [templateName, setTemplateName] = useState("");
  const [variables, setVariables] = useState<string[]>([""]);
  const [audience, setAudience] = useState<"all" | "active">("all");
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState<AnnouncementDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Guest[]>(`/api/guests?audience=${audience}`)
      .then((guests) => {
        if (!cancelled) setGuestCount(guests.length);
      })
      .catch(() => {
        if (!cancelled) setGuestCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  useEffect(() => {
    if (!announcement || announcement.recipients.every((r) => r.status !== "PENDING")) return;
    const timer = setInterval(() => {
      api
        .get<AnnouncementDetail>(`/api/announcements/${announcement.id}`)
        .then(setAnnouncement)
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [announcement]);

  const updateVariable = (index: number, value: string) => {
    setVariables((prev) => prev.map((v, i) => (i === index ? value : v)));
  };
  const addVariable = () => setVariables((prev) => [...prev, ""]);
  const removeVariable = (index: number) => setVariables((prev) => prev.filter((_, i) => i !== index));

  const send = async () => {
    setSending(true);
    try {
      const result = await api.post<AnnouncementDetail>("/api/announcements", {
        templateName: templateName.trim(),
        variables: variables.map((v) => v.trim()).filter(Boolean),
        audience,
      });
      setAnnouncement(result);
      toast.success(`Sending to ${result.recipients.length} guest(s)`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send announcement.");
    } finally {
      setSending(false);
    }
  };

  const sentCount = announcement?.recipients.filter((r) => r.status === "SENT").length ?? 0;
  const failedCount = announcement?.recipients.filter((r) => r.status === "FAILED").length ?? 0;
  const pendingCount = announcement?.recipients.filter((r) => r.status === "PENDING").length ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Announcements</h1>

      {!whatsappConfigured && (
        <Card className="border-warning/30">
          <CardBody>
            <p className="text-sm text-warning">
              WhatsApp isn&apos;t configured — add <code>WHATSAPP_API_TOKEN</code> and{" "}
              <code>WHATSAPP_PHONE_NUMBER_ID</code> as environment variables to enable sending.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Send an update or offer"
          subtitle="Messages use a template already approved in Meta Business Manager — free text isn't allowed for bulk sends."
        />
        <CardBody className="space-y-4">
          <div>
            <Label required>Template name</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. seasonal_offer" />
          </div>

          <div>
            <Label>Template variables</Label>
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={v} onChange={(e) => updateVariable(i, e.target.value)} placeholder={`{{${i + 1}}}`} />
                  <Button variant="ghost" size="sm" onClick={() => removeVariable(i)} disabled={variables.length === 1}>
                    <X size={14} />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addVariable}>
                <Plus size={14} /> Add variable
              </Button>
            </div>
          </div>

          <div>
            <Label>Audience</Label>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "active")}>
              <option value="all">All guests</option>
              <option value="active">Active (reserved or checked in)</option>
            </Select>
            <p className="mt-1.5 text-xs text-muted">
              {guestCount === null ? "Loading guest count…" : `Will reach ${guestCount} guest(s).`}
            </p>
          </div>

          <Button
            variant="primary"
            loading={sending}
            disabled={!whatsappConfigured || !templateName.trim() || !guestCount}
            onClick={send}
          >
            <Send size={14} /> Send announcement
          </Button>
        </CardBody>
      </Card>

      {announcement && (
        <Card>
          <CardHeader
            title={`"${announcement.templateName}" results`}
            action={
              <div className="flex gap-2">
                <Badge tone="success">{sentCount} sent</Badge>
                {failedCount > 0 && <Badge tone="danger">{failedCount} failed</Badge>}
                {pendingCount > 0 && <Badge tone="warning">{pendingCount} pending</Badge>}
              </div>
            }
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-3 py-2">Guest</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {announcement.recipients.map((r) => (
                    <tr key={r.id} className="border-b border-border-default last:border-0">
                      <td className="px-3 py-2">{r.guest.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{r.phone}</td>
                      <td className="px-3 py-2">
                        <Badge tone={r.status === "SENT" ? "success" : r.status === "FAILED" ? "danger" : "warning"}>
                          {r.status}
                        </Badge>
                        {r.error && <span className="ml-2 text-xs text-danger">{r.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
