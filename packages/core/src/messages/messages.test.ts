import { describe, expect, it } from "vitest";
import { isDiagnosticCode, severityOf } from "../diagnostics.ts";
import { LANGUAGES } from "../language.ts";
import { catalogueEntry, formatMessage, makeDiagnostic, MESSAGES, placeholders } from "./index.ts";

const span = { line: 3, column: 12, start: 40, end: 41 };
const entries = Object.entries(MESSAGES);

describe("MISC the message catalogue", () => {
  it("MISC has entries for every stage", () => {
    const prefixes = new Set(
      Object.keys(MESSAGES).map((c) => /^(E-SYN|E-CHK|E-RUN|E-PY|E-INTERNAL|W|I)-/.exec(c)?.[1]),
    );
    expect([...prefixes].sort()).toEqual(["E-CHK", "E-INTERNAL", "E-PY", "E-RUN", "E-SYN", "I", "W"]);
  });

  it.each(entries.map(([code, e]) => [code, e] as const))("MISC %s follows the style rules", (code, entry) => {
    expect(isDiagnosticCode(code)).toBe(true);
    const templates = [entry.default, ...Object.values(entry.languages ?? {}), ...Object.values(entry.variants ?? {})];
    for (const t of templates) {
      if (t.message !== undefined) {
        expect(t.message.length).toBeGreaterThan(0);
        expect(t.message).not.toMatch(/\.$/); // one plain sentence, no final full stop
      }
      if (t.hint !== undefined && !/^\{[a-z]+\}$/.test(t.hint)) expect(t.hint).toMatch(/[.?!]$/);
      for (const text of [t.message, t.hint, t.fix]) expect(text ?? "").not.toMatch(/simulator/i);
    }
  });
});

