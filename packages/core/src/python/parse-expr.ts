// Python expressions: a Pratt-style precedence climb.
//
// Compiler concept: *Pratt parsing / precedence climbing*. Each operator level is a method that parses the next
// tighter level for its operands, then loops while it sees its own operators. `or` is the loosest, then `and`,
// `not`, comparisons, `+ -`, `* / // %`, unary minus, `**` and finally calls, indexes and attributes, so
// `-2 ** 2` is `-(2 ** 2)` and `a or b and c` is `a or (b and c)`.
import type { PyArithOp, PyCompareOp } from "../ir/python-ir.ts";
import type { SArg, SCompClause, SExpr, SFPart, SParam } from "./ast.ts";
import { Cursor, ParseFail } from "./cursor.ts";
import { decodeEscapes, lex, type Token } from "./lexer.ts";

export const KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const BITWISE = ["<<", ">>", "~"];
const COMPARE: Record<string, PyCompareOp> = { "==": "eq", "!=": "ne", "<": "lt", "<=": "le", ">": "gt", ">=": "ge" };
const NO_BITWISE = [
  "Bitwise operators",
  "Bitwise operators are not in the Python subset yet. Use arithmetic (// and %) instead.",
] as const;

export class ExprParser extends Cursor {
  expression(): SExpr {
    if (this.isWord("lambda")) return this.lambda();
    const first = this.tok.span;
    const body = this.orTest();
    if (this.isOp(":=")) {
      this.unsupported(
        this.tok.span,
        "The := operator",
        "The := operator is not in the Python subset yet. Assign on one line and test on the next.",
      );
    }
    if (this.isWord("if")) {
      this.next();
      const test = this.orTest();
      if (!this.acceptWord("else")) this.fail(this.tok.span, "expected 'else' after 'if' expression");
      const other = this.expression();
      return { kind: "ifexp", test, then: body, else: other, span: this.since(first) };
    }
    return body;
  }

  /** `a, b, c` without brackets is a tuple (assignment targets, return values, for targets, subscripts). */
  expressionList(): SExpr {
    const first = this.tok.span;
    const e = this.expression();
    if (!this.isOp(",")) return e;
    const items = [e];
    while (this.acceptOp(",")) {
      if (this.endsList()) break;
      items.push(this.expression());
    }
    return { kind: "tuple", items, span: this.since(first) };
  }

  private endsList(): boolean {
    const t = this.tok;
    return (
      t.type === "newline" || t.type === "eof" || (t.type === "op" && [")", "]", "}", "=", ":", ";"].includes(t.value))
    );
  }

  private lambda(): SExpr {
    const first = this.next().span;
    const params = this.params(":");
    this.expectOp(":");
    const body = this.expression();
    return { kind: "lambda", params, body, span: this.since(first) };
  }

  /** Parameters up to `close` (")" for def, ":" for lambda). */
  params(close: string): SParam[] {
    const out: SParam[] = [];
    while (!this.isOp(close)) {
      const t = this.tok;
      if (this.isOp("*") || this.isOp("**")) {
        this.unsupported(
          t.span,
          "*args and **kwargs",
          "*args and **kwargs are not in the Python subset yet. Use a list parameter instead.",
        );
      }
      if (t.type !== "name" || KEYWORDS.has(t.value)) this.fail(t.span);
      this.next();
      let def: SExpr | null = null;
      if (this.acceptOp("=")) def = this.expression();
      else if (out.some((p) => p.default !== null))
        this.fail(t.span, "parameter without a default follows parameter with a default");
      out.push({ name: t.value, default: def, span: t.span });
      if (!this.acceptOp(",")) break;
    }
    return out;
  }

  private orTest(): SExpr {
    const first = this.tok.span;
    let left = this.andTest();
    while (this.isWord("or")) {
      this.next();
      left = { kind: "boolop", op: "or", left, right: this.andTest(), span: this.since(first) };
    }
    return left;
  }

  private andTest(): SExpr {
    const first = this.tok.span;
    let left = this.notTest();
    while (this.isWord("and")) {
      this.next();
      left = { kind: "boolop", op: "and", left, right: this.notTest(), span: this.since(first) };
    }
    return left;
  }

  private notTest(): SExpr {
    if (this.isWord("not")) {
      const first = this.next().span;
      const operand = this.notTest();
      return { kind: "not", operand, span: this.since(first) };
    }
    return this.comparison();
  }

