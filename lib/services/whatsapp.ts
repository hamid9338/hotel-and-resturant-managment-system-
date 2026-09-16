import "server-only";

const WHATSAPP_API_VERSION = "v21.0";

/**
 * Guest phones are stored in local Pakistani format (e.g. "0300-9999999");
 * the WhatsApp Cloud API needs E.164 without a leading 0 or "+" (e.g.
 * "923009999999"). Returns null — surfaced as a per-recipient FAILED row
 * with a clear reason, never a silent mis-send — for anything that doesn't
 * clearly match a Pakistani mobile number shape.
 */
export function normalizePakistaniPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // Every Pakistani mobile number starts with 3 after the leading trunk code
  // (0) or country code (92) — landlines use other area codes (e.g. 021),
  // which this deliberately rejects rather than passing through to WhatsApp's
  // API and getting a less clear failure back.
  if (digits.length === 11 && digits.startsWith("03")) return `92${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("923")) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return null;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type WhatsAppSendResult = { ok: true } | { ok: false; error: string };

/**
 * A business-initiated message outside a guest's 24-hour service window
 * (which an announcement/offer always is) must use a template already
 * approved in Meta Business Manager — free-form text is rejected by the
 * platform itself, not a limitation here. `toPhone` must already be
 * normalized (see normalizePakistaniPhone above) before calling this.
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  templateName: string,
  variables: string[]
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp is not configured (missing WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components:
            variables.length > 0
              ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
              : [],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error?.message ?? `WhatsApp API returned ${res.status}.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the WhatsApp API." };
  }
}
