// Cambridge file statements: OPENFILE, READFILE, WRITEFILE, CLOSEFILE, and the random-file SEEK, GETRECORD and
// PUTRECORD (CIE-90 to CIE-97). Each one lowers to its own shared IR node; the modes are checked when the program runs.
import type { FileMode, Expr as IrExpr, Stmt as Ir } from "../ir/ir.ts";
import type { Token } from "../edexcel/tokens.ts";
import type { Typed } from "./expressions.ts";
import type { Statements } from "./statements.ts";
import { isUnknown, typeName } from "./types.ts";

const MODES: Readonly<Record<string, FileMode>> = { READ: "read", WRITE: "write", APPEND: "append", RANDOM: "random" };

/** The file argument: a STRING literal or variable (CIE-90). */
function fileArg(s: Statements, word: string): IrExpr {
  const e = s.x.expr();
  if (!isUnknown(e.ty) && e.ty.kind !== "STRING")
    s.c.report("E-CHK-ARG-TYPE", e.span, {
      function: word,
      expected: "STRING",
      argument: s.c.text(e.span),
      actual: typeName(e.ty),
      alternative: "",
    });
  return e.ir;
}

export function fileStatement(s: Statements, first: Token, upper: string): Ir[] {
  const c = s.c;
  c.next();
  c.warnCase(first, upper);
  const file = fileArg(s, upper);
  const span = () => c.spanFrom(first);
  const comma = (hint: string): void => {
    c.expectSymbol(",", ",", hint);
  };
  switch (upper) {
    case "OPENFILE": {
      c.expectKeyword("FOR", 'Write FOR and the mode: OPENFILE "a.txt" FOR READ.');
      const m = c.peek();
      const mode = m.kind === "word" ? MODES[m.text.toUpperCase()] : undefined;
      if (mode === undefined) return c.fail("READ, WRITE, APPEND or RANDOM", "Choose how to open the file.");
      c.next();
      c.endStatement();
      return [{ kind: "fileOpen", file, mode, span: span() }];
    }
    case "CLOSEFILE":
      c.endStatement();
      return [{ kind: "fileClose", file, span: span() }];
    case "SEEK": {
      comma('Write a comma, then the record address: SEEK "a.dat", 1.');
      const at = s.x.expr();
      if (!isUnknown(at.ty) && at.ty.kind !== "INTEGER")
        c.report("E-CHK-NEEDS-INTEGER", at.span, { type: typeName(at.ty) });
      c.endStatement();
      return [{ kind: "fileSeek", file, address: at.ir, span: span() }];
    }
    case "WRITEFILE":
    case "PUTRECORD": {
      comma(`Write a comma, then the value: ${upper} "a.txt", Data.`);
      const value: Typed = s.x.expr();
      c.endStatement();
      if (upper === "PUTRECORD") return [{ kind: "filePut", file, value: value.ir, span: span() }];
      return [{ kind: "fileWrite", file, strict: true, value: value.ir, span: span() }];
    }
    case "READFILE":
    case "GETRECORD": {
      comma(`Write a comma, then the variable that receives the data: ${upper} "a.txt", Data.`);
      const name = c.peek();
      if (name.kind !== "word") return c.fail("a variable", "Write the variable that receives the data.");
      c.next();
      const v = s.x.lookupVar(name);
      if (v === undefined) {
        s.x.undeclared(name);
        return c.failSilently();
      }
      if (v.constant) {
        c.report("E-CHK-CONSTANT-ASSIGN", name.span, { name: name.text });
        return c.failSilently();
      }
      c.endStatement();
      const target = s.ref(name);
      if (upper === "GETRECORD") return [{ kind: "fileGet", file, target, span: span() }];
      if (!isUnknown(v.ty) && v.ty.kind !== "STRING")
        c.report("E-CHK-ARG-TYPE", name.span, {
          function: "READFILE",
          expected: "STRING",
          argument: name.text,
          actual: typeName(v.ty),
          alternative: "",
        });
      return [{ kind: "fileRead", file, strict: true, target, convert: "str", span: span() }];
    }
    default:
      return c.failSilently();
  }
}
