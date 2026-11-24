// Python's exception hierarchy and the way runtime failures become real Python exceptions (PY-03, PY-20).
//
// Compiler concept: the runtime reports every failure as a `RunError`; for Python the code is `E-PY-<Name>` and the
// detail text is CPython's own message. `try/except` turns a RunError back into an exception value and matches
// it by class, walking this table of parents.
import type { Span } from "../../diagnostics.ts";
import { RunError } from "../run-error.ts";

export const PARENT: Readonly<Record<string, string>> = {
  Exception: "BaseException",
  ArithmeticError: "Exception",
  ZeroDivisionError: "ArithmeticError",
  OverflowError: "ArithmeticError",
  LookupError: "Exception",
  IndexError: "LookupError",
  KeyError: "LookupError",
  NameError: "Exception",
  UnboundLocalError: "NameError",
  RuntimeError: "Exception",
  RecursionError: "RuntimeError",
  OSError: "Exception",
  FileNotFoundError: "OSError",
  ValueError: "Exception",
  TypeError: "Exception",
  AttributeError: "Exception",
  AssertionError: "Exception",
  StopIteration: "Exception",
  EOFError: "Exception",
  NotImplementedError: "RuntimeError",
};

export const EXCEPTION_NAMES = ["BaseException", ...Object.keys(PARENT)];

/** True when exception class `name` is `ancestor` or inherits from it. */
export function isSubclass(name: string, ancestor: string): boolean {
  for (let n: string | undefined = name; n !== undefined; n = PARENT[n]) if (n === ancestor) return true;
  return false;
}

export function pyError(name: string, detail: string, span: Span): RunError {
  return new RunError(`E-PY-${name}`, span, { detail });
}

export const typeError = (detail: string, span: Span): RunError => pyError("TypeError", detail, span);
export const valueError = (detail: string, span: Span): RunError => pyError("ValueError", detail, span);
