import { describe, expect, it } from "vitest";
import { createLocalRunner } from "../src/runner/local-runner.ts";
import { ENGINES } from "../src/runner/engines.ts";
import { runHeadless } from "../src/runner/headless.ts";
import {
  compareRun,
  discoverGoldenCases,
  languageOfProgram,
  readPending,
  schemaErrors,
  verdict,
  type ExpectedFile,
} from "./support/golden.ts";

// Every golden program under packages/core/tests/ (golden/, harvested/, conformance/, ...) runs here, through the
// same Runner the UI uses. Test names start with the program's file name, which starts with its spec ID.
const cases = discoverGoldenCases();
const pending = readPending();

describe("golden programs", () => {
  it("MISC finds the golden programs", () => {
    expect(cases.length).toBeGreaterThanOrEqual(66);
  });

  it.each(cases.map((c) => [`${c.name} (${c.id})`, c] as const))("%s", async (_title, goldenCase) => {
    expect(schemaErrors(goldenCase.raw)).toEqual([]);
    const expected = goldenCase.raw as ExpectedFile;
    expect(expected.language).toBe(languageOfProgram(goldenCase.programPath));

    const result = await runHeadless(
      createLocalRunner(ENGINES),
      {
        language: expected.language,
        source: goldenCase.source,
        files: expected.files ?? {},
        seed: expected.seed ?? 1,
        breakpoints: [],
        trace: expected.expect.trace !== null,
      },
      expected.inputs ?? [],
    );

    const outcome = verdict(compareRun(expected.expect, result), pending.has(goldenCase.id));
    if (!outcome.ok) expect.fail(`${goldenCase.id}\n${outcome.reason}`);
  });
});
