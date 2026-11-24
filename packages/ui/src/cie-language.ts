// Syntax highlighting for Cambridge 9618 pseudocode. Same idea as edexcel-language.ts (a forgiving per-line scan,
// never the real lexer); the keywords and `//` comments differ, and the colours are shared.
import { StreamLanguage, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Keywords from docs/language-spec/cie-9618.md. Lower-case ones are still coloured (they only get a warning). */
const KEYWORDS: ReadonlySet<string> = new Set([
  "DECLARE",
  "CONSTANT",
  "TYPE",
  "ENDTYPE",
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "CASE",
  "OF",
  "OTHERWISE",
  "ENDCASE",
  "FOR",
  "TO",
  "STEP",
  "NEXT",
  "WHILE",
  "DO",
  "ENDWHILE",
  "REPEAT",
  "UNTIL",
  "PROCEDURE",
  "ENDPROCEDURE",
  "FUNCTION",
  "ENDFUNCTION",
  "RETURNS",
  "RETURN",
  "CALL",
  "BYREF",
  "BYVAL",
  "INPUT",
  "OUTPUT",
  "OPENFILE",
  "READFILE",
  "WRITEFILE",
  "CLOSEFILE",
  "SEEK",
  "GETRECORD",
  "PUTRECORD",
  "READ",
  "WRITE",
  "APPEND",
  "RANDOM",
  "TRY",
  "EXCEPT",
  "ENDTRY",
  "CLASS",
  "ENDCLASS",
  "INHERITS",
  "PUBLIC",
  "PRIVATE",
  "NEW",
  "SUPER",
  "AND",
  "OR",
  "NOT",
  "MOD",
  "DIV",
]);
const TYPES: ReadonlySet<string> = new Set(["INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE", "ARRAY"]);
const BUILT_INS: ReadonlySet<string> = new Set([
  "LENGTH",
  "LEFT",
  "RIGHT",
  "MID",
  "UCASE",
  "LCASE",
  "TO_UPPER",
  "TO_LOWER",
  "NUM_TO_STR",
  "STR_TO_NUM",
  "IS_NUM",
  "ASC",
  "CHR",
  "INT",
  "RAND",
  "EOF",
  "DAY",
  "MONTH",
  "YEAR",
  "DAYINDEX",
  "SETDATE",
  "TODAY",
]);
const LITERALS: ReadonlySet<string> = new Set(["TRUE", "FALSE"]);

/** Reads one token from the line and returns its style name, or null for plain text. */
export function tokenCie(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }
  const quote = stream.peek();
  if (quote === '"' || quote === "'") {
    stream.next();
    while (!stream.eol()) if (stream.next() === quote) break;
    return "string";
  }
  if (stream.match(/^\d+(\.\d+)?/)) return "number";
  if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
    const word = stream.current().toUpperCase();
    if (KEYWORDS.has(word)) return "keyword";
    if (TYPES.has(word)) return "typeName";
    if (BUILT_INS.has(word)) return "builtin";
    if (LITERALS.has(word)) return "bool";
    return null;
  }
  stream.next();
  return null;
}

export const cieLanguage = StreamLanguage.define<null>({
  name: "cie",
  startState: () => null,
  token: tokenCie,
  languageData: { commentTokens: { line: "//" } },
  tokenTable: { builtin: tags.standard(tags.variableName), bool: tags.bool, typeName: tags.typeName },
});
