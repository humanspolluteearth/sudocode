import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../src/diagnostics.ts";
import type { RunRequest } from "../../src/protocol.ts";
import type { Engine } from "../../src/runner/engine.ts";
import type { HeadlessResult } from "../../src/runner/headless.ts";
import { runHeadless } from "../../src/runner/headless.ts";
import { createLocalRunner } from "../../src/runner/local-runner.ts";
import { compareRun, discoverGoldenCases, readPending, schemaErrors, verdict, type ExpectedFile } from "./golden.ts";

const d = (code: string, line: number, column: number, severity: Diagnostic["severity"] = "error"): Diagnostic => ({
  code,
  line,
  column,
  message: "m",
  hint: "h.",
  severity,
});

const result = (over: Partial<HeadlessResult> = {}): HeadlessResult => ({
  stdout: "",
  errors: [],
  warnings: [],
  info: [],
  files: {},
  trace: [],
  status: "finished",
  inputStarved: false,
  stepLimitReached: false,
  ...over,
});

const expect0 = (over: Partial<ExpectedFile["expect"]> = {}): ExpectedFile["expect"] => ({
  stdout: "",
  errors: [],
  warnings: [],
  files: null,
  trace: null,
  ...over,
});

describe("MISC golden runner: comparing a run with its expected file", () => {
  it("MISC passes when everything matches, ignoring message wording and diagnostic order", () => {
    const run = result({ stdout: "7\n", warnings: [d("W-B", 2, 1, "warning"), d("W-A", 1, 5, "warning")] });
    const want = expect0({
      stdout: "7\n",
      warnings: [
        { code: "W-A", line: 1, column: 5 },
        { code: "W-B", line: 2, column: 1 },
      ],
    });
    expect(compareRun(want, run)).toEqual([]);
  });

  it("MISC reports a stdout difference exactly, including a missing newline", () => {
    expect(compareRun(expect0({ stdout: "7\n" }), result({ stdout: "7" }))).toEqual([
      'stdout: expected "7\\n" but got "7"',
    ]);
  });

  it.each([
    [
      "errors",
      { errors: [{ code: "E-RUN-DIV-ZERO", line: 3, column: 12 }] },
      result({ errors: [d("E-RUN-DIV-ZERO", 3, 11)] }),
    ],
    ["warnings", { warnings: [{ code: "W-A", line: 1, column: 1 }] }, result()],
    ["info", { info: [] }, result({ info: [d("I-X", 1, 1, "info")] })],
  ] as [string, Partial<ExpectedFile["expect"]>, HeadlessResult][])(
    "MISC reports a difference in %s",
    (kind, want, run) => {
      const problems = compareRun(expect0(want), run);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(new RegExp(`^${kind}: expected`));
    },
  );

  it("MISC compares files ignoring the case of their names (SH-11), and only when the test asks", () => {
    const run = result({ files: { "scores.TXT": "a\n" } });
    expect(compareRun(expect0({ files: { "Scores.txt": "a\n" } }), run)).toEqual([]);
    expect(compareRun(expect0({ files: { "Scores.txt": "b\n" } }), run)).toEqual([
      'file scores.txt: expected "b\\n" but got "a\\n"',
    ]);
    expect(compareRun(expect0({ files: {} }), run)).toEqual(['file scores.txt: expected undefined but got "a\\n"']);
    expect(compareRun(expect0({ files: null }), run)).toEqual([]);
  });

  it("MISC compares the trace only when the test asks", () => {
    const run = result({ trace: [{ kind: "output", line: 1, text: "7" }] });
    expect(compareRun(expect0({ trace: null }), run)).toEqual([]);
    expect(compareRun(expect0({ trace: [] }), run)).toHaveLength(1);
  });

  it("MISC fails a run that ran out of input or hit the step limit", () => {
    expect(compareRun(expect0(), result({ inputStarved: true }))).toEqual([
      "the program asked for more input than the test gives",
    ]);
    expect(compareRun(expect0(), result({ stepLimitReached: true }))).toEqual([
      "the program reached the step limit (possible infinite loop)",
    ]);
  });
});

