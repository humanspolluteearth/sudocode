// Converter matrix (CNV-70): every Edexcel and Cambridge golden program that runs without an error and without
// RANDOM, converted to the other pseudocode. Each program is either converted (the result analyses with no errors in
// the target, runs in Sudocode and prints the original's reviewed output) or refused for a reason that program really
// has. The original's expected output is the reviewed `.expected.json`, never what the converter produces.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convert } from "../../src/converter/index.ts";
import { createLocalRunner, ENGINES } from "../../src/engine.ts";
import { runHeadless } from "../../src/runner/headless.ts";
import { discoverGoldenCases, type ExpectedFile } from "../support/golden.ts";

const pending = new Set<string>(
  (JSON.parse(readFileSync(new URL("./pending.json", import.meta.url), "utf8")) as { tests: string[] }).tests,
);

type Pseudo = "edexcel" | "cie";

/** Refusal reasons the matrix accepts, each with a test for the program text. `null`: the reason is about meaning. */
const REASONS: Record<string, RegExp | null> = {
  files: /\b(OPENFILE|CLOSEFILE|READFILE|WRITEFILE|SEEK|GETRECORD|PUTRECORD|EOF)\b|^\s*(READ|WRITE)\s/im,
  types: /\b(TYPE|SET|POINTER)\b/i,
  classes: /\b(CLASS|NEW|SUPER|INHERITS)\b/i,
  errors: /\b(TRY|EXCEPT|CATCH)\b/i,
  byref: /\bBYREF\b/i,
  dates: /\b(DATE|TODAY|DAY|MONTH|YEAR|DAYINDEX|SETDATE)\b/i,
  devices: /\b(SEND\b.*\bTO\s+(?!DISPLAY\b)\w+|FROM\s*\(\s*\w+\s*\)\s*(?!KEYBOARD\b)\w+)/i,
  builtins: /\b[A-Z_]+\s*\(/i,
  prompt: /\bINPUT\s+["']/i,
  "multi-array": /ARRAY\s*\[[^\]]*,/i,
  "growing-array": /^\s*SET\s+\w+\s*\[/im,
  "real-in-text": /&/,
  "unknown-type": null,
  "name-clash": null,
  problems: null,
};

const stripped = (source: string): string =>
  source
    .split("\n")
    .map((line) => line.replace(/'[^']*'|"[^"]*"/g, "''").replace(/(#|\/\/).*$/, ""))
    .join("\n");

const corpus = discoverGoldenCases().filter((c) => {
  const e = c.raw as ExpectedFile;
  return (
    (e.language === "edexcel" || e.language === "cie") &&
    e.expect.errors.length === 0 &&
    !/\bRAND(OM)?\b/i.test(c.source) &&
    !c.id.startsWith("errors/")
  );
});

async function matrix(from: Pseudo, to: Pseudo) {
  const problems: string[] = [];
  let refused = 0;
  let total = 0;
  for (const c of corpus.filter((x) => (x.raw as ExpectedFile).language === from)) {
    total += 1;
    const expected = c.raw as ExpectedFile;
    try {
      const r = convert(c.source, from, to);
      if (!r.ok) {
        refused += 1;
        const pattern = REASONS[r.feature];
        if (pattern === undefined) problems.push(`${c.id}: "${r.feature}" is not a documented reason`);
        else if (pattern !== null && !pattern.test(stripped(c.source))) {
          problems.push(`${c.id}: refused for "${r.feature}" but the program does not use it`);
        }
        if (r.message === "" || r.hint === "") problems.push(`${c.id}: a refusal needs a message and a hint`);
        continue;
      }
      const ran = await runHeadless(
        createLocalRunner(ENGINES),
        { language: to, source: r.code, files: {}, seed: 1, breakpoints: [], trace: false },
        expected.inputs ?? [],
      );
      if (ran.errors.length > 0)
        problems.push(`${c.id}: converted program has ${ran.errors.map((e) => e.code).join(",")}`);
      else if (ran.stdout !== expected.expect.stdout) {
        problems.push(
          `${c.id}: printed ${JSON.stringify(ran.stdout)}, expected ${JSON.stringify(expected.expect.stdout)}`,
        );
      }
    } catch (error) {
      problems.push(`${c.id}: ${String(error)}`);
    }
  }
  return { problems, refused, total };
}

describe("CNV-70 converter matrix", () => {
  it.each([
    ["edexcel", "cie"],
    ["cie", "edexcel"],
  ] as const)(
    "CNV-70 every %s program converts to %s or is refused for a real reason",
    async (from, to) => {
      const key = `converter/matrix/${from}-to-${to}`;
      const { problems, refused, total } = await matrix(from, to);
      // "Refuse everything" must not pass: at most half the programs may be refused.
      if (refused * 2 > total) problems.push(`${String(refused)} of ${String(total)} programs were refused`);
      if (pending.has(key)) {
        if (problems.length === 0) expect.fail(`${key} now passes: remove it from pending.json`);
        return;
      }
      if (problems.length > 0) expect.fail(`${key}\n${problems.slice(0, 20).join("\n")}`);
    },
    120_000,
  );
});
