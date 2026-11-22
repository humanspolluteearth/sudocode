import type { Language } from "../language.ts";

/**
 * Wording for one diagnostic. `{name}` placeholders are filled from the arguments the checker or runtime
 * passes. Style (checked by tests): `message` is one plain sentence without a final full stop; `hint` says how to
 * put it right and ends with one; `fix` is the label of a one-click fix, if the code offers one.
 */
export interface MessageTemplate {
  message: string;
  hint: string;
  fix?: string;
}

export interface CatalogueEntry {
  /** Spec rows the code reports on. */
  spec: string[];
  /** Wording used unless a language or variant overrides it. */
  default: MessageTemplate;
  /** Per-language wording (e.g. "Edexcel uses SEND ..." vs "Cambridge uses OUTPUT ..."). */
  languages?: Partial<Record<Language, Partial<MessageTemplate>>>;
  /** Named special cases chosen by the caller, e.g. UCASE given a STRING (Q11). Win over language wording. */
  variants?: Record<string, Partial<MessageTemplate>>;
}

export type Catalogue = Record<string, CatalogueEntry>;
