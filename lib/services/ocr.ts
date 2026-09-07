import "server-only";
import { AppError } from "@/lib/api/respond";

export type ExtractedBillItem = { name: string; qty: string; unit: number; total: number };
export type ExtractedBill = {
  vendor: string;
  billNo: string;
  date: string;
  rawText: string;
  items: ExtractedBillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  confidence: number;
  notes: string;
};

export function isOcrConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * The only URLs this should ever fetch are ones /api/ocr/upload just handed
 * back to the same authenticated user. Without this check, `imageUrl` is an
 * arbitrary client-supplied string and scanBillWithAI would happily fetch
 * whatever URL a user passed — including internal/private addresses — and
 * feed the response to the Anthropic API (SSRF).
 */
function isTrustedBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const EXTRACTION_PROMPT = (billType: "PURCHASE" | "SALES") => `You are an expert OCR system for a hotel and restaurant management system. Carefully analyze this ${
  billType === "PURCHASE" ? "purchase/supplier bill" : "sales receipt"
}.

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation:
{
  "vendor": "exact vendor/shop name as written",
  "billNo": "invoice or bill number if present, else empty string",
  "date": "date on bill in original format",
  "rawText": "complete transcription of ALL text visible on the bill, preserving layout with \\n",
  "items": [{ "name": "exact item name as written", "qty": "quantity with unit (e.g. 5 kg, 2 dozen, 10 pcs)", "unit": 120, "total": 600 }],
  "subtotal": 0, "discount": 0, "tax": 0, "total": 0,
  "confidence": 0.95,
  "notes": "any warnings or unclear parts"
}

RULES:
- unit and total must be NUMBERS, never strings
- If handwriting is unclear for a value, write your best estimate and lower confidence
- confidence: 0.0 (completely unreadable) to 1.0 (perfectly clear)
- Extract EVERY line item, even partially readable ones`;

/**
 * Server-side only — the Anthropic key never leaves the server, unlike the
 * prototype's client-supplied-key fallback. Callers must check
 * isOcrConfigured() first and render a "not configured" state rather than
 * calling this and surfacing a generic error.
 */
export async function scanBillWithAI(imageUrl: string, billType: "PURCHASE" | "SALES"): Promise<ExtractedBill> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "OCR_NOT_CONFIGURED",
      "The bill scanner is not configured. Add ANTHROPIC_API_KEY to enable it.",
      503
    );
  }

  if (!isTrustedBlobUrl(imageUrl)) {
    throw new AppError("INVALID_IMAGE_URL", "Upload the image through the app first, then scan it.", 400);
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new AppError("IMAGE_FETCH_FAILED", "Could not read the uploaded image.", 502);
  const mediaType = imageRes.headers.get("content-type") || "image/jpeg";
  const imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: EXTRACTION_PROMPT(billType) },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new AppError(
      "OCR_FAILED",
      result?.error?.message || "The bill scanner failed to process this image.",
      502
    );
  }

  const responseText: string = result.content?.[0]?.text ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError("OCR_FAILED", "Could not read a result from the bill scanner.", 502);
    parsed = JSON.parse(match[0]);
  }

  const rawItems = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [];
  const items: ExtractedBillItem[] = rawItems
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      qty: String(item.qty ?? "1"),
      unit: Number(item.unit) || 0,
      total: Number(item.total) || 0,
    }))
    .filter((item) => item.name);

  const subtotal = Number(parsed.subtotal) || items.reduce((s, i) => s + i.total, 0);
  const discount = Number(parsed.discount) || 0;
  const tax = Number(parsed.tax) || 0;
  const total = Number(parsed.total) || subtotal - discount + tax;
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5));

  return {
    vendor: String(parsed.vendor ?? ""),
    billNo: String(parsed.billNo ?? ""),
    date: String(parsed.date ?? ""),
    rawText: String(parsed.rawText ?? ""),
    items,
    subtotal,
    discount,
    tax,
    total,
    confidence,
    notes: String(parsed.notes ?? ""),
  };
}
