// The compact (tablet and phone) layout, from reference/prototype/design/Tablet.dc.html and Mobile.dc.html.
// Below COMPACT_MAX_WIDTH the IDE shows one view at a time (Code, Console, Debug) instead of side-by-side panes,
// and gains a keyword key bar so students never need to type a keyword on a touch keyboard.
import { useEffect, useState } from "react";
import type { PseudocodeLanguage } from "./preferences.ts";

export const COMPACT_MAX_WIDTH = 900;
export type CompactView = "code" | "console" | "debug" | "guide";

/** True while the window is narrow enough for the compact layout (matchMedia, so it follows rotation too). */
export function useCompact(): boolean {
  const query = `(max-width: ${String(COMPACT_MAX_WIDTH)}px)`;
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches); // false when rendered on the server (tests)
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (): void => {
      setCompact(media.matches);
    };
    media.addEventListener("change", onChange);
    onChange();
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [query]);
  return compact;
}

/** The keys on the "Insert keyword" bar for each language, as in the design. "\t" is the indent key. */
export const KEYSETS: Record<PseudocodeLanguage, readonly string[]> = {
  edexcel: [
    "\t",
    "SET",
    "TO",
    "SEND",
    "DISPLAY",
    "RECEIVE",
    "IF",
    "THEN",
    "ELSE",
    "END",
    "WHILE",
    "DO",
    "FOR",
    "FROM",
    "REPEAT",
    "UNTIL",
    '"',
    "&",
    "=",
    "<>",
    "<",
    ">",
    "(",
    ")",
    "[",
    "]",
    "#",
  ],
  cie: [
    "\t",
    "DECLARE",
    ":",
    "INTEGER",
    "STRING",
    "←",
    "INPUT",
    "OUTPUT",
    "IF",
    "THEN",
    "ELSE",
    "ENDIF",
    "FOR",
    "TO",
    "NEXT",
    "WHILE",
    "ENDWHILE",
    "REPEAT",
    "UNTIL",
    '"',
    "&",
    "=",
    "<>",
    "<",
    ">",
    "(",
    ")",
    "[",
    "]",
    "//",
  ],
  python: [
    "\t",
    "print(",
    "input(",
    "int(",
    "if",
    "elif",
    "else",
    "for",
    "in",
    "range(",
    "while",
    "def",
    "return",
    ":",
    "=",
    "==",
    "!=",
    "<",
    ">",
    '"',
    "(",
    ")",
    "[",
    "]",
    "+",
    "#",
  ],
};