  private compareOp(): PyCompareOp | null {
    const t = this.tok;
    if (t.type === "op" && COMPARE[t.value] !== undefined) {
      this.next();
      return COMPARE[t.value] as PyCompareOp;
    }
    if (this.isWord("in")) {
      this.next();
      return "in";
    }
    if (this.isWord("not") && this.isWord("in", this.peek())) {
      this.next();
      this.next();
      return "notIn";
    }
    if (this.isWord("is")) {
      this.next();
      return this.acceptWord("not") ? "isNot" : "is";
    }
    if (this.isOp("<>")) this.fail(t.span);
    return null;
  }

  private comparison(): SExpr {
    const first = this.tok.span;
    const left = this.bitOr();
    const ops: PyCompareOp[] = [];
    const operands = [left];
    for (let op = this.compareOp(); op !== null; op = this.compareOp()) {
      ops.push(op);
      operands.push(this.bitOr());
    }
    if (BITWISE.includes(this.tok.value) && this.tok.type === "op") this.unsupported(this.tok.span, ...NO_BITWISE);
    return ops.length === 0 ? left : { kind: "compare", ops, operands, span: this.since(first) };
  }

  private binary(next: () => SExpr, ops: Record<string, PyArithOp>): SExpr {
    const first = this.tok.span;
    let left = next();
    while (this.tok.type === "op" && ops[this.tok.value] !== undefined) {
      const op = ops[this.tok.value] as PyArithOp;
      this.next();
      left = { kind: "binop", op, left, right: next(), span: this.since(first) };
    }
    return left;
  }

  // `|`, `^`, `&` (loosest to tightest, all below + and -): integers and, above all, set union, difference-free
  // symmetric difference and intersection (PY-17). Shifts and `~` stay unsupported.
  private bitOr(): SExpr {
    return this.binary(() => this.bitXor(), { "|": "bitor" });
  }

  private bitXor(): SExpr {
    return this.binary(() => this.bitAnd(), { "^": "bitxor" });
  }

  private bitAnd(): SExpr {
    return this.binary(() => this.arith(), { "&": "bitand" });
  }

  private arith(): SExpr {
    return this.binary(() => this.term(), { "+": "add", "-": "sub" });
  }

  private term(): SExpr {
    return this.binary(() => this.factor(), { "*": "mul", "/": "truediv", "//": "floordiv", "%": "mod" });
  }

  private factor(): SExpr {
    const t = this.tok;
    if (t.type === "op" && (t.value === "-" || t.value === "+")) {
      this.next();
      const operand = this.factor();
      return { kind: t.value === "-" ? "neg" : "pos", operand, span: this.since(t.span) };
    }
    if (this.isOp("~")) this.unsupported(t.span, ...NO_BITWISE);
    return this.power();
  }

  private power(): SExpr {
    const first = this.tok.span;
    const base = this.postfix();
    if (this.acceptOp("**"))
      return { kind: "binop", op: "pow", left: base, right: this.factor(), span: this.since(first) };
    return base;
  }

  private postfix(): SExpr {
    const first = this.tok.span;
    let e = this.atom();
    for (;;) {
      if (this.isOp("(")) {
        this.next();
        const args = this.callArgs();
        this.expectOp(")", "'(' was never closed");
        e = { kind: "call", callee: e, args, span: this.since(first) };
      } else if (this.isOp("[")) {
        this.next();
        e = this.subscript(e, first);
        this.expectOp("]", "'[' was never closed");
        e = { ...e, span: this.since(first) };
      } else if (this.isOp(".")) {
        this.next();
        const n = this.tok;
        if (n.type !== "name") this.fail(n.span);
        this.next();
        e = { kind: "attr", target: e, name: n.value, span: this.since(first) };
      } else return e;
    }
  }

  private subscript(target: SExpr, first: { line: number; column: number; start: number; end: number }): SExpr {
    const part = (): SExpr | null => (this.isOp(":") || this.isOp("]") ? null : this.expression());
    const lower = part();
    if (!this.isOp(":")) {
      if (lower === null) this.fail(this.tok.span);
      if (this.isOp(",")) {
        const items = [lower];
        while (this.acceptOp(",")) {
          if (this.isOp("]")) break;
          items.push(this.expression());
        }
        return {
          kind: "index",
          target,
          index: { kind: "tuple", items, span: this.since(lower.span) },
          span: this.since(first),
        };
      }
      return { kind: "index", target, index: lower, span: this.since(first) };
    }
    this.next();
    const upper = part();
    const step = this.acceptOp(":") ? part() : null;
    return { kind: "slice", target, lower, upper, step, span: this.since(first) };
  }

