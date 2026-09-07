import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { scanBillSchema } from "@/lib/validation/ocr";
import { scanBillWithAI } from "@/lib/services/ocr";
import { recordAudit } from "@/lib/services/audit";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await requirePermission(session, "ocr.scan");
    const input = scanBillSchema.parse(await request.json());

    const extracted = await scanBillWithAI(input.imageUrl, input.billType);

    const bill = await prisma.oCRBill.create({
      data: {
        billType: input.billType,
        vendor: extracted.vendor,
        billNo: extracted.billNo,
        billDate: extracted.date,
        rawText: extracted.rawText,
        items: extracted.items,
        subtotal: extracted.subtotal,
        discount: extracted.discount,
        tax: extracted.tax,
        total: extracted.total,
        confidence: extracted.confidence,
        imagePath: input.imageUrl,
        scannedById: session.id,
      },
    });

    await recordAudit({
      session,
      action: `OCR scan: ${extracted.vendor || "Unknown vendor"} — ${extracted.total}`,
      module: "OCR",
      entityType: "OCRBill",
      entityId: bill.id,
      details: `${extracted.items.length} item(s), confidence ${Math.round(extracted.confidence * 100)}%`,
    });

    return ok({ bill, extracted });
  } catch (err) {
    return handleRouteError(err);
  }
}
