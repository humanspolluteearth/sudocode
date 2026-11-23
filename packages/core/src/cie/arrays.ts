// CIE array types: `ARRAY[1:30] OF STRING` and `ARRAY[1:3, 1:3] OF CHAR` (CIE-20, CIE-21).
//
// Compiler concept: *recursive descent* again, on the type grammar: ARRAY "[" bound ":" bound {"," bound ":" bound}
// "]" OF type. The declared bounds are kept in the type, so the checker can compare sizes (CIE-23) and the IR can
// say where counting starts (`base`).
import type { CieCursor } from "./cursor.ts";
import { joinSpans } from "./cursor.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { Ty } from "./types.ts";

/** A whole number written in the source, such as 1, 30 or -5. */
function bound(c: CieCursor): number {
  const negative = c.isSymbol("-");
  if (negative) c.next();
  const t = c.peek();
  if (t.kind !== "int")
    return c.fail("a whole number", "Write the first and last index as whole numbers, e.g. [1:30].");
  c.next();
  const n = Number(t.text);
  return negative ? -n : n;
}

/**
 * Parses an array type after the word ARRAY has been read. `scalar` reads the item type. A 2D array whose two
 * dimensions start at different numbers has no single `base` in the IR, so it is reported as not supported yet.
 */
export function arrayType(c: CieCursor, arrayWord: Token, scalar: () => Ty): Ty {
  c.expectSymbol("[", "[", "Write the indexes after ARRAY, e.g. ARRAY[1:30] OF STRING.");
  const lows: number[] = [];
  const dims: number[] = [];
  for (;;) {
    const low = bound(c);
    c.expectSymbol(":", ":", "Write the first and last index with a colon, e.g. [1:30].");
    const highToken = c.peek();
    const high = bound(c);
    if (high < low) {
      c.report("E-SYN-EXPECTED", highToken.span, {
        expected: `a last index of ${String(low)} or more`,
        found: String(high),
        advice: "The last index cannot be smaller than the first.",
      });
      return c.failSilently();
    }
    lows.push(low);
    dims.push(high - low + 1);
    if (!c.isSymbol(",")) break;
    c.next();
  }
  const close = c.expectSymbol("]", "] or ,", "Close the indexes with ].");
  if (dims.length > 2 || (lows[1] !== undefined && lows[1] !== lows[0])) {
    c.report("E-SYN-NOT-SUPPORTED", joinSpans(arrayWord.span, close.span), {
      feature:
        dims.length > 2
          ? "An ARRAY with more than two dimensions"
          : "A 2D ARRAY whose indexes start at different numbers",
      advice: "Use the same first index in both dimensions, e.g. ARRAY[1:3, 1:3].",
    });
    return c.failSilently();
  }
  c.expectKeyword("OF", "Write OF and the item type, e.g. ARRAY[1:30] OF STRING.");
  return { kind: "ARRAY", of: scalar(), lows, dims };
}
