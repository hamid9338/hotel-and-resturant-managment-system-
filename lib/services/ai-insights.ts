import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { getDashboardSummary, rangeForPeriod } from "@/lib/services/reports";
import type { SessionUser } from "@/lib/auth/session";

const COOLDOWN_MS = 5 * 60 * 1000;

// A trivial duplicate of lib/services/ocr.ts::isOcrConfigured's check rather
// than a rename/reuse — that function name is OCR-flavored and this feature
// has nothing to do with OCR; the coupling isn't worth avoiding one line.
function isAiInsightsConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * On-demand only — never called automatically. Checks the cooldown first,
 * before touching ANTHROPIC_API_KEY or the network, so that path is fully
 * testable without a real key. The cooldown is global (SystemSetting, not
 * per-user/in-memory): the concern is total API spend for the business, and
 * a serverless instance isn't reliably warm-reused between requests anyway.
 */
export async function generateReportNarrative(session: SessionUser, period: string): Promise<{ narrative: string }> {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 }, select: { lastAiNarrativeAt: true } });
  if (settings?.lastAiNarrativeAt && Date.now() - settings.lastAiNarrativeAt.getTime() < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - settings.lastAiNarrativeAt.getTime())) / 1000);
    throw new AppError("AI_NARRATIVE_COOLDOWN", `Please wait ${waitSec}s before generating another AI summary.`, 429);
  }

  if (!isAiInsightsConfigured()) {
    throw new AppError("AI_NOT_CONFIGURED", "AI summaries are not configured. Add ANTHROPIC_API_KEY to enable it.", 503);
  }

  // Re-fetched server-side rather than trusting any client-supplied numbers —
  // both for correctness and to close off a fabricated-JSON prompt-injection
  // vector (the model should only ever see numbers this server computed).
  const summary = await getDashboardSummary(rangeForPeriod(period));

  const prompt = `You are a business analyst for a hotel and restaurant management system. Write a short (3-5 sentence) plain-English summary of the business performance below, highlighting anything notable — strong or weak points, anything that stands out. Be concise and concrete. Do not invent numbers not given below.

Period: ${period}
Hotel revenue: ${summary.hotelRevenue}
Restaurant revenue: ${summary.restaurantRevenue}
Total revenue: ${summary.totalRevenue}
Estimated profit: ${summary.estimatedProfit}
Total bookings: ${summary.totalBookings}
Total orders: ${summary.totalOrders}
Outstanding payments: ${summary.outstandingPayments}
High-risk audit events: ${summary.highRiskActions}
Top menu items: ${summary.topMenuItems.map((i) => `${i.name} (${i.qty})`).join(", ") || "none"}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new AppError("AI_NARRATIVE_FAILED", result?.error?.message || "Could not generate an AI summary.", 502);
  }
  const narrative: string = result.content?.[0]?.text?.trim() ?? "";

  await prisma.systemSetting.update({ where: { id: 1 }, data: { lastAiNarrativeAt: new Date() } });
  await recordAudit({
    session,
    action: `AI report summary generated (${period})`,
    module: "Reports",
    riskLevel: "LOW",
  });

  return { narrative };
}
