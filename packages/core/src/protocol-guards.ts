// Runtime checks for messages that cross a worker boundary. TypeScript types vanish at run time, so a worker
// checks what it receives before acting on it.
import { isDiagnosticCode, type Diagnostic } from "./diagnostics.ts";
import { isLanguage } from "./language.ts";
import type {
  CheckRequest,
  CheckResponse,
  RunnerCommand,
  RunnerEvent,
  StackFrame,
  TraceRow,
  VariableView,
} from "./protocol.ts";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;
const isNatInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isArrayOf = <T>(v: unknown, item: (x: unknown) => x is T): v is T[] => Array.isArray(v) && v.every(item);
const isStringMap = (v: unknown): v is Record<string, string> => isObj(v) && Object.values(v).every(isStr);

function isSpan(v: unknown): boolean {
  return isObj(v) && isPosInt(v["line"]) && isPosInt(v["column"]) && isNatInt(v["start"]) && isNatInt(v["end"]);
}

function isFix(v: unknown): boolean {
  return (
    isObj(v) &&
    isStr(v["label"]) &&
    isArrayOf(
      v["edits"],
      (e): e is unknown => isObj(e) && isNatInt(e["start"]) && isNatInt(e["end"]) && isStr(e["replacement"]),
    )
  );
}

export function isDiagnostic(v: unknown): v is Diagnostic {
  return (
    isObj(v) &&
    isStr(v["code"]) &&
    isDiagnosticCode(v["code"]) &&
    isPosInt(v["line"]) &&
    isPosInt(v["column"]) &&
    isStr(v["message"]) &&
    isStr(v["hint"]) &&
    (v["severity"] === "error" || v["severity"] === "warning" || v["severity"] === "info") &&
    (v["fix"] === undefined || isFix(v["fix"])) &&
    (v["span"] === undefined || isSpan(v["span"]))
  );
}

const isVariableView = (v: unknown): v is VariableView =>
  isObj(v) && isStr(v["name"]) && isStr(v["type"]) && isStr(v["value"]);

const isStackFrame = (v: unknown): v is StackFrame =>
  isObj(v) && isStr(v["name"]) && isPosInt(v["line"]) && isArrayOf(v["variables"], isVariableView);

function isTraceRow(v: unknown): v is TraceRow {
  if (!isObj(v) || !isPosInt(v["line"])) return false;
  if (v["kind"] === "assign") return isStr(v["variable"]) && isStr(v["value"]);
  if (v["kind"] === "output") return isStr(v["text"]);
  return false;
}

export function isRunnerCommand(v: unknown): v is RunnerCommand {
  if (!isObj(v)) return false;
  switch (v["type"]) {
    case "run": {
      const r = v["request"];
      return (
        isObj(r) &&
        isLanguage(r["language"]) &&
        isStr(r["source"]) &&
        isStringMap(r["files"]) &&
        Number.isInteger(r["seed"]) &&
        isArrayOf(r["breakpoints"], isPosInt)
      );
    }
    case "input":
      return isStr(v["text"]);
    case "setBreakpoints":
      return isArrayOf(v["lines"], isPosInt);
    case "pause":
    case "continue":
    case "stepOver":
    case "stepInto":
    case "stepOut":
    case "stop":
      return true;
    default:
      return false;
  }
}

export function isRunnerEvent(v: unknown): v is RunnerEvent {
  if (!isObj(v)) return false;
  switch (v["type"]) {
    case "output":
      return isStr(v["text"]);
    case "inputRequest":
      return isStr(v["prompt"]) && (v["device"] === undefined || isStr(v["device"]));
    case "paused":
      return (
        ["breakpoint", "step", "pause", "stepLimit"].includes(v["reason"] as string) &&
        isPosInt(v["line"]) &&
        isPosInt(v["column"]) &&
        isArrayOf(v["stack"], isStackFrame)
      );
    case "traceRow":
      return isTraceRow(v["row"]);
    case "fileWrite":
      return isStr(v["name"]) && isStr(v["contents"]);
    case "diagnostics":
      return isArrayOf(v["diagnostics"], isDiagnostic);
    case "error":
      return isDiagnostic(v["diagnostic"]);
    case "done":
      return v["status"] === "finished" || v["status"] === "stopped" || v["status"] === "error";
    default:
      return false;
  }
}

export function isCheckRequest(v: unknown): v is CheckRequest {
  return isObj(v) && v["type"] === "check" && isNatInt(v["id"]) && isLanguage(v["language"]) && isStr(v["source"]);
}

export function isCheckResponse(v: unknown): v is CheckResponse {
  return isObj(v) && v["type"] === "checked" && isNatInt(v["id"]) && isArrayOf(v["diagnostics"], isDiagnostic);
}
