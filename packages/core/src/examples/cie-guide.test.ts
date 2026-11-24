import { describe, expect, it } from "vitest";
import { analyse } from "../cie/engine.ts";
import { CIE_GUIDE } from "./cie-guide.ts";

describe("MISC the Cambridge quick reference", () => {
  it.each(CIE_GUIDE.map((s) => [s.title, s.code] as const))("MISC guide section %s has no errors", (_title, code) => {
    expect(
      analyse(code)
        .diagnostics.filter((d) => d.severity === "error")
        .map((d) => d.code),
    ).toEqual([]);
  });
  it("MISC guide titles are unique", () => {
    expect(new Set(CIE_GUIDE.map((s) => s.title)).size).toBe(CIE_GUIDE.length);
  });
});