  private callArgs(): SArg[] {
    const args: SArg[] = [];
    while (!this.isOp(")")) {
      const t = this.tok;
      if (this.isOp("*") || this.isOp("**")) {
        this.unsupported(
          t.span,
          "*args and **kwargs",
          "*args and **kwargs are not in the Python subset yet. Use a list parameter instead.",
        );
      }
      if (t.type === "name" && this.isOp("=", this.peek()) && !KEYWORDS.has(t.value)) {
        this.next();
        this.next();
        args.push({ name: t.value, value: this.expression() });
      } else {
        const value = this.expression();
        if (this.isWord("for")) args.push({ name: null, value: this.comprehension(value, t.span) });
        else args.push({ name: null, value });
      }
      if (!this.acceptOp(",")) break;
    }
    return args;
  }

  private comprehension(element: SExpr, first: { line: number; column: number; start: number; end: number }): SExpr {
    const clauses: SCompClause[] = [];
    while (this.isWord("for") || this.isWord("if")) {
      if (this.next().value === "if") {
        clauses.push({ kind: "if", expr: this.orTest() });
        continue;
      }
      const target = this.targetList();
      if (!this.acceptWord("in")) this.fail(this.tok.span, "expected 'in'");
      clauses.push({ kind: "for", target, expr: this.orTest() });
    }
    return { kind: "comp", element, clauses, span: this.since(first) };
  }

  /** The names after `for` (no `in` operator allowed inside, so comparison is skipped). */
  targetList(): SExpr {
    const first = this.tok.span;
    const one = (): SExpr => (this.isOp("(") ? this.atom() : this.postfix());
    const e = one();
    if (!this.isOp(",")) return e;
    const items = [e];
    while (this.acceptOp(",")) {
      if (this.isWord("in")) break;
      items.push(one());
    }
    return { kind: "tuple", items, span: this.since(first) };
  }

  private atom(): SExpr {
    const t = this.tok;
    switch (t.type) {
      case "int":
        this.next();
        return { kind: "int", value: BigInt(t.value), span: t.span };
      case "float":
        this.next();
        return { kind: "float", value: Number(t.value), span: t.span };
      case "str":
      case "fstr":
        return this.strings();
      case "bytes":
        return this.unsupported(
          t.span,
          "Bytes strings",
          "Bytes strings are not in the Python subset yet. Use ordinary strings instead.",
        );
      case "name":
        return this.nameAtom(t);
      case "op":
        break;
      default:
        return this.fail(t.span);
    }
    if (t.value === "(") return this.parenthesised(t);
    if (t.value === "[") {
      this.next();
      const items: SExpr[] = [];
      while (!this.isOp("]")) {
        const e = this.expression();
        if (items.length === 0 && this.isWord("for")) {
          const comp = this.comprehension(e, t.span);
          this.expectOp("]", "'[' was never closed");
          return { ...comp, span: this.since(t.span) };
        }
        items.push(e);
        if (!this.acceptOp(",")) break;
      }
      this.expectOp("]", "'[' was never closed");
      return { kind: "list", items, span: this.since(t.span) };
    }
    if (t.value === "{") return this.braces(t);
    if (t.value === "...") return this.fail(t.span);
    return this.fail(t.span);
  }

  private nameAtom(t: Token): SExpr {
    switch (t.value) {
      case "True":
      case "False":
        this.next();
        return { kind: "const", value: t.value === "True", span: t.span };
      case "None":
        this.next();
        return { kind: "const", value: null, span: t.span };
      case "yield":
        return this.unsupported(
          t.span,
          "yield (generators)",
          "Generators are not in the Python subset yet. Build a list and return it instead.",
        );
      case "await":
      case "async":
        return this.unsupported(
          t.span,
          "async and await",
          "async and await are not in the Python subset yet. Write ordinary functions instead.",
        );
      case "eval":
      case "exec":
        if (this.isOp("(", this.peek()))
          return this.unsupported(
            t.span,
            "eval and exec",
            "eval and exec are not in the Python subset yet. Write the code out directly instead.",
          );
    }
    if (KEYWORDS.has(t.value)) return this.fail(t.span);
    this.next();
    return { kind: "name", name: t.value, span: t.span };
  }

  private parenthesised(open: Token): SExpr {
    this.next();
    if (this.acceptOp(")")) return { kind: "tuple", items: [], span: this.since(open.span) };
    const first = this.expression();
    if (this.isWord("for")) {
      const comp = this.comprehension(first, open.span);
      this.expectOp(")", "'(' was never closed");
      return { ...comp, span: this.since(open.span) };
    }
    if (this.isOp(",")) {
      const items = [first];
      while (this.acceptOp(",")) {
        if (this.isOp(")")) break;
        items.push(this.expression());
      }
      this.expectOp(")", "'(' was never closed");
      return { kind: "tuple", items, span: this.since(open.span) };
    }
    this.expectOp(")", "'(' was never closed");
    return first; // plain brackets only group: the inner expression keeps its own span
  }

