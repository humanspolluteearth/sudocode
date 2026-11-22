// The three languages Sudocode runs. Each has its own front end (lexer, parser, checker) and all of them
// lower into one shared core IR (docs/DECISIONS.md).
export const LANGUAGES = ["edexcel", "cie", "python"] as const;

export type Language = (typeof LANGUAGES)[number];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}
