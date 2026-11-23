// Lines that are not M2 Edexcel statements: other languages' statements (SH-18, edexcel.md 2.11) and Edexcel
// statements whose engine parts arrive later (files).
import { Abandon, type Cursor } from "./cursor.ts";
import { startsExpression } from "./parse-expression.ts";
import type { Token } from "./tokens.ts";

/** Statements from other languages (SH-18, edexcel.md 2.11) and the Edexcel form to use instead. */
export const OTHER_LANGUAGE: Readonly<Record<string, string>> = {
  OUTPUT: "SEND <value> TO DISPLAY",
  PRINT: "SEND <value> TO DISPLAY",
  INPUT: "RECEIVE <name> FROM (<type>) KEYBOARD",
  DECLARE: "SET <name> TO <value>; there is no DECLARE",
  CASE: "nested IF statements",
  OPENFILE: "READ and WRITE, which open files by themselves",
  CLOSEFILE: "READ and WRITE, which open files by themselves",
  OPEN: "READ and WRITE, which open files by themselves",
  CLOSE: "READ and WRITE, which open files by themselves",
  READFILE: "READ <file> <variable>",
  WRITEFILE: "WRITE <file> <value>",
  CALL: "the procedure's name with brackets, e.g. Greet()",
  ELSEIF: "ELSE, then a nested IF",
  ELIF: "ELSE, then a nested IF",
};

/**
 * Reports a line that is not an M2 statement: another language's (SH-18), one arriving after M2, or one Sudocode
 * doesn't know. Lines that belong to it (a CASE's, a PROCEDURE's) are skipped; otherwise the line is abandoned.
 */
export function otherStatement(c: Cursor, t: Token, upper: string): void {
  const official = OTHER_LANGUAGE[upper];
  if (official !== undefined) {
    c.report("E-SYN-OTHER-LANGUAGE", t.span, { word: t.text, official }, "not-edexcel");
    if (upper === "CASE")
      skipUntil(c, (first, second) => first === "ENDCASE" || (first === "END" && second === "CASE"));
    else throw new Abandon();
    return;
  }
  const variant = startsExpression(c.peek(1)) ? "missing-set" : undefined;
  c.report("E-SYN-UNKNOWN-STATEMENT", t.span, { word: t.text }, variant);
  throw new Abandon();
}

/** Skips whole lines up to and including the first whose opening words satisfy `isEnd`. */
function skipUntil(c: Cursor, isEnd: (first: string, second: string) => boolean): void {
  for (;;) {
    c.skipLine();
    c.endLine();
    while (c.peek().kind === "newline") c.next();
    const t = c.peek();
    if (t.kind === "eof") return;
    const second = c.peek(1);
    if (isEnd(t.kind === "word" ? t.text.toUpperCase() : "", second.kind === "word" ? second.text.toUpperCase() : "")) {
      c.skipLine();
      c.endLine();
      return;
    }
  }
}
