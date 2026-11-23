// READ and WRITE: the Edexcel file statements (EDX-80 to EDX-84).
import type { FileName, Stmt } from "./ast.ts";
import type { Cursor } from "./cursor.ts";
import { parseExpression } from "./parse-expression.ts";
import type { Token } from "./tokens.ts";

/** A file name: bare (`Scores.txt`, one `file` token from the lexer) or quoted (`'Scores.txt'`), EDX-80. */
function fileName(c: Cursor, advice: string): FileName {
  const t = c.peek();
  if (t.kind === "file") return { name: c.next().text, span: t.span };
  if (t.kind === "string") return { name: c.next().value ?? "", span: t.span };
  return c.fail("a file name such as Scores.txt", advice);
}

/** `READ file variable` (EDX-82): one variable; a second one is parsed so the checker can explain it. */
export function parseRead(c: Cursor, name: (advice: string) => Token): Stmt {
  const advice = "Write READ <file> <variable>, e.g. READ Scores.txt line.";
  const first = c.next();
  c.warnCase(first, "READ");
  const file = fileName(c, advice);
  const n = name(advice);
  let extra = null;
  while (c.peek().kind === "word" || c.isSymbol(",")) {
    const t = c.next();
    if (t.kind === "word") extra ??= { name: t.text, span: t.span };
  }
  const span = c.spanFrom(first);
  c.endStatement();
  return { kind: "read", file, name: n.text, nameSpan: n.span, extra, span };
}

/** `WRITE file value` (EDX-81): one expression; a comma list is parsed so the checker can explain it. */
export function parseWrite(c: Cursor): Stmt {
  const advice = "Write WRITE <file> <value>, e.g. WRITE Scores.txt name & ' ' & score.";
  const first = c.next();
  c.warnCase(first, "WRITE");
  const file = fileName(c, advice);
  const value = parseExpression(c);
  let comma = null;
  while (c.isSymbol(",")) {
    const t = c.next();
    comma ??= t.span;
    if (c.peek().kind !== "newline") parseExpression(c);
  }
  const span = c.spanFrom(first);
  c.endStatement();
  return { kind: "write", file, value, comma, span };
}
