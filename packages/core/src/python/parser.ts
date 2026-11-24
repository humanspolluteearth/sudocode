// The Python statement parser: tokens -> surface AST (ast.ts).
//
// Compiler concept: *recursive descent*. One method per kind of statement (`ifStatement`, `forStatement`, ...),
// each calling the others for what is nested inside it; a block is `INDENT statements DEDENT`.
//
// Compiler concept: *panic-mode error recovery*. When a statement is malformed the parser reports it, throws
// `ParseFail`, and the statement loop catches it and skips to the end of that line (and its indented block), so a
// student sees every separate mistake in one go, not just the first.
import type { PyArithOp } from "../ir/python-ir.ts";
import type { SExpr, SHandler, SStmt } from "./ast.ts";
import { ParseFail } from "./cursor.ts";
import { KEYWORDS, ExprParser } from "./parse-expr.ts";
import { lex } from "./lexer.ts";
import type { Locator, Reporter } from "./locator.ts";
import { noteMissingDeclarations } from "./class-notes.ts";
import type { Span } from "../diagnostics.ts";

const AUGMENTED: Record<string, PyArithOp> = {
  "+=": "add",
  "-=": "sub",
  "*=": "mul",
  "/=": "truediv",
  "//=": "floordiv",
  "%=": "mod",
  "**=": "pow",
};
const MODULES = ["math", "random", "datetime", "time"];

class StatementParser extends ExprParser {
  program(): SStmt[] {
    const out: SStmt[] = [];
    while (this.tok.type !== "eof") this.statementInto(out);
    return out;
  }

  /** Parses one statement (or one `;`-separated line) into `out`, recovering from a syntax error. */
  private statementInto(out: SStmt[]): void {
    try {
      const t = this.tok;
      if (t.type === "indent") {
        this.report.syntax(t.span, "unexpected indent", true);
        this.skipLine();
        throw new ParseFail();
      }
      if (t.type === "dedent" || t.type === "newline") {
        this.next();
        return;
      }
      if (this.isCompound()) out.push(this.compound());
      else this.simpleLine(out);
    } catch (err) {
      if (!(err instanceof ParseFail)) throw err;
      this.skipLine();
    }
  }

  /** Skips to the end of the current logical line, and over the indented block that follows it, if any. */
  private skipLine(): void {
    while (this.tok.type !== "newline" && this.tok.type !== "eof") this.next();
    if (this.kind() === "newline") this.next();
    if (this.kind() === "indent") {
      let depth = 0;
      do {
        if (this.kind() === "indent") depth++;
        else if (this.kind() === "dedent") depth--;
        this.next();
      } while (depth > 0 && this.kind() !== "eof");
    }
  }

  private isCompound(): boolean {
    const t = this.tok;
    if (t.type === "op") return t.value === "@";
    if (t.type !== "name") return false;
    if (["if", "while", "for", "def", "try", "class", "with", "async"].includes(t.value)) return true;
    return t.value === "match" && this.looksLikeMatch();
  }

  /** `match x:` followed by an indented `case`: a soft keyword, so only when the whole shape fits (PY-12). */
  private looksLikeMatch(): boolean {
    let i = 1;
    while (this.peek(i).type !== "newline" && this.peek(i).type !== "eof") i++;
    const colon = this.peek(i - 1);
    return this.isOp(":", colon) && this.peek(i + 1).type === "indent" && this.isWord("case", this.peek(i + 2));
  }

  private simpleLine(out: SStmt[]): void {
    for (;;) {
      out.push(this.simple());
      if (!this.acceptOp(";")) break;
      if (this.tok.type === "newline" || this.tok.type === "eof") break;
    }
    if (this.tok.type === "newline") this.next();
    else if (this.tok.type !== "eof") this.fail(this.tok.span);
  }

  private block(opener: string, line: number): SStmt[] {
    if (this.tok.type !== "newline") {
      const out: SStmt[] = [];
      this.simpleLine(out);
      return out;
    }
    this.next();
    if (this.kind() !== "indent") {
      this.report.syntax(this.tok.span, `expected an indented block after ${opener} on line ${String(line)}`, true);
      throw new ParseFail();
    }
    this.next();
    const body: SStmt[] = [];
    while (this.kind() !== "dedent" && this.kind() !== "eof") this.statementInto(body);
    if (this.kind() === "dedent") this.next();
    return body;
  }

  private colon(): void {
    this.expectOp(":");
  }

  private condition(): SExpr {
    const e = this.expression();
    if (this.isOp("=")) this.fail(this.tok.span, "invalid syntax. Maybe you meant '==' or ':=' instead of '='?");
    return e;
  }

