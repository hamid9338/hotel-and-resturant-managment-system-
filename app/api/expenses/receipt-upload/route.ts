import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { ok, handleRouteError, AppError } from "@/lib/api/respond";

// Same 4.5MB server-upload ceiling as app/api/ocr/upload/route.ts, for the
// same reason (Vercel's route-handler request body cap). PDF is allowed here
// (unlike the OCR upload) since a receipt is stored for record-keeping only,
// never fed to a vision model.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.log_expense");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AppError("NO_FILE", "No file was uploaded.", 400);
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError("INVALID_FILE_TYPE", "Only JPEG, PNG, WebP, or PDF files are supported.", 415);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "File is too large. Please keep it under 4MB.", 413);
    }

    const blob = await put(`expense-receipts/${session.id}-${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: file.type,
    });

    return ok({ url: blob.url });
  } catch (err) {
    return handleRouteError(err);
  }
}
