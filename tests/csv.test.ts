import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("escapeCsvCell", () => {
  it("passes plain values through unchanged", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(42)).toBe("42");
  });
  it("returns an empty string for null or undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
  it("quotes and escapes a value containing a comma", () => {
    expect(escapeCsvCell("Doe, John")).toBe('"Doe, John"');
  });
  it("quotes and doubles internal quotes", () => {
    expect(escapeCsvCell('5" pipe')).toBe('"5"" pipe"');
  });
  it("quotes a value containing an embedded newline", () => {
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("toCsv", () => {
  it("builds a header row and one row per record", () => {
    const csv = toCsv(
      ["Name", "Amount"],
      [
        ["Ali", 100],
        ["Sara", 200],
      ]
    );
    expect(csv).toBe("Name,Amount\r\nAli,100\r\nSara,200");
  });
  it("produces just the header row for an empty input", () => {
    expect(toCsv(["Name"], [])).toBe("Name");
  });
  it("escapes a comma-containing cell within a full row", () => {
    const csv = toCsv(["Guest"], [["Doe, John"]]);
    expect(csv).toBe('Guest\r\n"Doe, John"');
  });
});