  private compound(): SStmt {
    const t = this.tok;
    switch (t.value) {
      case "@":
        return this.unsupported(
          t.span,
          "Decorators",
          "Decorators are not in the Python subset yet. Call the function directly instead.",
        );
      case "async":
        return this.unsupported(
          t.span,
          "async and await",
          "async and await are not in the Python subset yet. Write ordinary functions instead.",
        );
      case "match":
        return this.unsupported(
          t.span,
          "match/case",
          "match/case is not in the Python subset yet. Use if / elif / else instead.",
        );
      case "class":
        return this.classStatement();
      case "with":
        return this.withStatement();
      case "if":
        return this.ifStatement();
      case "while":
        return this.whileStatement();
      case "for":
        return this.forStatement();
      case "def":
        return this.def();
      default:
        return this.tryStatement();
    }
  }

  /** `with open(...) as f:` (PY-21). Lowering turns it into try/finally so the file closes even after an error. */
  private withStatement(): SStmt {
    const first = this.next();
    const items: { expr: SExpr; target: SExpr | null }[] = [];
    do {
      const expr = this.expression();
      items.push({ expr, target: this.acceptWord("as") ? this.expression() : null });
    } while (this.acceptOp(","));
    this.colon();
    const body = this.block("'with' statement", first.span.line);
    return { kind: "with", items, body, span: this.since(first.span) };
  }

  private ifStatement(): SStmt {
    const first = this.next();
    const test = this.condition();
    this.colon();
    const then = this.block(`'${first.value}' statement`, first.span.line);
    let orelse: SStmt[] = [];
    if (this.isWord("elif")) orelse = [this.ifStatement()];
    else if (this.isWord("else")) {
      const e = this.next();
      this.colon();
      orelse = this.block("'else' statement", e.span.line);
    }
    return { kind: "if", test, then, else: orelse, span: this.since(first.span) };
  }

  private elseBlock(): SStmt[] {
    if (!this.isWord("else")) return [];
    const e = this.next();
    this.colon();
    return this.block("'else' statement", e.span.line);
  }

  private whileStatement(): SStmt {
    const first = this.next();
    const test = this.condition();
    this.colon();
    const body = this.block("'while' statement", first.span.line);
    return { kind: "while", test, body, orelse: this.elseBlock(), span: this.since(first.span) };
  }

  private forStatement(): SStmt {
    const first = this.next();
    const target = this.targetList();
    if (!this.acceptWord("in")) this.fail(this.tok.span, "expected 'in'");
    const iter = this.expressionList();
    this.colon();
    const body = this.block("'for' statement", first.span.line);
    return { kind: "for", target, iter, body, orelse: this.elseBlock(), span: this.since(first.span) };
  }

  private def(): SStmt {
    const first = this.next();
    const name = this.tok;
    if (name.type !== "name" || KEYWORDS.has(name.value)) this.fail(name.span);
    this.next();
    this.expectOp("(");
    const params = this.params(")");
    this.expectOp(")", "'(' was never closed");
    this.colon();
    const body = this.block(`function definition`, first.span.line);
    return { kind: "def", name: name.value, params, body, span: this.since(first.span) };
  }

  private classStatement(): SStmt {
    const first = this.next();
    const name = this.tok;
    if (name.type !== "name" || KEYWORDS.has(name.value)) this.fail(name.span);
    this.next();
    const bases: SExpr[] = [];
    if (this.acceptOp("(")) {
      while (!this.isOp(")")) {
        if (this.isOp("*") || this.isOp("**") || (this.tok.type === "name" && this.isOp("=", this.peek())))
          this.unsupported(
            this.tok.span,
            "Class keywords",
            "Only plain base classes are in the Python subset, e.g. class Dog(Animal).",
          );
        bases.push(this.expression());
        if (!this.acceptOp(",")) break;
      }
      this.expectOp(")", "'(' was never closed");
    }
    this.colon();
    const body = this.block("class definition", first.span.line);
    const span = this.since(first.span);
    noteMissingDeclarations(name.value, body, first.span, this.loc.source, this.report);
    return { kind: "class", name: name.value, bases, body, span };
  }

  private tryStatement(): SStmt {
    const first = this.next();
    this.colon();
    const body = this.block("'try' statement", first.span.line);
    const handlers: SHandler[] = [];
    while (this.isWord("except")) {
      const e = this.next();
      let types: SExpr | null = null;
      let name: string | null = null;
      if (!this.isOp(":")) {
        types = this.expression();
        if (this.acceptWord("as")) {
          const n = this.tok;
          if (n.type !== "name" || KEYWORDS.has(n.value)) this.fail(n.span);
          this.next();
          name = n.value;
        }
      }
      this.colon();
      handlers.push({ types, name, body: this.block("'except' statement", e.span.line), span: this.since(e.span) });
    }
    const orelse = handlers.length > 0 ? this.elseBlock() : [];
    let final: SStmt[] = [];
    if (this.isWord("finally")) {
      const f = this.next();
      this.colon();
      final = this.block("'finally' statement", f.span.line);
    }
    if (handlers.length === 0 && final.length === 0) this.fail(this.tok.span, "expected 'except' or 'finally' block");
    return { kind: "try", body, handlers, orelse, final, span: this.since(first.span) };
  }

