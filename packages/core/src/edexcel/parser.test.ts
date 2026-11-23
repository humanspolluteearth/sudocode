import { describe, expect, it } from "vitest";
import type { Expr, Stmt } from "./ast.ts";
import { parse } from "./parser.ts";

/** An expression as a fully bracketed string, to show how the parser grouped it. */
function show(e: Expr): string {
  switch (e.kind) {
    case "int":
    case "real":
      return e.text;
    case "string":
      return `'${e.value}'`;
    case "bool":
      return e.value ? "TRUE" : "FALSE";
    case "name":
      return e.name;
    case "paren":
      return show(e.inner);
    case "binary":
      return `(${show(e.left)} ${e.op} ${show(e.right)})`;
    case "unary":
      return `(${e.op === "-" ? "-" : "NOT "}${show(e.operand)})`;
    case "index":
      return `${show(e.target)}[${show(e.index)}]`;
    case "array":
      return `[${e.elements.map(show).join(", ")}]`;
    case "call":
      return `${e.name}(${e.args.map(show).join(", ")})`;
  }
}

const sent = (source: string): string => {
  const s = parse(`SEND ${source} TO DISPLAY`).program.body[0];
  if (s?.kind !== "send") throw new Error("not a SEND");
  return show(s.values[0] as Expr);
};

/** The statement kinds, nested: "if[send|send]" */
function shape(stmts: readonly Stmt[]): string {
  return stmts
    .map((s) => {
      switch (s.kind) {
        case "if":
          return `if[${shape(s.then)}|${shape(s.else)}]`;
        case "while":
        case "repeatUntil":
        case "repeatTimes":
        case "for":
        case "forEach":
          return `${s.kind}[${shape(s.body)}]`;
        default:
          return s.kind;
      }
    })
    .join(",");
}

const errors = (source: string): string[] =>
  parse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("EDX-34 operator precedence (Pratt parsing)", () => {
  it.each([
    ["2 + 3 * 4", "(2 + (3 * 4))"],
    ["(2 + 3) * 4", "((2 + 3) * 4)"],
    ["10 - 3 - 2", "((10 - 3) - 2)"],
    ["100 / 10 / 2", "((100 / 10) / 2)"],
    ["2 * 3 MOD 4", "((2 * 3) MOD 4)"],
    ["7 DIV 2 * 2", "((7 DIV 2) * 2)"],
    ["2 ^ 3 ^ 2", "(2 ^ (3 ^ 2))"],
    ["-2 ^ 2", "(-(2 ^ 2))"],
    ["2 ^ -1", "(2 ^ (-1))"],
    ["2 * -3", "(2 * (-3))"],
    ["-7 DIV 2", "((-7) DIV 2)"],
    ["'Total: ' & 3 + 4", "('Total: ' & (3 + 4))"],
    ["1 + 2 = 3", "((1 + 2) = 3)"],
    ["NOT 1 = 2", "(NOT (1 = 2))"],
    ["NOT TRUE AND FALSE", "((NOT TRUE) AND FALSE)"],
    ["TRUE OR FALSE AND FALSE", "(TRUE OR (FALSE AND FALSE))"],
    ["a < b AND c >= d OR NOT e", "(((a < b) AND (c >= d)) OR (NOT e))"],
    ["Scores[i + 1] * 2", "(Scores[(i + 1)] * 2)"],
    ["LENGTH(x) - 1", "(LENGTH(x) - 1)"],
    ["[1, 2 + 3][0]", "[1, (2 + 3)][0]"],
  ])("EDX-34 %s groups as %s", (source, grouped) => {
    expect(sent(source)).toBe(grouped);
  });

  it("EDX-05 lowercase operator keywords work the same, with a warning each", () => {
    expect(sent("a mod 2 = 1 and not b")).toBe("(((a MOD 2) = 1) AND (NOT b))");
    expect(errors("SEND a mod 2 = 1 and not b TO DISPLAY")).toEqual([
      "W-LOWERCASE-KEYWORD 1:8",
      "W-LOWERCASE-KEYWORD 1:18",
      "W-LOWERCASE-KEYWORD 1:22",
    ]);
  });

  it("EDX-08 TRUE and FALSE in any case are literals, with no warning", () => {
    expect(sent("true OR False")).toBe("(TRUE OR FALSE)");
    expect(errors("SEND true OR False TO DISPLAY")).toEqual([]);
  });
});