describe("MISC golden runner: the pending rule", () => {
  it("MISC a normal test passes only with no differences", () => {
    expect(verdict([], false)).toEqual({ ok: true });
    expect(verdict(["stdout: x", "errors: y"], false)).toEqual({ ok: false, reason: "stdout: x\nerrors: y" });
  });

  it("MISC a pending test must fail", () => {
    expect(verdict(["stdout: x"], true)).toEqual({ ok: true });
  });

  it("MISC a pending test that passes fails the run with a message saying what to do", () => {
    expect(verdict([], true)).toEqual({
      ok: false,
      reason: "This pending test now passes. Remove its ID from packages/core/tests/pending.json.",
    });
  });
});

describe("MISC golden runner: running programs headlessly", () => {
  const engine: Engine = {
    check: () => [],
    start(_req, emit) {
      emit({ type: "diagnostics", diagnostics: [d("W-A", 1, 1, "warning")] });
      emit({ type: "inputRequest", prompt: "" });
      return {
        command(c) {
          if (c.type === "input") {
            emit({ type: "output", text: `${c.text}!\n` });
            emit({ type: "fileWrite", name: "out.txt", contents: `${c.text}\n` });
            emit({ type: "traceRow", row: { kind: "output", line: 2, text: `${c.text}!` } });
            emit({ type: "error", diagnostic: d("I-B", 2, 1, "info") });
            emit({ type: "done", status: "finished" });
          }
          if (c.type === "stop") emit({ type: "done", status: "stopped" });
        },
      };
    },
  };
  const req: RunRequest = { language: "edexcel", source: "", files: { "in.txt": "1\n" }, seed: 1, breakpoints: [] };

  it("MISC feeds the inputs and collects output, diagnostics by severity, files and trace", async () => {
    const run = await runHeadless(createLocalRunner({ edexcel: engine }), req, ["hi"]);
    expect(run).toEqual(
      result({
        stdout: "hi!\n",
        warnings: [d("W-A", 1, 1, "warning")],
        info: [d("I-B", 2, 1, "info")],
        files: { "in.txt": "1\n", "out.txt": "hi\n" },
        trace: [{ kind: "output", line: 2, text: "hi!" }],
      }),
    );
  });

  it("MISC stops the run when the inputs run out", async () => {
    const run = await runHeadless(createLocalRunner({ edexcel: engine }), req, []);
    expect(run.inputStarved).toBe(true);
    expect(run.status).toBe("stopped");
  });

  it("MISC with no engine, every program fails with E-INTERNAL-NO-ENGINE", async () => {
    const run = await runHeadless(createLocalRunner({}), { ...req, language: "python" }, []);
    expect(run.errors.map((e) => e.code)).toEqual(["E-INTERNAL-NO-ENGINE"]);
    expect(run.status).toBe("error");
  });
});

describe("MISC golden runner: discovery and validation", () => {
  const cases = discoverGoldenCases();

  it("MISC finds every harvested program and nothing under support/ or schema/", () => {
    expect(cases.filter((c) => c.id.startsWith("harvested/")).length).toBe(66);
    expect(cases.filter((c) => /^(support|schema)\//.test(c.id))).toEqual([]);
  });

  it("MISC every pending ID is a golden case or another known test", () => {
    const ids = new Set(cases.map((c) => c.id));
    expect([...readPending()].filter((id) => !ids.has(id))).toEqual([]);
  });

  it("MISC reports schema problems in readable form", () => {
    expect(schemaErrors({ spec: [], language: "java" })).toEqual([
      "(root) must have required property 'expect'",
      "/language must be equal to one of the allowed values",
    ]);
    expect(schemaErrors(cases[0]?.raw)).toEqual([]);
  });
});
