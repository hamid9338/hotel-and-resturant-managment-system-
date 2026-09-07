import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { ok, handleRouteError, AppError } from "@/lib/api/respond";

// Vercel's server-upload path (a route handler receiving the file) caps out
// at a 4.5MB request body. Client-side compression (see the OCR upload
// component) keeps real phone photos under this well before they arrive
// here; going further would mean the direct-to-Blob client-token upload
// flow, which is more moving parts than a bill photo needs for Milestone 1.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "ocr.scan");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AppError("NO_FILE", "No image was uploaded.", 400);
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError("INVALID_FILE_TYPE", "Only JPEG, PNG or WebP images are supported.", 415);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "Image is too large. Please retake or compress it under 4MB.", 413);
    }

    const blob = await put(`ocr-bills/${session.id}-${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: file.type,
    });

    return ok({ url: blob.url });
  } catch (err) {
    return handleRouteError(err);
  }
}
