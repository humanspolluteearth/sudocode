// Block closers (END IF, UNTIL, ELSE ...): recognising them at the start of a line and consuming them with the
// warnings or error their spelling earns (EDX-44, EDX-58, decisions D7 and D11).
import { Cursor } from "./cursor.ts";
import type { Token } from "./tokens.ts";

export type Closer = "ELSE" | "END IF" | "END WHILE" | "UNTIL" | "END REPEAT" | "END FOR" | "END FOREACH";

export interface Block {
  /** As the student reads it in messages: IF, WHILE, REPEAT, FOR, FOR EACH. */
  name: string;
  line: number;
  opener: Token;
  closers: Closer[];
  /** The closer named in "add END IF". */
  main: Closer;
}

export interface FoundCloser {
  closer: Closer;
  /** The closer's first word, where its diagnostics point. */
  token: Token;
  /** A closer that matched no open block, taken as this block's (already reported): its line is just skipped. */
  replaced?: boolean;
}

export function makeBlock(name: string, opener: Token, closers: Closer[]): Block {
  const main = closers[closers.length - 1] ?? "END IF";
  return { name, line: opener.span.line, opener, closers, main };
}

export /** The closer that starts this line, if any. */
function closerAhead(c: Cursor): FoundCloser | null {
  const t = c.peek();
  if (t.kind !== "word") return null;
  const next = c.peek(1);
  const upper = t.text.toUpperCase();
  if (c.isSymbol("=", 1) || (c.isSymbol("[", 1) && upper !== "UNTIL")) return null; // `end = ...` (D2)
  const one: Partial<Record<string, Closer>> = {
    ELSE: "ELSE",
    UNTIL: "UNTIL",
    ENDIF: "END IF",
    ENDWHILE: "END WHILE",
    ENDREPEAT: "END REPEAT",
    ENDFOR: "END FOR",
    ENDFOREACH: "END FOREACH",
  };
  const single = one[upper];
  if (single !== undefined) return { closer: single, token: t };
  if (upper !== "END" || next.kind !== "word") return null;
  const second = next.text.toUpperCase();
  const two: Partial<Record<string, Closer>> = {
    IF: "END IF",
    WHILE: "END WHILE",
    REPEAT: "END REPEAT",
    FOR: "END FOR",
    FOREACH: "END FOREACH",
  };
  if (second === "FOR" && Cursor.isWord(c.peek(2), "EACH")) return { closer: "END FOREACH", token: t };
  const closer = two[second];
  return closer === undefined ? null : { closer, token: t };
}

export /** Consumes a closer's words, with the warnings (or error) its spelling earns. */
function takeCloser(c: Cursor, found: FoundCloser): void {
  const first = c.next();
  const upper = first.text.toUpperCase();
  if (upper === "ENDIF") {
    c.report("W-EDX-ENDIF", first.span, {}, undefined, [{ ...range(first), replacement: "END IF" }]);
    return;
  }
  if (upper.startsWith("END") && upper !== "END") {
    // ENDWHILE, ENDFOR...: only ENDIF is a lenient one-word form (EDX-44); the rest close but are errors (D11).
    const args = { word: first.text, official: found.closer };
    c.report("E-SYN-ONE-WORD-CLOSER", first.span, args, undefined, [{ ...range(first), replacement: found.closer }]);
    return;
  }
  if (upper !== "END") {
    c.warnCase(first, upper); // ELSE, UNTIL
    return;
  }
  const second = c.next();
  if (Cursor.isWord(second, "FOR") && Cursor.isWord(c.peek(), "EACH")) {
    // A FOR EACH closed with END FOR EACH (EDX-58): its own warning, which also fixes the case (D7).
    const each = c.next();
    const edits = [{ start: first.span.start, end: each.span.end, replacement: "END FOREACH" }];
    c.report("W-EDX-FOREACH", first.span, { word: "END FOR EACH", official: "END FOREACH" }, undefined, edits);
    return;
  }
  c.warnCase(first, "END");
  c.warnCase(second, second.text.toUpperCase());
}

function range(t: Token): { start: number; end: number } {
  return { start: t.span.start, end: t.span.end };
}

export /** A closer with no open block to close (at the top level). */
function unmatched(c: Cursor, found: FoundCloser): void {
  const owner =
    found.closer === "ELSE" || found.closer === "END IF"
      ? "IF"
      : found.closer === "UNTIL"
        ? "REPEAT"
        : found.closer.slice(4);
  c.report("E-SYN-UNMATCHED-CLOSER", found.token.span, {
    closer: found.closer,
    block: owner === "FOREACH" ? "FOR EACH" : owner,
  });
  c.skipLine();
  c.endLine();
}
