// Converter round-trip (docs/TEST-PLAN.md: "Converter round-trip"): a converted program must print exactly what the
// original printed, in Sudocode's own Python AND in CPython 3.12 (PY-01). Nothing here is hand-derived from the
// converter: the original's expected output is the reviewed `.expected.json`, and CPython runs the converted code.
//
// Corpus: every Edexcel and Cambridge golden program that runs without an error. Programs that use RANDOM are left
// out, because their output depends on the generator (the converter has its own snippet tests below). A program the
// converter refuses must use a feature on the refusal list (REFUSALS), so "refuse everything" cannot pass.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convertToPython, type ConvertFrom, type RefusedFeature } from "../../src/converter/index.ts";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";
import { discoverGoldenCases, type ExpectedFile } from "../support/golden.ts";

const PYTHON312 = process.env["PYTHON312"] ?? "python3.12";
const pending = new Set<string>(
  (JSON.parse(readFileSync(new URL("./pending.json", import.meta.url), "utf8")) as { tests: string[] }).tests,
);

/** Words that show a program uses a feature the converter refuses (comments and quoted text are removed first). */
const REFUSALS: Record<Exclude<RefusedFeature, "problems">, RegExp> = {
  files: /\b(OPENFILE|CLOSEFILE|READFILE|WRITEFILE|SEEK|GETRECORD|PUTRECORD|EOF)\b|^\s*(READ|WRITE)\s/im,
  types: /^\s*(TYPE|DECLARE\s+\w+\s*:\s*(SET|POINTER|\w+\s*$))|\bTYPE\b/im,
  classes: /\b(CLASS|NEW|SUPER|INHERITS)\b/i,
  errors: /\b(TRY|EXCEPT|CATCH)\b/i,
  byref: /\bBYREF\b/i,
  dates: /\b(DATE|TODAY|DAY|MONTH|YEAR|DAYINDEX|SETDATE)\b/i,
  devices: /\b(SEND\b.*\bTO\s+(?!DISPLAY\b)\w+|FROM\s*\(\s*\w+\s*\)\s*(?!KEYBOARD\b)\w+)/i,
};

