// RECEIVE: the Edexcel input statement (EDX-72 to EDX-74), parsed by recursive descent like the others in parser.ts.
import { TYPES, type Stmt, type TypeName } from "./ast.ts";
import { Cursor } from "./cursor.ts";
import type { Token } from "./tokens.ts";

const ADVICE = "Write RECEIVE <name> FROM (<type>) KEYBOARD, e.g. RECEIVE age FROM (INTEGER) KEYBOARD.";

/**
 * `RECEIVE name FROM (type) device`. Without the bracketed type the statement still parses, with `type` null, so
 * the checker can give the EDX-73 error with the student's own name in the hint.
 */
export function parseReceive(c: Cursor, name: (advice: string) => Token): Stmt {
  const first = c.next();
  c.warnCase(first, "RECEIVE");
  const n = name(ADVICE);
  c.expectKeyword("FROM", ADVICE);
  let type: TypeName | null = null;
  let typeSpan = null;
  if (c.isSymbol("(")) {
    c.next();
    const typeToken = c.peek();
    const found = TYPES.find((t) => Cursor.isWord(typeToken, t));
    if (found === undefined) return c.fail("a type (INTEGER, REAL, BOOLEAN, CHARACTER or STRING)", ADVICE);
    c.next();
    c.warnCase(typeToken, found);
    type = found;
    typeSpan = typeToken.span;
    c.expectSymbol(")", ")", ADVICE);
  }
  const device = c.peek();
  if (device.kind !== "word") return c.fail("a device such as KEYBOARD", ADVICE);
  c.next();
  const upper = device.text.toUpperCase();
  const keyboard = upper === "KEYBOARD";
  if (keyboard) c.warnCase(device, upper);
  const span = c.spanFrom(first);
  c.endStatement();
  return {
    kind: "receive",
    name: n.text,
    nameSpan: n.span,
    type,
    typeSpan,
    device: keyboard ? "KEYBOARD" : device.text,
    deviceSpan: device.span,
    span,
  };
}
