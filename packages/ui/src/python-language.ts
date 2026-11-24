// Syntax highlighting for the Python subset. Same idea as the pseudocode highlighters (a forgiving per-line scan,
// never the real lexer); `#` comments, single or double quotes, and Python's keywords and built-ins.
import { StreamLanguage, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const KEYWORDS: ReadonlySet<string> = new Set([
  "if",
  "elif",
  "else",
  "for",
  "while",
  "in",
  "not",
  "and",
  "or",
  "is",
  "def",
  "return",
  "break",
  "continue",
  "pass",
  "global",
  "del",
  "try",
  "except",
  "finally",
  "raise",
  "assert",
  "lambda",
  "as",
  "from",
  "import",
]);
const BUILT_INS: ReadonlySet<string> = new Set([
  "print",
  "input",
  "len",
  "range",
  "int",
  "float",
  "str",
  "bool",
  "list",
  "tuple",
  "dict",
  "set",
  "abs",
  "min",
  "max",
  "sum",
  "round",
  "sorted",
  "reversed",
  "enumerate",
  "zip",
  "map",
  "filter",
  "any",
  "all",
  "isinstance",
  "type",
  "chr",
  "ord",
  "divmod",
  "pow",
  "repr",
]);
const LITERALS: ReadonlySet<string> = new Set(["True", "False", "None"]);

/** Reads one token from the line and returns its style name, or null for plain text. */
export function tokenPython(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  if (stream.match("#")) {
    stream.skipToEnd();
    return "comment";
  }
  const quote = stream.peek();
  if (quote === '"' || quote === "'") {
    stream.next();
    while (!stream.eol()) {
      const c = stream.next();
      if (c === "\\") stream.next();
      else if (c === quote) break;
    }
    return "string";
  }
  if (stream.match(/^\d[\d_]*(\.\d*)?([eE][+-]?\d+)?/)) return "number";
  if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
    const word = stream.current();
    if (KEYWORDS.has(word)) return "keyword";
    if (BUILT_INS.has(word)) return "builtin";
    if (LITERALS.has(word)) return "bool";
    return null;
  }
  stream.next();
  return null;
}

export const pythonLanguage = StreamLanguage.define<null>({
  name: "python",
  startState: () => null,
  token: tokenPython,
  languageData: { commentTokens: { line: "#" } },
  tokenTable: { builtin: tags.standard(tags.variableName), bool: tags.bool },
});
