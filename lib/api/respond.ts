import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/permissions";

/** Thrown by service functions for expected, user-facing failures. */
export class AppError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Central error → HTTP response mapping for route handlers' catch blocks. */
export function handleRouteError(err: unknown) {
  if (err instanceof UnauthenticatedError) {
    return fail("UNAUTHENTICATED", "Please sign in.", 401);
  }
  if (err instanceof ForbiddenError) {
    return fail("FORBIDDEN", err.message, 403);
  }
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.status);
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join("; ");
    return fail("VALIDATION_ERROR", message || "Invalid input.", 422);
  }
  console.error(err);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