describe("MISC formatting messages", () => {
  it("MISC fills placeholders from the arguments", () => {
    expect(formatMessage("E-RUN-NO-VALUE", "cie", { name: "Total" })).toEqual({
      message: "Total has no value yet",
      hint: "Give it a value first, e.g. with an assignment or INPUT.",
    });
  });

  it("MISC uses the language's own wording where it has one", () => {
    const args = { word: "PRINT", official: "SEND <value> TO DISPLAY" };
    expect(formatMessage("E-SYN-OTHER-LANGUAGE", "edexcel", args).message).toBe("PRINT is not an Edexcel statement");
    expect(formatMessage("E-SYN-OTHER-LANGUAGE", "cie", { ...args, official: "OUTPUT" })).toEqual({
      message: "PRINT is not Cambridge pseudocode",
      hint: "Cambridge pseudocode uses OUTPUT.",
    });
    expect(formatMessage("E-SYN-OTHER-LANGUAGE", "python", args).message).toBe("PRINT is not part of this language");
  });

  it("MISC a named variant wins over the default (Q11: UCASE given a STRING)", () => {
    const args = { function: "UCASE", expected: "CHAR", argument: "Word", actual: "STRING", alternative: "TO_UPPER" };
    expect(formatMessage("E-CHK-ARG-TYPE", "cie", args, "use-to-upper")).toEqual({
      message: "UCASE needs a CHAR here, but Word is a STRING",
      hint: "For a whole STRING use TO_UPPER(Word).",
    });
  });

  it("MISC includes the fix label when the code offers one", () => {
    expect(formatMessage("W-EDX-ENDIF", "edexcel").fix).toBe("Write END IF");
    expect(formatMessage("E-RUN-STEP-ZERO", "edexcel").fix).toBeUndefined();
  });

  it("MISC refuses to build a message with a missing argument", () => {
    expect(() => formatMessage("E-RUN-NO-VALUE", "cie", {})).toThrow("E-RUN-NO-VALUE: missing message argument {name}");
  });

  it("MISC refuses unknown codes and unknown variants", () => {
    expect(() => formatMessage("E-RUN-NOT-A-CODE", "cie")).toThrow("No message for diagnostic code E-RUN-NOT-A-CODE");
    expect(() => formatMessage("E-RUN-NO-VALUE", "cie", { name: "x" }, "nope")).toThrow('no message variant "nope"');
  });

  it("MISC keeps CPython's exception name and message, even for exceptions not in the catalogue", () => {
    const detail = 'can only concatenate str (not "float") to str';
    expect(formatMessage("E-PY-TypeError", "python", { detail }).message).toBe(`TypeError: ${detail}`);
    expect(formatMessage("E-PY-OverflowError", "python", { detail: "math range error" }).message).toBe(
      "OverflowError: math range error",
    );
    expect(catalogueEntry("E-PY-OverflowError").spec).toEqual(["PY-03"]);
  });

  it("MISC every catalogue entry can be formatted in every language when given its arguments", () => {
    for (const [code, entry] of entries) {
      const templates = [
        entry.default,
        ...Object.values(entry.languages ?? {}),
        ...Object.values(entry.variants ?? {}),
      ];
      const names = templates.flatMap((t) => [t.message, t.hint, t.fix].flatMap((s) => placeholders(s ?? "")));
      const args = Object.fromEntries(names.map((n) => [n, `<${n}>`]));
      for (const language of LANGUAGES) {
        expect(() => formatMessage(code, language, args)).not.toThrow();
      }
      for (const variant of Object.keys(entry.variants ?? {})) {
        expect(formatMessage(code, "cie", args, variant).message).not.toMatch(/\{/);
      }
    }
  });
});

describe("MISC making diagnostics", () => {
  it("MISC takes the position from the span, the words from the catalogue and the severity from the code", () => {
    expect(makeDiagnostic({ code: "W-EDX-ENDIF", language: "edexcel", span })).toEqual({
      code: "W-EDX-ENDIF",
      line: 3,
      column: 12,
      message: "ENDIF is written as two words in Edexcel",
      hint: "Write END IF.",
      severity: "warning",
      span,
    });
    expect(severityOf("I-EDX-GLOBAL-UPDATE")).toBe("info");
  });

  it("MISC attaches a fix only when edits are given", () => {
    const edits = [{ start: 40, end: 45, replacement: "END IF" }];
    expect(makeDiagnostic({ code: "W-EDX-ENDIF", language: "edexcel", span, edits }).fix).toEqual({
      label: "Write END IF",
      edits,
    });
    expect(makeDiagnostic({ code: "E-RUN-STEP-ZERO", language: "edexcel", span, edits }).fix).toBeUndefined();
  });
});

// Hints the spec itself requires. Named MISC: the catalogue isn't the rule; real checker tests (M2+) prove it.
describe("MISC hints the spec requires", () => {
  it.each([
    ["E-CHK-SEND-ARRAY", "edexcel", { name: "Scores" }, /FOR EACH/], // EDX-75
    ["E-CHK-SEND-COMMA", "edexcel", {}, /Join values with &/], // EDX-71
    ["E-CHK-BARE-ASSIGN", "edexcel", { name: "x", value: "5" }, /^Write SET x TO 5\.$/], // EDX-33
    ["E-CHK-CONCAT-NUMBER", "cie", { value: "N", type: "INTEGER" }, /NUM_TO_STR/], // CIE-45
    ["E-RUN-FILE-NOT-FOUND", "cie", { file: '"d.dat"' }, /OPENFILE "d\.dat" FOR WRITE/], // CIE-97
    ["E-CHK-RECEIVE-NO-TYPE", "edexcel", { name: "x" }, /FROM \(INTEGER\) KEYBOARD/], // EDX-73
  ] as const)("MISC %s (%s) hint", (code, language, args, pattern) => {
    expect(formatMessage(code, language, args).hint).toMatch(pattern);
  });

  it("MISC E-CHK-SEND-ARRAY has WRITE wording for files (EDX-75, QUESTIONS.md 19)", () => {
    expect(formatMessage("E-CHK-SEND-ARRAY", "edexcel", { name: "Scores" }, "write")).toEqual({
      message: "WRITE can't write a whole array to a file",
      hint: "Write each element in a loop: FOR EACH Item FROM Scores DO ... END FOREACH.",
    });
  });
});
