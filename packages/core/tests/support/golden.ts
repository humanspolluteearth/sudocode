// The golden test harness (docs/TEST-PLAN.md section 4): finds every program with an `.expected.json`, runs it
// through the Runner, compares what happened with what the file expects, and applies pending.json.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Diagnostic } from "../../src/diagnostics.ts";
import type { Language } from "../../src/language.ts";
import type { HeadlessResult } from "../../src/runner/headless.ts";

export const TESTS_DIR = join(import.meta.dirname, "..");

const EXTENSIONS: Record<string, Language> = { epc: "edexcel", cpc: "cie", py: "python" };
const PROGRAM = /\.(epc|cpc|py)$/;
/** Folders under tests/ that hold no golden programs. */
const SKIP_DIRS = new Set(["support", "schema", "node_modules"]);

export interface ExpectedDiagnostic {
  code: string;
  line: number;
  column: number;
  /** Exact wording, given by tests/errors/ programs (message wording is tested there: TEST-PLAN section 4). */
  message?: string;
  hint?: string;
}

export interface ExpectedFile {
  spec: string[];
  language: Language;
  inputs?: string[];
  seed?: number;
  files?: Record<string, string>;
  expect: {
    stdout: string;
    errors: ExpectedDiagnostic[];
    warnings: ExpectedDiagnostic[];
    info?: ExpectedDiagnostic[];
    files: Record<string, string> | null;
    trace: unknown[] | null;
  };
  openQuestions?: string[];
  notes?: string;
}

export interface GoldenCase {
  /** Path from tests/ without the extension, e.g. harvested/probes/cie/CIE-31-enum. Used in pending.json. */
  id: string;
  /** File name without the extension; starts with the spec ID it proves. */
  name: string;
  programPath: string;
  expectedPath: string;
  source: string;
  /** Parsed JSON, not yet validated. */
  raw: unknown;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name));
    return [join(dir, e.name)];
  });
}

/** Every program under `root` that has an expected file beside it, sorted by id. */
export function discoverGoldenCases(root: string = TESTS_DIR): GoldenCase[] {
  return walk(root)
    .filter((f) => PROGRAM.test(f))
    .map((programPath) => {
      const expectedPath = programPath.replace(PROGRAM, ".expected.json");
      const id = relative(root, programPath).replace(PROGRAM, "").split("\\").join("/");
      return {
        id,
        name: id.slice(id.lastIndexOf("/") + 1),
        programPath,
        expectedPath,
        source: readFileSync(programPath, "utf8"),
        raw: JSON.parse(readFileSync(expectedPath, "utf8")) as unknown,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function languageOfProgram(path: string): Language | undefined {
  const ext = PROGRAM.exec(path)?.[1];
  return ext === undefined ? undefined : EXTENSIONS[ext];
}

const schema = JSON.parse(readFileSync(join(TESTS_DIR, "schema", "expected.schema.json"), "utf8")) as object;
const validator = new Ajv2020({ allErrors: true }).compile(schema);

/** Schema problems in an expected file, as readable lines (empty when valid). */
export function schemaErrors(raw: unknown): string[] {
  if (validator(raw)) return [];
  return (validator.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`);
}

export function readPending(root: string = TESTS_DIR): Set<string> {
  const data = JSON.parse(readFileSync(join(root, "pending.json"), "utf8")) as { tests: string[] };
  return new Set(data.tests);
}

const position = (d: ExpectedDiagnostic): string => `${d.code} ${String(d.line)}:${String(d.column)}`;
const positions = (list: readonly ExpectedDiagnostic[]): string[] =>
  [...list].sort((a, b) => a.line - b.line || a.column - b.column || (a.code < b.code ? -1 : 1)).map(position);

function compareDiagnostics(
  kind: string,
  expected: readonly ExpectedDiagnostic[],
  actual: readonly Diagnostic[],
): string[] {
  const want = positions(expected);
  const got = positions(actual);
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    return [`${kind}: expected [${want.join(", ")}] but got [${got.join(", ")}]`];
  }
  // Same diagnostics at the same places: where the expected file gives wording, it must match exactly.
  return expected.flatMap((e) => {
    const match = actual.find((a) => position(a) === position(e));
    const problems: string[] = [];
    for (const field of ["message", "hint"] as const) {
      const wanted = e[field];
      if (wanted !== undefined && match?.[field] !== wanted) {
        problems.push(
          `${position(e)} ${field}: expected ${JSON.stringify(wanted)} but got ${JSON.stringify(match?.[field])}`,
        );
      }
    }
    return problems;
  });
}

// File names are not case-sensitive (SH-11), so files are compared by lower-cased name.
function compareFiles(expected: Record<string, string>, actual: Record<string, string>): string[] {
  const lower = (m: Record<string, string>): Map<string, string> =>
    new Map(Object.entries(m).map(([k, v]) => [k.toLowerCase(), v]));
  const want = lower(expected);
  const got = lower(actual);
  const problems: string[] = [];
  for (const name of new Set([...want.keys(), ...got.keys()])) {
    if (want.get(name) !== got.get(name)) {
      problems.push(
        `file ${name}: expected ${JSON.stringify(want.get(name))} but got ${JSON.stringify(got.get(name))}`,
      );
    }
  }
  return problems;
}

/** Every way the run differs from the expected file; empty means the test passes. */
export function compareRun(expected: ExpectedFile["expect"], result: HeadlessResult): string[] {
  const problems: string[] = [];
  if (result.stdout !== expected.stdout) {
    problems.push(`stdout: expected ${JSON.stringify(expected.stdout)} but got ${JSON.stringify(result.stdout)}`);
  }
  problems.push(...compareDiagnostics("errors", expected.errors, result.errors));
  problems.push(...compareDiagnostics("warnings", expected.warnings, result.warnings));
  problems.push(...compareDiagnostics("info", expected.info ?? [], result.info));
  if (expected.files !== null) problems.push(...compareFiles(expected.files, result.files));
  if (expected.trace !== null && !isDeepStrictEqual(expected.trace, result.trace)) {
    problems.push(`trace: expected ${JSON.stringify(expected.trace)} but got ${JSON.stringify(result.trace)}`);
  }
  if (result.inputStarved) problems.push("the program asked for more input than the test gives");
  if (result.status === "stopped" && !result.inputStarved && !result.stepLimitReached) {
    problems.push("the run was stopped before it finished");
  }
  if (result.status === "error" && result.errors.length === 0) {
    problems.push("the run ended with an error but reported no error diagnostic");
  }
  if (result.stepLimitReached) problems.push("the program reached the step limit (possible infinite loop)");
  return problems;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/**
 * The pending rule (docs/TEST-PLAN.md section 5): a pending test must FAIL, so CI stays green while its feature
 * is missing; a pending test that passes fails the run until it is removed from pending.json.
 */
export function verdict(problems: readonly string[], pending: boolean): Verdict {
  if (pending) {
    return problems.length > 0
      ? { ok: true }
      : { ok: false, reason: "This pending test now passes. Remove its ID from packages/core/tests/pending.json." };
  }
  return problems.length === 0 ? { ok: true } : { ok: false, reason: problems.join("\n") };
}
