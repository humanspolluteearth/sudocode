// The CIE cursor: the shared token cursor, reporting in CIE wording (language overrides pick the message).
import type { Span, TextEdit } from "../diagnostics.ts";
import { Cursor } from "../edexcel/cursor.ts";
import { makeDiagnostic, type MessageArgs } from "../messages/index.ts";

export { Abandon, joinSpans } from "../edexcel/cursor.ts";

/** Upper-case words that are never names in CIE pseudocode (CIE-03). */
export const CIE_RESERVED = new Set([
  ...["DECLARE", "CONSTANT", "INPUT", "OUTPUT", "IF", "THEN", "ELSE", "ENDIF", "END", "CASE", "OF", "OTHERWISE"],
  ...["ENDCASE", "FOR", "TO", "STEP", "NEXT", "WHILE", "DO", "ENDWHILE", "REPEAT", "UNTIL", "PROCEDURE", "FUNCTION"],
  ...["ENDPROCEDURE", "ENDFUNCTION", "RETURN", "RETURNS", "CALL", "BYVAL", "BYVALUE", "BYREF", "AND", "OR", "NOT"],
  ...["DIV", "MOD", "TRUE", "FALSE", "INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE", "ARRAY", "TYPE"],
  ...["ENDTYPE", "CLASS", "ENDCLASS", "OPENFILE", "CLOSEFILE", "READFILE", "WRITEFILE", "TRY", "EXCEPT"],
  ...["ENDTRY", "FINALLY", "PUBLIC", "PRIVATE", "NEW", "INHERITS", "SUPER", "SEEK", "GETRECORD", "PUTRECORD"],
]);

export class CieCursor extends Cursor {
  override report(code: string, span: Span, args: MessageArgs = {}, variant?: string, edits?: TextEdit[]): void {
    this.diagnostics.push(
      makeDiagnostic({
        code,
        language: "cie",
        span,
        args,
        ...(variant === undefined ? {} : { variant }),
        ...(edits === undefined ? {} : { edits }),
      }),
    );
  }
}
