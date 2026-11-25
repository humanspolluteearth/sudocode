// Pseudocode-to-pseudocode converter (docs/language-spec/converter.md, CNV-10..24): the expected text is written by
// hand from the spec rows, never copied from what the converter prints. Every test is pending until the printer for
// its direction is written (pending.json: a pending test that passes fails CI).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convert } from "../../src/converter/index.ts";

const pending = new Set<string>(
  (JSON.parse(readFileSync(new URL("./pending.json", import.meta.url), "utf8")) as { tests: string[] }).tests,
);

type Dir = "edexcel>cie" | "cie>edexcel";
const run = (dir: Dir, source: string) => {
  const [from, to] = dir.split(">") as ["edexcel" | "cie", "edexcel" | "cie"];
  return convert(source, from, to);
};

/** Pending tests must fail until the printer is written. */
function check(id: string, body: () => void): void {
  let failure: unknown = null;
  try {
    body();
  } catch (error) {
    failure = error;
  }
  const key = `converter/text/${id}`;
  if (pending.has(key)) {
    if (failure === null) expect.fail(`${key} now passes: remove it from pending.json`);
    return;
  }
  if (failure !== null) throw failure as Error;
}

const ok = (dir: Dir, source: string): string => {
  const r = run(dir, source);
  if (!r.ok) throw new Error(`refused: ${r.message}`);
  return r.code;
};
const refusal = (dir: Dir, source: string): { line: number; message: string; hint: string } => {
  const r = run(dir, source);
  if (r.ok) throw new Error(`expected a refusal, got:\n${r.code}`);
  return r;
};
const HEAD_CIE = "// Converted from Edexcel pseudocode by Sudocode.\n\n";
const HEAD_EDX = "# Converted from Cambridge pseudocode by Sudocode.\n\n";

describe("CNV-10..16 Edexcel to Cambridge", () => {
  it("CNV-10 every variable is declared with its inferred type, and CNV-11 SEND becomes OUTPUT", () => {
    check("CNV-10", () => {
      expect(
        ok("edexcel>cie", "SET n TO 3\nSET name TO 'Ali'\nSET ok TO TRUE\nSET r TO 1.5\nSEND name TO DISPLAY\n"),
      ).toBe(
        `${HEAD_CIE}DECLARE n : INTEGER\nDECLARE name : STRING\nDECLARE ok : BOOLEAN\nDECLARE r : REAL\nn <- 3\nname <- "Ali"\nok <- TRUE\nr <- 1.5\nOUTPUT name\n`,
      );
    });
  });

  it("CNV-11 RECEIVE becomes INPUT", () => {
    check("CNV-11", () => {
      expect(ok("edexcel>cie", "RECEIVE n FROM (INTEGER) KEYBOARD\nSEND n TO DISPLAY\n")).toBe(
        `${HEAD_CIE}DECLARE n : INTEGER\nINPUT n\nOUTPUT n\n`,
      );
    });
  });

  it("CNV-12 an Edexcel array becomes ARRAY[0:n-1], and a growing array is refused", () => {
    check("CNV-12", () => {
      expect(ok("edexcel>cie", "SET a TO [4, 5, 6]\nSEND a[1] TO DISPLAY\n")).toBe(
        `${HEAD_CIE}DECLARE a : ARRAY[0:2] OF INTEGER\na[0] <- 4\na[1] <- 5\na[2] <- 6\nOUTPUT a[1]\n`,
      );
    });
    check("CNV-12-grow", () => {
      const r = refusal("edexcel>cie", "SET a TO [4, 5, 6]\nSET a[5] TO 9\n");
      expect(r.line).toBe(2);
      expect(r.message).not.toBe("");
      expect(r.hint).not.toBe("");
    });
  });

  it("CNV-13 a number joined with text gets NUM_TO_STR", () => {
    check("CNV-13", () => {
      expect(ok("edexcel>cie", "SET n TO 3\nSEND 'n is ' & n TO DISPLAY\n")).toBe(
        `${HEAD_CIE}DECLARE n : INTEGER\nn <- 3\nOUTPUT "n is " & NUM_TO_STR(n)\n`,
      );
    });
  });

  it("CNV-13 a REAL joined with text is refused", () => {
    check("CNV-13-real", () => {
      const r = refusal("edexcel>cie", "SET r TO 1.5\nSEND 'r is ' & r TO DISPLAY\n");
      expect(r.line).toBe(2);
      expect(r.hint).not.toBe("");
    });
  });

  it("CNV-14 REPEAT n TIMES becomes a FOR over a fresh counter", () => {
    check("CNV-14", () => {
      expect(ok("edexcel>cie", "REPEAT 3 TIMES\n    SEND 'hi' TO DISPLAY\nEND REPEAT\n")).toBe(
        `${HEAD_CIE}DECLARE i_1 : INTEGER\nFOR i_1 <- 1 TO 3\n  OUTPUT "hi"\nNEXT i_1\n`,
      );
    });
  });

  it("CNV-15 RANDOM(n) becomes INT(RAND(n + 1))", () => {
    check("CNV-15", () => {
      expect(ok("edexcel>cie", "SET d TO RANDOM(5)\nSEND d TO DISPLAY\n")).toBe(
        `${HEAD_CIE}DECLARE d : INTEGER\nd <- INT(RAND(5 + 1))\nOUTPUT d\n`,
      );
    });
  });

  it("CNV-08 comments are kept and a name that is a CIE keyword gets a trailing underscore", () => {
    check("CNV-08", () => {
      expect(ok("edexcel>cie", "# the total\nSET output TO 1\nSEND output TO DISPLAY\n")).toBe(
        `${HEAD_CIE}DECLARE output_ : INTEGER\n// the total\noutput_ <- 1\nOUTPUT output_\n`,
      );
    });
  });

  it("CNV-09 classes are refused, naming the line", () => {
    check("CNV-09", () => {
      const source = readFileSync(new URL("../golden/cie/CIE-110-class-counter.cpc", import.meta.url), "utf8");
      const r = refusal("cie>edexcel", source);
      expect(r.message).toMatch(/class/i);
      expect(r.hint).not.toBe("");
    });
  });
});

