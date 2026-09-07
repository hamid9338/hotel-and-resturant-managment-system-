"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AiSummaryPanel({ period }: { period: string; currency: string }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ narrative: string }>("/api/reports/ai-summary", { period });
      setNarrative(res.narrative);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate an AI summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="AI Summary"
        subtitle="Uses a small amount of AI credit per generation"
        action={
          <Button size="sm" variant="secondary" loading={loading} onClick={generate}>
            <Sparkles size={13} /> Generate AI Forecast
          </Button>
        }
      />
      <CardBody>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!error && !narrative && <p className="text-sm text-muted">Click Generate to get an AI-written summary of this period.</p>}
        {narrative && (
          <div>
            <p className="text-sm leading-relaxed">{narrative}</p>
            <p className="mt-3 text-xs text-muted-2">AI-generated — verify important figures independently.</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
