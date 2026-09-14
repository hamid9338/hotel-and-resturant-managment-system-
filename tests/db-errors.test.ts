import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { withDbFallback, DbUnreachableError } from "@/lib/db-errors";
import { AppError } from "@/lib/api/respond";

const UNREACHABLE_CODES = ["P1000", "P1001", "P1002", "P1008", "P1009", "P1010", "P1011", "P1017"];

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("simulated failure", { code, clientVersion: "test" });
}

describe("withDbFallback", () => {
  it.each(UNREACHABLE_CODES)("classifies Prisma error code %s as DbUnreachableError", async (code) => {
    await expect(
      withDbFallback(() => {
        throw knownRequestError(code);
      })
    ).rejects.toBeInstanceOf(DbUnreachableError);
  });

  it("classifies PrismaClientInitializationError as DbUnreachableError", async () => {
    await expect(
      withDbFallback(() => {
        throw new Prisma.PrismaClientInitializationError("could not connect", "test", "P1001");
      })
    ).rejects.toBeInstanceOf(DbUnreachableError);
  });

  it("rethrows a non-connectivity Prisma error unchanged (e.g. a unique-constraint violation)", async () => {
    const notFound = knownRequestError("P2025");
    await expect(
      withDbFallback(() => {
        throw notFound;
      })
    ).rejects.toBe(notFound);
  });

  it("rethrows an application-level rejection unchanged, never swallowing a real rejection", async () => {
    const rejection = new AppError("NOT_FOUND", "Room not found.", 404);
    await expect(
      withDbFallback(() => {
        throw rejection;
      })
    ).rejects.toBe(rejection);
  });

  it("resolves with the run() result when nothing fails", async () => {
    await expect(withDbFallback(async () => "ok")).resolves.toBe("ok");
  });
});
