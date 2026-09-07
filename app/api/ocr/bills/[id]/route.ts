import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { updateOcrBillSchema } from "@/lib/validation/ocr";
import { recordAudit } from "@/lib/services/audit";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "ocr.verify");
    const input = updateOcrBillSchema.parse(await request.json());
    const { id } = await params;

    const bill = await prisma.oCRBill.update({
      where: { id },
      data: {
        vendor: input.vendor,
        billNo: input.billNo,
        billDate: input.billDate,
        items: input.items,
        subtotal: input.subtotal,
        discount: input.discount,
        tax: input.tax,
        total: input.total,
        verified: input.verified,
        verifiedById: input.verified ? session.id : undefined,
        verifiedAt: input.verified ? new Date() : undefined,
      },
    });

    if (input.verified) {
      await recordAudit({
        session,
        action: `Bill #${bill.id.slice(0, 8)} verified`,
        module: "OCR",
        entityType: "OCRBill",
        entityId: bill.id,
      });
    }

    return ok(bill);
  } catch (err) {
    return handleRouteError(err);
  }
}