  private braces(open: Token): SExpr {
    this.next();
    const comprehension = (): never =>
      this.unsupported(
        open.span,
        "Dictionary and set comprehensions",
        "Only list comprehensions are in the Python subset. Build the dictionary with a for loop instead.",
      );
    if (this.acceptOp("}")) return { kind: "dict", pairs: [], span: this.since(open.span) };
    const k = this.expression();
    if (this.isOp(":")) {
      this.next();
      const pairs = [{ key: k, value: this.expression() }];
      if (this.isWord("for")) comprehension();
      while (this.acceptOp(",")) {
        if (this.isOp("}")) break;
        const key = this.expression();
        this.expectOp(":");
        pairs.push({ key, value: this.expression() });
      }
      this.expectOp("}", "'{' was never closed");
      return { kind: "dict", pairs, span: this.since(open.span) };
    }
    if (this.isWord("for")) comprehension();
    const items = [k];
    while (this.acceptOp(",")) {
      if (this.isOp("}")) break;
      items.push(this.expression());
    }
    this.expectOp("}", "'{' was never closed");
    return { kind: "set", items, span: this.since(open.span) };
  }

  /** Adjacent string literals join into one ("a" "b"); any f-string among them makes the whole an f-string. */
  private strings(): SExpr {
    const first = this.tok.span;
    const parts: SFPart[] = [];
    let anyF = false;
    while (this.tok.type === "str" || this.tok.type === "fstr") {
      const t = this.next();
      if (t.type === "str") parts.push({ kind: "text", text: t.value });
      else {
        anyF = true;
        parts.push(...this.fparts(t.bodyStart, t.bodyStart + t.value.length, t.raw));
      }
    }
    const span = this.since(first);
    if (!anyF) return { kind: "str", value: parts.map((p) => (p.kind === "text" ? p.text : "")).join(""), span };
    return { kind: "fstr", parts, span };
  }

  /** Splits the raw body of an f-string (source offsets `from` to `to`) into text and `{...}` fields. */
  private fparts(from: number, to: number, raw: boolean): SFPart[] {
    const src = this.loc.source;
    const out: SFPart[] = [];
    let text = "";
    const flush = (): void => {
      if (text !== "") out.push({ kind: "text", text: raw ? text : decodeEscapes(text) });
      text = "";
    };
    for (let i = from; i < to; i++) {
      const c = src[i] as string;
      if (c === "{" && src[i + 1] === "{") {
        text += "{";
        i++;
        continue;
      }
      if (c === "}" && src[i + 1] === "}") {
        text += "}";
        i++;
        continue;
      }
      if (c === "}") this.fail(this.loc.span(i, i + 1), "f-string: single '}' is not allowed");
      if (c !== "{") {
        text += c;
        continue;
      }
      flush();
      // Find the end of the expression: the first top-level `!`, `:` or `}`.
      let depth = 0;
      let j = i + 1;
      let quote = "";
      for (; j < to; j++) {
        const d = src[j] as string;
        if (quote !== "") {
          if (d === quote) quote = "";
          continue;
        }
        if (d === "'" || d === '"') quote = d;
        else if ("([{".includes(d)) depth++;
        else if (")]".includes(d)) depth--;
        else if (d === "}" && depth > 0) depth--;
        else if (depth === 0 && (d === "}" || d === ":" || (d === "!" && src[j + 1] !== "="))) break;
      }
      if (j >= to) this.fail(this.loc.span(i, i + 1), "f-string: expecting '}'");
      const sub = new ExprParser(lex(this.loc, this.report, i + 1, j, true), this.loc, this.report);
      if (sub.tok.type === "eof") this.fail(this.loc.span(i, i + 1), "f-string: valid expression required before '}'");
      const value = sub.expressionList();
      if (sub.kind() !== "eof") this.fail(sub.tok.span);
      let conversion: "s" | "r" | "a" | null = null;
      if (src[j] === "!") {
        const k = src[j + 1];
        if (k !== "s" && k !== "r" && k !== "a")
          this.fail(this.loc.span(j, j + 2), "f-string: invalid conversion character");
        conversion = k;
        j += 2;
      }
      let spec: SFPart[] = [];
      if (src[j] === ":") {
        let e = j + 1;
        for (let d = 0; e < to && !(src[e] === "}" && d === 0); e++) {
          if (src[e] === "{") d++;
          else if (src[e] === "}") d--;
        }
        spec = this.fparts(j + 1, e, true);
        j = e;
      }
      if (src[j] !== "}") this.fail(this.loc.span(i, i + 1), "f-string: expecting '}'");
      out.push({ kind: "field", value, conversion, spec });
      i = j;
    }
    flush();
    return out;
  }
}

export { ParseFail };
