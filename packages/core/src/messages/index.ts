// The message catalogue: diagnostic code -> wording (SH-15). Stages report a code, a span and arguments;
// `makeDiagnostic` turns them into what the student reads.
import { isDiagnosticCode, severityOf, type Diagnostic, type Fix, type Span } from "../diagnostics.ts";
import type { Language } from "../language.ts";
import { checkerMessages } from "./checker.ts";
import { noteMessages } from "./notes.ts";
import { pythonMessages } from "./python.ts";
import { runtimeMessages } from "./runtime.ts";
import { syntaxMessages } from "./syntax.ts";
import type { Catalogue, CatalogueEntry, MessageTemplate } from "./types.ts";

export type { Catalogue, CatalogueEntry, MessageTemplate } from "./types.ts";

export const MESSAGES: Readonly<Catalogue> = Object.freeze({
  ...syntaxMessages,
  ...checkerMessages,
  ...runtimeMessages,
  ...noteMessages,
  ...pythonMessages,
});

export type MessageArgs = Readonly<Record<string, string | number>>;

export interface FormattedMessage {
  message: string;
  hint: string;
  fix?: string;
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** Names of the `{placeholders}` in a template string. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1] ?? "");
}

function fill(template: string, args: MessageArgs, code: string): string {
  return template.replace(PLACEHOLDER, (_all, name: string) => {
    const value = args[name];
    if (value === undefined) throw new Error(`${code}: missing message argument {${name}}`);
    return String(value);
  });
}

// CPython exceptions not in the catalogue still get CPython's own wording (PY-03).
function pythonFallback(code: string): CatalogueEntry | undefined {
  const name = /^E-PY-([A-Z][A-Za-z]*)$/.exec(code)?.[1];
  if (name === undefined) return undefined;
  return {
    spec: ["PY-03"],
    default: { message: `${name}: {detail}`, hint: "This is Python's own message for the error." },
  };
}

export function catalogueEntry(code: string): CatalogueEntry {
  const entry = MESSAGES[code] ?? pythonFallback(code);
  if (entry === undefined) throw new Error(`No message for diagnostic code ${code}`);
  return entry;
}

/** The wording for `code`: a named variant wins over the language's wording, which wins over the default. */
export function formatMessage(
  code: string,
  language: Language,
  args: MessageArgs = {},
  variant?: string,
): FormattedMessage {
  const entry = catalogueEntry(code);
  const chosen: MessageTemplate = { ...entry.default, ...entry.languages?.[language] };
  if (variant !== undefined) {
    const override = entry.variants?.[variant];
    if (override === undefined) throw new Error(`${code}: no message variant "${variant}"`);
    Object.assign(chosen, override);
  }
  const result: FormattedMessage = { message: fill(chosen.message, args, code), hint: fill(chosen.hint, args, code) };
  if (chosen.fix !== undefined) result.fix = fill(chosen.fix, args, code);
  return result;
}

export interface DiagnosticRequest {
  code: string;
  language: Language;
  span: Span;
  args?: MessageArgs;
  variant?: string;
  /** Edits for the one-click fix; the label comes from the catalogue. */
  edits?: Fix["edits"];
}

/** Builds the diagnostic a stage reports: position from the span, words from the catalogue. */
export function makeDiagnostic(req: DiagnosticRequest): Diagnostic {
  if (!isDiagnosticCode(req.code)) throw new Error(`Not a diagnostic code: ${req.code}`);
  const words = formatMessage(req.code, req.language, req.args, req.variant);
  const diagnostic: Diagnostic = {
    code: req.code,
    line: req.span.line,
    column: req.span.column,
    message: words.message,
    hint: words.hint,
    severity: severityOf(req.code),
    span: req.span,
  };
  if (words.fix !== undefined && req.edits !== undefined) diagnostic.fix = { label: words.fix, edits: req.edits };
  return diagnostic;
}