describe("EDX-40 to EDX-58 statements and blocks", () => {
  it("EDX-41 nested blocks each with their own closer", () => {
    const source = [
      "IF a THEN",
      "  WHILE b DO",
      "    SET x TO 1",
      "  END WHILE",
      "ELSE",
      "  FOR i FROM 1 TO 3 DO",
      "    SEND i TO DISPLAY",
      "  END FOR",
      "END IF",
    ].join("\n");
    expect(shape(parse(source).program.body)).toBe("if[while[set]|for[send]]");
    expect(errors(source)).toEqual([]);
  });

  it("EDX-42 an ELSE IF chain becomes nested IFs closed by one END IF", () => {
    const source = ["IF a THEN", "  SET x TO 1", "ELSE IF b THEN", "  SET x TO 2", "ELSE", "  SET x TO 3", "END IF"];
    expect(shape(parse(source.join("\n")).program.body)).toBe("if[set|if[set|set]]");
    expect(errors(source.join("\n"))).toEqual(["W-EDX-ELSE-IF 3:1"]);
  });

  it("EDX-51 and EDX-52 REPEAT alone is REPEAT ... UNTIL; REPEAT n TIMES counts", () => {
    const source = ["REPEAT", "  SET x TO 1", "UNTIL x = 1", "REPEAT 3 TIMES", "  SET x TO 2", "END REPEAT"];
    expect(shape(parse(source.join("\n")).program.body)).toBe("repeatUntil[set],repeatTimes[set]");
  });

  it("EDX-57 and EDX-58 FOR EACH, FOREACH and END FOR EACH are the same loop", () => {
    const source = ["FOREACH c FROM s DO", "  SEND c TO DISPLAY", "END FOR EACH"];
    expect(shape(parse(source.join("\n")).program.body)).toBe("forEach[send]");
    expect(errors(source.join("\n"))).toEqual(["W-EDX-FOREACH 1:1", "W-EDX-FOREACH 3:1"]);
  });

  it("EDX-54 FOR with STEP keeps the step expression", () => {
    const s = parse("FOR i FROM 10 TO 1 STEP -3 DO\nEND FOR").program.body[0];
    expect(s?.kind === "for" ? [show(s.start), show(s.end), s.step === null ? "none" : show(s.step)] : []).toEqual([
      "10",
      "1",
      "(-3)",
    ]);
  });

  it("EDX-71 SEND keeps every value and the first comma, for the checker", () => {
    const s = parse("SEND 1, 2, 3 TO DISPLAY").program.body[0];
    expect(s?.kind === "send" ? [s.values.length, s.comma?.column] : []).toEqual([3, 7]);
  });

  it("EDX-33 and D2 `end = x` is a bare assignment to a name called end, not a closer", () => {
    expect(shape(parse("end = 5").program.body)).toBe("bareAssign");
    expect(errors("SET end TO 1\nSEND end TO DISPLAY")).toEqual([]);
  });

  it("EDX-10 and Q7 SEND to another device keeps its name; display in any case is DISPLAY", () => {
    const devices = parse("SEND 1 TO MOTOR\nSEND 2 TO display").program.body.map((s) =>
      s.kind === "send" ? s.device : "",
    );
    expect(devices).toEqual(["MOTOR", "DISPLAY"]);
  });

  it("EDX-17 CONST takes a type and a name", () => {
    const s = parse("CONST real Rate").program.body[0];
    expect(s?.kind === "const" ? [s.type, s.name] : []).toEqual(["REAL", "Rate"]);
  });
});

describe("SH-15 and D8 panic-mode recovery", () => {
  it("SH-15 reports one error per broken line and keeps parsing", () => {
    expect(errors("SET x 5\nSEND x TO\nSET y TO 2")).toEqual(["E-SYN-EXPECTED 1:7", "E-SYN-EXPECTED 2:10"]);
    expect(shape(parse("SET x 5\nSEND x TO\nSET y TO 2").program.body)).toBe("set");
  });

  it("D8 a block whose first line is broken still counts as open, so its closer matches", () => {
    expect(errors("IF x >\n  SET y TO 1\nEND IF")).toEqual(["E-SYN-LINE-ENDS-EARLY 1:7"]);
  });

  it("D8 a closer for an outer block closes the inner ones with a single error", () => {
    expect(errors("WHILE a DO\n  IF b THEN\n    FOR i FROM 1 TO 2 DO\nEND WHILE")).toEqual(["E-SYN-WRONG-CLOSER 4:1"]);
  });

  it("D8 every block still open at the end is reported at its opener", () => {
    expect(errors("WHILE a DO\n  IF b THEN\n    SET x TO 1")).toEqual([
      "E-SYN-BLOCK-NOT-CLOSED 2:3",
      "E-SYN-BLOCK-NOT-CLOSED 1:1",
    ]);
  });

  it("D8 an unclosed ELSE IF chain is reported once, at its first IF", () => {
    expect(errors("IF a THEN\nELSE IF b THEN\n  SET x TO 1")).toEqual([
      "W-EDX-ELSE-IF 2:1",
      "E-SYN-BLOCK-NOT-CLOSED 1:1",
    ]);
  });

  it("SH-15 a missing block offers a fix that adds its closer", () => {
    const d = parse("IF a THEN\n  SET x TO 1").diagnostics[0];
    expect([d?.code, d?.fix?.label, d?.fix?.edits]).toEqual([
      "E-SYN-BLOCK-NOT-CLOSED",
      "Add END IF",
      [{ start: 22, end: 22, replacement: "\nEND IF\n" }],
    ]);
  });

  it("SH-18 subprograms, input and files are recognised as not supported yet (they arrive after M2)", () => {
    const source = "PROCEDURE Hi()\nBEGIN PROCEDURE\n  SEND 'hi' TO DISPLAY\nEND PROCEDURE";
    expect(errors(source)).toEqual(["E-SYN-NOT-SUPPORTED 1:1"]);
  });

  it("MISC an upper-case keyword can't be a name", () => {
    expect(errors("SET WHILE TO 5")).toEqual(["E-SYN-KEYWORD-AS-NAME 1:5"]);
  });

  it("MISC every token of the program is a whole number of statements: nothing is left over", () => {
    expect(() => parse("SET x TO (1 + \n2)\nIF\nEND\nUNTIL\n]]]\n").program).not.toThrow();
  });
});
