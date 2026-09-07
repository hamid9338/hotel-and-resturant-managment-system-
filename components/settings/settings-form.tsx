"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { SkeletonRows } from "@/components/ui/skeleton";

type Settings = {
  businessName: string;
  currency: string;
  timezone: string;
  taxRatePct: string;
  serviceChargePct: string;
  invoicePrefix: string;
  ocrConfigured: boolean;
};

const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "SAR", "AED"];

export function SettingsForm() {
  const toast = useToast();
  const { has } = usePermissions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/api/settings")
      .then(setSettings)
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch("/api/settings", {
        businessName: settings.businessName,
        currency: settings.currency,
        timezone: settings.timezone,
        taxRatePct: Number(settings.taxRatePct),
        serviceChargePct: Number(settings.serviceChargePct),
        invoicePrefix: settings.invoicePrefix,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <SkeletonRows rows={4} />;
  const readOnly = !has("settings.edit");

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader title="Business" subtitle="Shown throughout the app and on printed receipts" />
        <CardBody className="space-y-3">
          <div>
            <Label>Business Name</Label>
            <Input
              disabled={readOnly}
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Currency</Label>
              <Select
                disabled={readOnly}
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input
                disabled={readOnly}
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              />
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Billing" />
        <CardBody className="grid grid-cols-3 gap-3">
          <div>
            <Label>Tax Rate %</Label>
            <Input
              disabled={readOnly}
              type="number"
              value={settings.taxRatePct}
              onChange={(e) => setSettings({ ...settings, taxRatePct: e.target.value })}
            />
          </div>
          <div>
            <Label>Service Charge %</Label>
            <Input
              disabled={readOnly}
              type="number"
              value={settings.serviceChargePct}
              onChange={(e) => setSettings({ ...settings, serviceChargePct: e.target.value })}
            />
          </div>
          <div>
            <Label>Invoice Prefix</Label>
            <Input
              disabled={readOnly}
              value={settings.invoicePrefix}
              onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="AI / OCR" />
        <CardBody>
          <p className="text-sm text-muted">
            Bill scanner:{" "}
            <span className={settings.ocrConfigured ? "text-success" : "text-danger"}>
              {settings.ocrConfigured ? "Configured" : "Not configured"}
            </span>
            {!settings.ocrConfigured && " — add ANTHROPIC_API_KEY to your environment to enable it."}
          </p>
        </CardBody>
      </Card>
      {!readOnly && (
        <Button variant="primary" loading={saving} onClick={save}>
          Save Changes
        </Button>
      )}
    </div>
  );
}