  private simple(): SStmt {
    const t = this.tok;
    const first = t.span;
    const done = (s: SStmt): SStmt => s;
    if (t.type === "name") {
      switch (t.value) {
        case "pass":
        case "break":
        case "continue":
          this.next();
          return done({ kind: t.value, span: t.span });
        case "return": {
          this.next();
          const value = this.endsSimple() ? null : this.expressionList();
          return { kind: "return", value, span: this.since(first) };
        }
        case "global": {
          this.next();
          const names: string[] = [];
          do {
            const n = this.tok;
            if (n.type !== "name" || KEYWORDS.has(n.value)) this.fail(n.span);
            names.push(this.next().value);
          } while (this.acceptOp(","));
          return { kind: "global", names, span: this.since(first) };
        }
        case "nonlocal":
          return this.unsupported(
            t.span,
            "nonlocal",
            "nonlocal is not in the Python subset yet. Pass the value in as a parameter and return the new value.",
          );
        case "del": {
          this.next();
          const e = this.expressionList();
          return { kind: "del", targets: e.kind === "tuple" ? e.items : [e], span: this.since(first) };
        }
        case "raise": {
          this.next();
          const exc = this.endsSimple() ? null : this.expression();
          if (this.isWord("from"))
            this.unsupported(
              this.tok.span,
              "raise ... from",
              "raise ... from is not in the Python subset yet. Raise the exception on its own.",
            );
          return { kind: "raise", exc, span: this.since(first) };
        }
        case "assert": {
          this.next();
          const test = this.expression();
          const message = this.acceptOp(",") ? this.expression() : null;
          return { kind: "assert", test, message, span: this.since(first) };
        }
        case "import":
        case "from":
          return this.importStatement();
        case "print":
          if (
            ["str", "int", "float", "fstr"].includes(this.peek().type) ||
            (this.peek().type === "name" &&
              !KEYWORDS.has(this.peek().value) &&
              !this.isWord("is", this.peek()) &&
              !this.isWord("in", this.peek()))
          ) {
            this.fail(t.span, "Missing parentheses in call to 'print'. Did you mean print(...)?");
          }
          break;
      }
    }
    const e = this.expressionList();
    if (this.isOp("=")) {
      const targets = [e];
      let value: SExpr = e;
      while (this.acceptOp("=")) {
        value = this.expressionList();
        targets.push(value);
      }
      targets.pop();
      return { kind: "assign", targets, value, span: this.since(first) };
    }
    const aug = this.tok.type === "op" ? AUGMENTED[this.tok.value] : undefined;
    if (aug !== undefined) {
      this.next();
      return { kind: "augassign", target: e, op: aug, value: this.expressionList(), span: this.since(first) };
    }
    return { kind: "expr", value: e, span: this.since(first) };
  }

  private endsSimple(): boolean {
    return this.tok.type === "newline" || this.tok.type === "eof" || this.isOp(";");
  }

  /**
   * `import m [as y]` and `from m import x [as y], ...` (PY-22), for the four modules in the subset. Anything else,
   * `pickle` included (PY-44), is a friendly "not supported" error at the start of the statement.
   */
  private importStatement(): SStmt {
    const first = this.tok.span;
    const kw = this.next();
    const items: { module: string; member: string | null; target: SExpr }[] = [];
    const moduleName = (): string => {
      const n = this.tok;
      if (n.type !== "name" || KEYWORDS.has(n.value)) this.fail(n.span);
      const m = this.next().value;
      if (!MODULES.includes(m) || this.isOp(".")) {
        this.unsupported(
          first,
          `The ${m} module`,
          "Only the math, random, datetime and time modules are available. Remove the import.",
        );
      }
      return m;
    };
    const bound = (fallback: string, at: Span): SExpr => {
      let name = fallback;
      let span = at;
      if (this.acceptWord("as")) {
        const n = this.tok;
        if (n.type !== "name" || KEYWORDS.has(n.value)) this.fail(n.span);
        name = this.next().value;
        span = n.span;
      }
      return { kind: "name", name, span };
    };
    if (kw.value === "import") {
      do {
        const at = this.tok.span;
        const module = moduleName();
        items.push({ module, member: null, target: bound(module, at) });
      } while (this.acceptOp(","));
    } else {
      const module = moduleName();
      if (!this.acceptWord("import")) this.fail(this.tok.span);
      if (this.isOp("*"))
        this.unsupported(this.tok.span, "import *", "Name what you need, like: from math import sqrt");
      do {
        const n = this.tok;
        if (n.type !== "name" || KEYWORDS.has(n.value)) this.fail(n.span);
        const member = this.next().value;
        items.push({ module, member, target: bound(member, n.span) });
      } while (this.acceptOp(","));
    }
    return { kind: "import", items, span: this.since(first) };
  }
}

export function parse(loc: Locator, report: Reporter): SStmt[] {
  const parser = new StatementParser(lex(loc, report), loc, report);
  return parser.program();
}

export type { Span };