describe("CNV-20..24 Cambridge to Edexcel", () => {
  it("CNV-20 DECLARE is dropped and OUTPUT becomes SEND", () => {
    check("CNV-20", () => {
      expect(ok("cie>edexcel", 'DECLARE n : INTEGER\nn <- 3\nOUTPUT n\nOUTPUT "n is ", n\n')).toBe(
        `${HEAD_EDX}SET n TO 3\nSEND n TO DISPLAY\nSEND 'n is ' & n TO DISPLAY\n`,
      );
    });
  });

  it("CNV-21 INPUT becomes RECEIVE with the declared type", () => {
    check("CNV-21", () => {
      expect(ok("cie>edexcel", "DECLARE n : INTEGER\nINPUT n\nOUTPUT n\n")).toBe(
        `${HEAD_EDX}RECEIVE n FROM (INTEGER) KEYBOARD\nSEND n TO DISPLAY\n`,
      );
    });
    check("CNV-21-prompt", () => {
      const r = refusal("cie>edexcel", 'DECLARE n : INTEGER\nINPUT "Number? " n\nOUTPUT n\n');
      expect(r.line).toBe(2);
      expect(r.hint).not.toBe("");
    });
  });

  it("CNV-22 an array becomes a filled literal and the indexes shift to start at 0", () => {
    check("CNV-22", () => {
      expect(
        ok(
          "cie>edexcel",
          "DECLARE Scores : ARRAY[1:3] OF INTEGER\nScores[1] <- 7\nScores[3] <- Scores[1] + 1\nOUTPUT Scores[3]\n",
        ),
      ).toBe(
        `${HEAD_EDX}SET Scores TO [0, 0, 0]\nSET Scores[0] TO 7\nSET Scores[2] TO Scores[0] + 1\nSEND Scores[2] TO DISPLAY\n`,
      );
    });
    check("CNV-22-two-dimensions", () => {
      expect(refusal("cie>edexcel", "DECLARE G : ARRAY[1:2, 1:2] OF INTEGER\nG[1, 1] <- 1\n").line).toBe(1);
    });
  });

  it("CNV-23 only LENGTH and RANDOM exist in Edexcel: NUM_TO_STR of an INTEGER is dropped, other builtins are refused", () => {
    check("CNV-23", () => {
      expect(ok("cie>edexcel", 'DECLARE n : INTEGER\nn <- 3\nOUTPUT "n is " & NUM_TO_STR(n)\n')).toBe(
        `${HEAD_EDX}SET n TO 3\nSEND 'n is ' & n TO DISPLAY\n`,
      );
    });
    check("CNV-23-refused", () => {
      const r = refusal("cie>edexcel", 'DECLARE s : STRING\ns <- "ab"\nOUTPUT TO_UPPER(s)\n');
      expect(r.line).toBe(3);
      expect(r.message).toMatch(/TO_UPPER/);
    });
  });

  it("CNV-24 loops map to the Edexcel loop of the same kind, and CIE-only features are refused", () => {
    check("CNV-24", () => {
      expect(ok("cie>edexcel", "DECLARE I : INTEGER\nFOR I <- 1 TO 3\n  OUTPUT I\nNEXT I\n")).toBe(
        `${HEAD_EDX}FOR I FROM 1 TO 3 DO\n    SEND I TO DISPLAY\nEND FOR\n`,
      );
    });
    check("CNV-24-refused", () => {
      expect(refusal("cie>edexcel", 'OPENFILE "a.txt" FOR READ\n').line).toBe(1);
    });
  });
});
