import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./diagnostics.ts";
import {
  isCheckRequest,
  isCheckResponse,
  isRunnerCommand,
  isRunnerEvent,
  type CheckRequest,
  type CheckResponse,
  type RunnerCommand,
  type RunnerEvent,
} from "./protocol.ts";

const diagnostic: Diagnostic = {
  code: "E-RUN-DIV-ZERO",
  line: 3,
  column: 12,
  message: "You can't divide by zero.",
  hint: "Check the number on the right of / isn't 0.",
  severity: "error",
  span: { line: 3, column: 12, start: 40, end: 41 },
  fix: { label: "Guard it", edits: [{ start: 0, end: 0, replacement: "IF y <> 0 THEN\n" }] },
};

// One example of every message, as the worker would post it.
const commands: RunnerCommand[] = [
  {
    type: "run",
    request: {
      language: "edexcel",
      source: "SEND 1 TO DISPLAY",
      files: { "a.txt": "1\n" },
      seed: 1,
      breakpoints: [1],
      trace: false,
    },
  },
  { type: "input", text: "42" },
  { type: "pause" },
  { type: "continue" },
  { type: "stepOver" },
  { type: "stepInto" },
  { type: "stepOut" },
  { type: "stop" },
  { type: "setBreakpoints", lines: [2, 5] },
];

const events: RunnerEvent[] = [
  { type: "output", text: "Hello\n" },
  { type: "inputRequest", prompt: "" },
  { type: "inputRequest", prompt: "", device: "CARD_READER" },
  {
    type: "paused",
    reason: "breakpoint",
    line: 4,
    column: 5,
    stack: [{ name: "(main program)", line: 4, variables: [{ name: "Total", type: "INTEGER", value: "7" }] }],
  },
  {
    type: "traceRows",
    rows: [
      { kind: "assign", line: 2, variable: "Total", value: "7" },
      { kind: "output", line: 3, text: "7" },
    ],
  },
  { type: "traceRows", rows: [] },
  { type: "fileWrite", name: "Scores.txt", contents: "10\n" },
  { type: "diagnostics", diagnostics: [diagnostic] },
  { type: "error", diagnostic },
  { type: "done", status: "finished" },
  { type: "done", status: "stopped" },
  { type: "done", status: "error" },
];

const checkRequest: CheckRequest = { type: "check", id: 7, language: "cie", source: "OUTPUT 1" };
const checkResponse: CheckResponse = { type: "checked", id: 7, diagnostics: [diagnostic] };

const jsonRoundTrip = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe("MISC protocol messages are plain data", () => {
  it.each([...commands, ...events, checkRequest, checkResponse].map((m) => [m.type, m] as const))(
    "MISC %s survives a JSON round trip unchanged",
    (_type, message) => {
      expect(jsonRoundTrip(message)).toEqual(message);
      expect(structuredClone(message)).toEqual(message);
    },
  );
});

describe("MISC protocol guards accept every valid message", () => {
  it.each(commands.map((c) => [c.type, c] as const))("MISC command %s", (_t, c) => {
    expect(isRunnerCommand(c)).toBe(true);
  });
  it.each(events.map((e) => [e.type, e] as const))("MISC event %s", (_t, e) => {
    expect(isRunnerEvent(e)).toBe(true);
  });
  it("MISC check request and response", () => {
    expect(isCheckRequest(checkRequest)).toBe(true);
    expect(isCheckResponse(checkResponse)).toBe(true);
  });
});

describe("MISC protocol guards reject malformed messages", () => {
  it.each([
    ["not an object", 42],
    ["unknown type", { type: "launch" }],
    [
      "run with unknown language",
      { type: "run", request: { language: "java", source: "", files: {}, seed: 1, breakpoints: [], trace: false } },
    ],
    [
      "run with non-string file",
      {
        type: "run",
        request: { language: "cie", source: "", files: { a: 1 }, seed: 1, breakpoints: [], trace: false },
      },
    ],
    [
      "run with fractional seed",
      { type: "run", request: { language: "cie", source: "", files: {}, seed: 1.5, breakpoints: [], trace: false } },
    ],
    [
      "run with breakpoint line 0",
      { type: "run", request: { language: "cie", source: "", files: {}, seed: 1, breakpoints: [0], trace: false } },
    ],
    [
      "run without the trace flag",
      { type: "run", request: { language: "cie", source: "", files: {}, seed: 1, breakpoints: [] } },
    ],
    ["input without text", { type: "input" }],
    ["breakpoints not numbers", { type: "setBreakpoints", lines: ["3"] }],
  ])("MISC command: %s", (_why, message) => {
    expect(isRunnerCommand(message)).toBe(false);
  });

  it.each([
    ["output without text", { type: "output" }],
    ["paused with unknown reason", { type: "paused", reason: "nap", line: 1, column: 1, stack: [] }],
    ["paused at line 0", { type: "paused", reason: "step", line: 0, column: 1, stack: [] }],
    ["trace row of unknown kind", { type: "traceRows", rows: [{ kind: "read", line: 1 }] }],
    ["a single trace row instead of a batch", { type: "traceRows", row: { kind: "output", line: 1, text: "x" } }],
    ["diagnostic with a bad code", { type: "error", diagnostic: { ...diagnostic, code: "oops" } }],
    ["diagnostic with an unknown severity", { type: "error", diagnostic: { ...diagnostic, severity: "fatal" } }],
    ["diagnostic without a hint", { type: "diagnostics", diagnostics: [{ ...diagnostic, hint: undefined }] }],
    ["done with an unknown status", { type: "done", status: "crashed" }],
    ["a command sent as an event", { type: "stop" }],
    ["input request without a prompt", { type: "inputRequest" }],
    ["file write without contents", { type: "fileWrite", name: "a.txt" }],
    ["paused at column 0", { type: "paused", reason: "step", line: 1, column: 0, stack: [] }],
    [
      "a stack frame at line 0",
      { type: "paused", reason: "step", line: 1, column: 1, stack: [{ name: "f", line: 0, variables: [] }] },
    ],
    ["diagnostic at column 0", { type: "error", diagnostic: { ...diagnostic, column: 0 } }],
    [
      "diagnostic whose severity doesn't match its code",
      { type: "error", diagnostic: { ...diagnostic, code: "W-EDX-ENDIF" } },
    ],
    [
      "diagnostic with a malformed fix",
      { type: "error", diagnostic: { ...diagnostic, fix: { label: "x", edits: [{ start: 0 }] } } },
    ],
    [
      "diagnostic with a malformed span",
      { type: "error", diagnostic: { ...diagnostic, span: { line: 1, column: 1, start: -1, end: 0 } } },
    ],
  ])("MISC event: %s", (_why, message) => {
    expect(isRunnerEvent(message)).toBe(false);
  });

  it("MISC check request for an unknown language", () => {
    expect(isCheckRequest({ ...checkRequest, language: "java" })).toBe(false);
  });

  it("MISC check messages with a negative id or wrong type", () => {
    expect(isCheckRequest({ ...checkRequest, id: -1 })).toBe(false);
    expect(isCheckResponse({ ...checkResponse, type: "check" })).toBe(false);
  });
});
