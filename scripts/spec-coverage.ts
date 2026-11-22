// `pnpm spec:coverage`: lists every spec ID in docs/language-spec/ with the tests that prove it, and fails if an
// ID in packages/core/tests/scope.json has none (docs/TEST-PLAN.md: "every approved spec ID covered").
//
// Test names come from two places:
// - Vitest's JSON report (unit, conformance and error tests: `it("EDX-54 STEP 0 is a runtime error")`);
// - golden program file names (`EDX-54-step-zero.epc`); goldens listed in pending.json don't count yet.
// Usage: node scripts/spec-coverage.ts [--report <vitest-json>]   (without --report it runs Vitest itself)
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  coverage,
  extractSpecRows,
  markdownReport,
  missingInScope,
  unknownScopeIds,
  vitestTitles,
  type TestRef,
} from "./spec-coverage-lib.ts";

const root = join(import.meta.dirname, "..");
const specDir = join(root, "docs", "language-spec");
const testsDir = join(root, "packages", "core", "tests");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function vitestReport(): unknown {
  const flag = process.argv.indexOf("--report");
  const given = flag >= 0 ? process.argv[flag + 1] : undefined;
  if (given !== undefined) return JSON.parse(readFileSync(given, "utf8"));
  const out = join(mkdtempSync(join(tmpdir(), "spec-coverage-")), "vitest.json");
  try {
    execFileSync(join(root, "node_modules", ".bin", "vitest"), ["run", "--reporter=json", `--outputFile=${out}`], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    // Failing tests still write the report; their names still say what they are meant to prove.
  }
  return JSON.parse(readFileSync(out, "utf8"));
}

const rows = extractSpecRows(
  readdirSync(specDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(join(specDir, f), "utf8") })),
);

const pending = new Set(
  (JSON.parse(readFileSync(join(testsDir, "pending.json"), "utf8")) as { tests: string[] }).tests,
);
const goldens: TestRef[] = walk(testsDir)
  .filter((f) => /\.(epc|cpc|py)$/.test(f))
  .map((f) => {
    const id = relative(testsDir, f)
      .replace(/\.(epc|cpc|py)$/, "")
      .split("\\")
      .join("/");
    return { name: id.slice(id.lastIndexOf("/") + 1), pending: pending.has(id) };
  });

const report = vitestReport() as Parameters<typeof vitestTitles>[0];
// golden.test.ts names its tests after the golden files, which are counted above with their pending state.
const unitTests: TestRef[] = vitestTitles(report, (path) => path.endsWith("golden.test.ts")).map((name) => ({
  name,
  pending: false,
}));

const scope = new Set((JSON.parse(readFileSync(join(testsDir, "scope.json"), "utf8")) as { ids: string[] }).ids);
const table = coverage(rows, [...goldens, ...unitTests], scope);
const markdown = markdownReport(table);

console.log(markdown);
const summary = process.env["GITHUB_STEP_SUMMARY"];
if (summary !== undefined && summary !== "") appendFileSync(summary, markdown);

const unknown = unknownScopeIds(rows, scope);
const missing = missingInScope(table);
if (unknown.length > 0) console.error(`scope.json lists IDs that are not in the spec: ${unknown.join(", ")}`);
if (missing.length > 0) console.error(`In scope but no test proves them yet: ${missing.join(", ")}`);
process.exit(unknown.length > 0 || missing.length > 0 ? 1 : 0);
