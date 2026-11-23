import type { Diagnostic } from "@sudocode/core";
import { describe, expect, it } from "vitest";
import { lineStart, toCodeMirrorDiagnostics, underlineRange } from "./diagnostics-bridge.ts";

const base: Diagnostic = { code: "E-SYN-X", line: 2, column: 1, message: "Oops", hint: "Do this", severity: "error" };

describe("MISC diagnostics to editor underlines", () => {
  it("MISC finds the start of a line", () => {
    expect(lineStart("ab\ncd\nef", 1)).toBe(0);
    expect(lineStart("ab\ncd\nef", 3)).toBe(6);
    expect(lineStart("ab", 9)).toBe(2);
  });
  it("MISC underlines the span when there is one", () => {
    expect(underlineRange("ab\ncd", { ...base, span: { line: 2, column: 2, start: 4, end: 5 } })).toEqual({
      from: 4,
      to: 5,
    });
  });
  it("MISC underlines the whole line when there is no span", () => {
    expect(underlineRange("ab\ncd\nef", base)).toEqual({ from: 3, to: 5 });
  });
  it("MISC never gives an empty range inside a non-empty source", () => {
    expect(underlineRange("ab\n", { ...base, line: 2 })).toEqual({ from: 2, to: 3 });
  });
  it("MISC joins message and hint and turns a fix into an action", () => {
    const [d] = toCodeMirrorDiagnostics("ab\ncd", [
      { ...base, fix: { label: "Write END IF", edits: [{ start: 0, end: 0, replacement: "x" }] } },
    ]);
    expect(d?.message).toBe("Oops Do this");
    expect(d?.actions?.map((a) => a.name)).toEqual(["Write END IF"]);
    expect(d?.severity).toBe("error");
  });
});