const stripped = (source: string): string =>
  source
    .split("\n")
    .map((line) => line.replace(/'[^']*'|"[^"]*"/g, "''").replace(/(#|\/\/).*$/, ""))
    .join("\n");

async function inSudocode(language: "python" | ConvertFrom, source: string, inputs: readonly string[]) {
  return runHeadless(
    createLocalRunner(ENGINES),
    { language, source, files: {}, seed: 1, breakpoints: [], trace: false },
    inputs,
  );
}

function inCPython(code: string, inputs: readonly string[]): { stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "sudocode-conv-"));
  try {
    const file = join(dir, "converted.py");
    writeFileSync(file, code);
    const r = spawnSync(PYTHON312, ["-I", file], {
      cwd: dir,
      input: inputs.map((i) => `${i}\n`).join(""),
      encoding: "utf8",
      env: { PYTHONHASHSEED: "0", PATH: process.env["PATH"] ?? "" },
    });
    return { stdout: r.stdout, stderr: r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verdict(id: string, problems: string[]): void {
  const isPending = pending.has(id);
  if (isPending && problems.length === 0) expect.fail(`${id} now passes: remove it from pending.json`);
  if (!isPending && problems.length > 0) expect.fail(`${id}\n${problems.join("\n")}`);
}

async function roundTrip(
  id: string,
  from: ConvertFrom,
  source: string,
  inputs: readonly string[],
  stdout: string,
): Promise<"converted" | "refused" | "wrong"> {
  const problems: string[] = [];
  let outcome: "converted" | "refused" | "wrong" = "converted";
  try {
    const result = convertToPython(source, from);
    if (!result.ok) {
      outcome = "refused";
      const pattern = REFUSALS[result.feature as Exclude<RefusedFeature, "problems">];
      if (result.feature === "problems" || !pattern.test(stripped(source))) {
        problems.push(`refused for "${result.feature}", but the program does not use it: ${result.message}`);
      }
      if (result.message === "" || result.hint === "") problems.push("a refusal needs a message and a hint");
    } else {
      const sudocode = await inSudocode("python", result.code, inputs);
      if (sudocode.errors.length > 0) problems.push(`Sudocode Python: ${sudocode.errors.map((e) => e.code).join(",")}`);
      if (sudocode.stdout !== stdout) {
        problems.push(`Sudocode Python printed ${JSON.stringify(sudocode.stdout)}, expected ${JSON.stringify(stdout)}`);
      }
      const cpython = inCPython(result.code, inputs);
      if (cpython.stdout !== stdout) {
        problems.push(
          `CPython printed ${JSON.stringify(cpython.stdout)}, expected ${JSON.stringify(stdout)} ${cpython.stderr.slice(-200)}`,
        );
      }
    }
  } catch (error) {
    problems.push(String(error));
  }
  verdict(id, problems);
  return problems.length > 0 ? "wrong" : outcome;
}

const corpus = discoverGoldenCases().filter((c) => {
  const e = c.raw as ExpectedFile;
  return (
    (e.language === "edexcel" || e.language === "cie") &&
    e.expect.errors.length === 0 &&
    !/\bRAND(OM)?\b/i.test(c.source) &&
    !c.id.startsWith("errors/")
  );
});

describe("MISC converter round trip (Edexcel and Cambridge -> Python)", () => {
  const refusedCount = { value: 0 };
  const convertedCount = { value: 0 };
  it("MISC the corpus is not empty", () => {
    expect(corpus.length).toBeGreaterThan(150);
  });

  it.each(corpus.map((c) => [c.id, c] as const))("MISC converter round trip %s", async (_title, c) => {
    const expected = c.raw as ExpectedFile;
    const outcome = await roundTrip(
      `converter/${c.id}`,
      expected.language as ConvertFrom,
      c.source,
      expected.inputs ?? [],
      expected.expect.stdout,
    );
    if (outcome === "refused") refusedCount.value += 1;
    else if (outcome === "converted") convertedCount.value += 1;
  });

  it("MISC converter/most-programs-convert: at most 1 in 4 programs is refused", () => {
    const id = "converter/MISC-most-programs-convert";
    const share = refusedCount.value / corpus.length;
    const converted = convertedCount.value / corpus.length;
    verdict(
      id,
      share <= 0.25 && converted >= 0.75
        ? []
        : [`refused ${String(refusedCount.value)}, converted ${String(convertedCount.value)}`],
    );
  });
});

// Small programs for the rules a student could get wrong. `stdout` is worked out from the spec rows named.
interface Snippet {
  id: string;
  from: ConvertFrom;
  source: string;
  inputs?: string[];
  stdout?: string;
  refuses?: Exclude<RefusedFeature, "problems">;
}
const SNIPPETS: Snippet[] = [
  { id: "SH-03-real-sum", from: "edexcel", source: "SEND 0.1 + 0.2 TO DISPLAY\n", stdout: "0.3\n" },
  {
    id: "SH-03-real-whole",
    from: "edexcel",
    source: "SEND 6 / 2 TO DISPLAY\nSEND 7 / 2 TO DISPLAY\n",
    stdout: "3\n3.5\n",
  },
  { id: "SH-04-bool", from: "edexcel", source: "SET ok TO 3 > 2\nSEND ok TO DISPLAY\n", stdout: "TRUE\n" },
  { id: "SH-04-bool-cie", from: "cie", source: "DECLARE Ok : BOOLEAN\nOk ← 3 < 2\nOUTPUT Ok\n", stdout: "FALSE\n" },
  {
    id: "SH-10-floor-div",
    from: "edexcel",
    source: "SEND -7 DIV 2 TO DISPLAY\nSEND -7 MOD 2 TO DISPLAY\n",
    stdout: "-4\n1\n",
  },
  {
    id: "EDX-16-join",
    from: "edexcel",
    source: "SEND 'Age ' & 18 & ' ' & 1.5 & ' ' & TRUE TO DISPLAY\n",
    stdout: "Age 18 1.5 TRUE\n",
  },
  {
    id: "EDX-52-name-clash",
    from: "edexcel",
    source: "SET list TO [3, 1]\nSET input TO 2\nSEND list[0] + input TO DISPLAY\n",
    stdout: "5\n",
  },
  {
    id: "EDX-72-input",
    from: "edexcel",
    source: "RECEIVE n FROM (INTEGER) KEYBOARD\nSEND n * 2 TO DISPLAY\n",
    inputs: ["21"],
    stdout: "42\n",
  },
  {
    id: "EDX-27-grow",
    from: "edexcel",
    source: "SET a TO [1, 2]\nSET a[2] TO 3\nSEND LENGTH(a) TO DISPLAY\n",
    stdout: "3\n",
  },
  { id: "CIE-03-case", from: "cie", source: "DECLARE Count : INTEGER\nCOUNT ← 4\nOUTPUT count\n", stdout: "4\n" },
  {
    id: "CIE-21-base-one",
    from: "cie",
    source: "DECLARE A : ARRAY[1:3] OF INTEGER\nA[1] ← 7\nA[3] ← 9\nOUTPUT A[1] + A[3]\n",
    stdout: "16\n",
  },
  {
    id: "refuse-files",
    from: "cie",
    source: 'OPENFILE "f.txt" FOR WRITE\nWRITEFILE "f.txt", "a"\nCLOSEFILE "f.txt"\n',
    refuses: "files",
  },
  {
    id: "refuse-byref",
    from: "cie",
    source: "PROCEDURE P(BYREF X : INTEGER)\n  X ← 1\nENDPROCEDURE\nDECLARE Y : INTEGER\nY ← 0\nCALL P(Y)\nOUTPUT Y\n",
    refuses: "byref",
  },
  { id: "refuse-device", from: "edexcel", source: "SEND 'on' TO MOTOR\n", refuses: "devices" },
  { id: "refuse-types", from: "cie", source: "TYPE Pair\n  DECLARE A : INTEGER\nENDTYPE\n", refuses: "types" },
];

describe("MISC converter snippets", () => {
  it.each(SNIPPETS.map((s) => [s.id, s] as const))("MISC converter/%s", async (_title, s) => {
    const id = `converter/MISC-${s.id}`;
    if (s.refuses !== undefined) {
      const problems: string[] = [];
      try {
        const result = convertToPython(s.source, s.from);
        if (result.ok) problems.push("expected a refusal");
        else if (result.feature !== s.refuses) problems.push(`refused for ${result.feature}, expected ${s.refuses}`);
      } catch (error) {
        problems.push(String(error));
      }
      verdict(id, problems);
    } else {
      const outcome = await roundTrip(id, s.from, s.source, s.inputs ?? [], s.stdout ?? "");
      if (!pending.has(id)) expect(outcome).toBe("converted");
    }
  });
});
