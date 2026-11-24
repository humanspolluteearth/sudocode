// The Python the converter writes should read like Python a student would write (M10 follow-up).
//
// A value is printed as plain `print(x)` or `str(x)` when its type is known to be INTEGER or STRING. Only REAL and
// BOOLEAN need `_show`, because Python prints 2.0 and True where the pseudocode prints 2 and TRUE (SH-03, SH-04). The
// helper is written out only when a program needs it. The expected Python is written by hand from that rule; the
// round-trip tests (roundtrip.test.ts) separately prove that the output behaves the same.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertToPython, type ConvertFrom } from "../../src/converter/index.ts";

const pending = new Set<string>(
  (JSON.parse(readFileSync(new URL("./pending.json", import.meta.url), "utf8")) as { tests: string[] }).tests,
);

const convert = (from: ConvertFrom, source: string): string => {
  const result = convertToPython(source, from);
  if (!result.ok) throw new Error(`refused: ${result.message}`);
  return result.code;
};

/** Pending tests must fail until the feature is written (same rule as the round-trip file). */
function check(id: string, body: () => void): void {
  let failure: unknown = null;
  try {
    body();
  } catch (error) {
    failure = error;
  }
  const key = `converter/${id}`;
  if (pending.has(key)) {
    if (failure === null) expect.fail(`${key} now passes: remove it from pending.json`);
    return;
  }
  if (failure !== null) throw failure as Error;
}

const HEAD = "# Converted from Edexcel pseudocode by Sudocode.\n\n\n";
const noHelper = (code: string): void => {
  expect(code).not.toContain("_show");
  expect(code).not.toContain("# These helpers");
  expect(code).not.toContain("def ");
};

describe("MISC converter: plain Python when the types are known", () => {
  it("MISC text-and-integers-only: no helper, no helper comment", () => {
    check("MISC-text-ints-only", () => {
      const code = convert(
        "edexcel",
        "SET name TO 'Amira'\nSET mark TO 64\nSEND name & ' scored ' & mark TO DISPLAY\nSEND mark + 1 TO DISPLAY\nSEND mark TO DISPLAY\n",
      );
      expect(code).toBe(
        `${HEAD}name = "Amira"\nmark = 64\nprint(name + " scored " + str(mark))\nprint(mark + 1)\nprint(mark)\n`,
      );
    });
  });

  it("MISC integer arithmetic prints directly, DIV and MOD included", () => {
    check("MISC-text-int-arithmetic", () => {
      const code = convert("edexcel", "SEND 7 DIV 2 TO DISPLAY\nSEND 7 MOD 2 TO DISPLAY\nSEND 3 * 4 - 1 TO DISPLAY\n");
      expect(code).toBe(`${HEAD}print(7 // 2)\nprint(7 % 2)\nprint(3 * 4 - 1)\n`);
    });
  });

  it("MISC an INTEGER input and a loop counter are integers", () => {
    check("MISC-text-input-and-counter", () => {
      const code = convert(
        "edexcel",
        "RECEIVE n FROM (INTEGER) KEYBOARD\nFOR i FROM 1 TO n DO\n    SEND i * 2 TO DISPLAY\nEND FOR\nSEND n TO DISPLAY\n",
      );
      expect(code).toBe(`${HEAD}n = int(input())\nfor i in range(1, n + 1):\n    print(i * 2)\nprint(n)\n`);
    });
  });

  it("MISC a STRING input needs no conversion to print", () => {
    check("MISC-text-string-input", () => {
      const code = convert("edexcel", "RECEIVE word FROM (STRING) KEYBOARD\nSEND word & '!' TO DISPLAY\n");
      expect(code).toBe(`${HEAD}word = input()\nprint(word + "!")\n`);
    });
  });

  it("MISC FOR EACH over a list of integers gives integers", () => {
    check("MISC-text-for-each", () => {
      const code = convert(
        "edexcel",
        "SET nums TO [3, 1, 2]\nFOR EACH n FROM nums DO\n    SEND n + 1 TO DISPLAY\nEND FOREACH\n",
      );
      expect(code).toBe(`${HEAD}nums = [3, 1, 2]\nfor n in nums:\n    print(n + 1)\n`);
    });
  });

  it("MISC an INTEGER function result and its argument are integers (Cambridge)", () => {
    check("MISC-text-function", () => {
      const code = convert(
        "cie",
        "FUNCTION double(x : INTEGER) RETURNS INTEGER\n  RETURN x * 2\nENDFUNCTION\nOUTPUT double(4)\n",
      );
      noHelper(code.replace(/def double\(x\):\n {4}return x \* 2/, ""));
      expect(code).toContain("print(double(4))");
    });
  });

  it("MISC a join of a STRING and an INTEGER uses str() on the integer only", () => {
    check("MISC-text-join", () => {
      const code = convert("edexcel", "SET n TO 5\nSEND 'n is ' & n & '.' TO DISPLAY\n");
      expect(code).toBe(`${HEAD}n = 5\nprint("n is " + str(n) + ".")\n`);
    });
  });

  it("MISC the length of a list and a character code are integers", () => {
    check("MISC-text-builtins", () => {
      const code = convert("edexcel", "SET a TO [1, 2]\nSEND LENGTH(a) TO DISPLAY\nSEND 'abc' & 1 TO DISPLAY\n");
      expect(code).toBe(`${HEAD}a = [1, 2]\nprint(len(a))\nprint("abc" + str(1))\n`);
    });
  });
});

describe("MISC converter: REAL and BOOLEAN still go through _show, and the helper is written once", () => {
  it("SH-03 a REAL variable is printed with _show", () => {
    const code = convert("edexcel", "SET x TO 2.5\nSEND x TO DISPLAY\n");
    expect(code).toContain("print(_show(x))");
    expect(code.match(/def _show\(/g)).toHaveLength(1);
    expect(code).toContain("# These helpers");
  });

  it("SH-03 a real division is printed with _show even when both sides are integers", () => {
    const code = convert("edexcel", "SEND 6 / 2 TO DISPLAY\n");
    expect(code).toContain("print(_show(6 / 2))");
  });

  it("SH-04 a BOOLEAN is printed with _show", () => {
    const code = convert("edexcel", "SET ok TO 3 > 2\nSEND ok TO DISPLAY\n");
    expect(code).toContain("print(_show(ok))");
    expect(code.match(/def _show\(/g)).toHaveLength(1);
  });

  it("SH-03 in a join only the REAL piece uses _show", () => {
    check("MISC-text-join-real", () => {
      const code = convert("edexcel", "SET r TO 1.5\nSET n TO 2\nSEND n & ' ' & r TO DISPLAY\n");
      expect(code).toContain('print(str(n) + " " + _show(r))');
    });
  });

  it("SH-03 a REAL variable given an integer value is still REAL (Cambridge)", () => {
    const code = convert("cie", "DECLARE r : REAL\nr ← 1\nOUTPUT r\n");
    expect(code).toContain("print(_show(r))");
  });

  it("SH-03 a REAL parameter is printed with _show (Cambridge)", () => {
    const code = convert("cie", "PROCEDURE show(x : REAL)\n  OUTPUT x\nENDPROCEDURE\nCALL show(1.5)\n");
    expect(code).toContain("print(_show(x))");
  });
});
