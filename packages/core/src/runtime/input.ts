// Turning a typed line into a value of the type the program asked for (EDX-72, SH-05, SH-06).
import type { Span } from "../diagnostics.ts";
import type { InputConversion } from "../ir/ir.ts";
import { RunError } from "./run-error.ts";
import { bool, char, characterCount, int, real, str, type Value } from "./values.ts";

const INTEGER_TEXT = /^[+-]?\d+$/;
// A number as Python's float() reads one, without inf and nan: 3, -2.5, .5, 5., 1e3.
const REAL_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** How SH-06 names each type, and what to type instead ("Run the program again and type {example}."). */
const WORDS: Readonly<Record<Exclude<InputConversion, "str">, { expected: string; short: string; example: string }>> = {
  int: { expected: "an INTEGER (a whole number)", short: "a whole number", example: "a whole number, such as 42" },
  real: { expected: "a REAL (a number)", short: "a number", example: "a number, such as 3.5" },
  bool: { expected: "a BOOLEAN (TRUE or FALSE)", short: "TRUE or FALSE", example: "TRUE or FALSE" },
  char: {
    expected: "a CHARACTER (exactly one character)",
    short: "exactly one character",
    example: "exactly one character, such as A",
  },
};

/**
 * Converts one input line (SH-05: the line as typed, without its newline). INTEGER, REAL and BOOLEAN ignore spaces
 * around the value, as Python's int() and float() do; CHARACTER and STRING keep the line exactly. A line that
 * doesn't convert is E-RUN-INPUT-TYPE at the input statement (SH-06), never a silent 0. `file` is set for a line
 * read from a file (EDX-82).
 */
export function convertInput(line: string, convert: InputConversion, span: Span, file?: string): Value {
  const fail = (): never => {
    if (convert === "str") throw new Error("A STRING input always converts");
    // A line read from a file (EDX-82) gets its own wording, which names the file.
    if (file !== undefined)
      throw new RunError("E-RUN-INPUT-TYPE", span, { input: line, file, ...WORDS[convert] }, "file");
    throw new RunError("E-RUN-INPUT-TYPE", span, { input: `'${line}'`, ...WORDS[convert] });
  };
  const trimmed = line.trim();
  switch (convert) {
    case "int": {
      if (!INTEGER_TEXT.test(trimmed)) return fail();
      const value = Number(trimmed);
      if (!Number.isSafeInteger(value)) throw new RunError("E-RUN-NUMBER-TOO-LARGE", span); // SH-07
      return int(value);
    }
    case "real": {
      const value = Number(trimmed);
      if (!REAL_TEXT.test(trimmed) || !Number.isFinite(value)) return fail();
      return real(value);
    }
    case "bool": {
      const upper = trimmed.toUpperCase();
      if (upper === "TRUE") return bool(true);
      if (upper === "FALSE") return bool(false);
      return fail();
    }
    case "char":
      return characterCount(line) === 1 ? char(line) : fail();
    case "str":
      return str(line);
    default: {
      const unreachable: never = convert;
      throw new Error(`Unknown input conversion ${String(unreachable)}`);
    }
  }
}
