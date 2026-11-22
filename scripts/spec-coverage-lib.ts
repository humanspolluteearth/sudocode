// Pure parts of `pnpm spec:coverage`, kept apart from file and process handling so they can be unit-tested.

export interface SpecRow {
  id: string;
  file: string;
  status: string;
}

export interface TestRef {
  name: string;
  /** Pending golden tests are listed but don't count as covering a rule: they are expected to fail. */
  pending: boolean;
}

export interface CoverageRow {
  id: string;
  file: string;
  status: string;
  tests: number;
  pendingTests: number;
  inScope: boolean;
}

const ROW = /^\|\s*((?:SH|EDX|CIE|PY)-\d+)\s*\|(.*)\|\s*$/;

/** Every spec ID that starts a table row, in file order. Status is the row's last cell. */
export function extractSpecRows(files: readonly { file: string; text: string }[]): SpecRow[] {
  return files.flatMap(({ file, text }) =>
    text.split(/\r?\n/).flatMap((line) => {
      const m = ROW.exec(line);
      if (m === null) return [];
      const cells = (m[2] ?? "").split("|").map((c) => c.trim());
      const last = cells[cells.length - 1] ?? "";
      // Research rows end with a long "effect" sentence instead of a status: keep the table readable.
      return [{ id: m[1] ?? "", file, status: last.length > 40 ? `${last.slice(0, 39)}…` : last }];
    }),
  );
}

/** A test proves `id` when its name starts with the ID, not followed by another digit (EDX-5 is not EDX-54). */
export function namesId(testName: string, id: string): boolean {
  return testName.startsWith(id) && !/^\d/.test(testName.slice(id.length));
}

export function coverage(
  rows: readonly SpecRow[],
  tests: readonly TestRef[],
  scope: ReadonlySet<string>,
): CoverageRow[] {
  return rows.map((r) => {
    const named = tests.filter((t) => namesId(t.name, r.id));
    return {
      id: r.id,
      file: r.file,
      status: r.status,
      tests: named.filter((t) => !t.pending).length,
      pendingTests: named.filter((t) => t.pending).length,
      inScope: scope.has(r.id),
    };
  });
}

export function missingInScope(table: readonly CoverageRow[]): string[] {
  return table.filter((r) => r.inScope && r.tests === 0).map((r) => r.id);
}

/** Scope IDs that don't exist in the spec (a typo would otherwise silently check nothing). */
export function unknownScopeIds(rows: readonly SpecRow[], scope: ReadonlySet<string>): string[] {
  const ids = new Set(rows.map((r) => r.id));
  return [...scope].filter((id) => !ids.has(id));
}

export function markdownReport(table: readonly CoverageRow[]): string {
  const covered = table.filter((r) => r.tests > 0).length;
  const inScope = table.filter((r) => r.inScope);
  const lines = [
    "## Spec coverage",
    "",
    `${String(covered)} of ${String(table.length)} spec IDs have a test (pending tests not counted). ` +
      `In scope: ${String(inScope.length)}, missing a test: ${String(missingInScope(table).length)}.`,
    "",
    "| ID | File | Status | Tests | Pending | In scope |",
    "|---|---|---|---|---|---|",
    ...table.map(
      (r) =>
        `| ${r.id} | ${r.file} | ${r.status} | ${String(r.tests)} | ${String(r.pendingTests)} | ` +
        `${r.inScope ? (r.tests > 0 ? "yes" : "**yes: MISSING**") : ""} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}

interface VitestJson {
  testResults: { name: string; assertionResults: { title: string }[] }[];
}

/** Test titles from Vitest's JSON report, leaving out files whose names come from elsewhere. */
export function vitestTitles(report: VitestJson, excludeFile: (path: string) => boolean): string[] {
  return report.testResults.filter((f) => !excludeFile(f.name)).flatMap((f) => f.assertionResults.map((a) => a.title));
}
