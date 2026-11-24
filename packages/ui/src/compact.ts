// The compact layouts, from reference/prototype/design/Tablet.dc.html and Mobile.dc.html. The layout is chosen by
// window width: below PHONE_MAX_WIDTH a phone (one view at a time, bottom view switcher), from there up to
// TABLET_MAX_WIDTH a tablet (editor and console beside a 380px Debugger/Reference panel, no bottom navigation), and
// above that the desktop. Touch devices get the keyword key bar at any width, so students never need to type a
// keyword on a touch keyboard.
import { useEffect, useState } from "react";
import type { PseudocodeLanguage } from "./preferences.ts";

export const PHONE_MAX_WIDTH = 699;
export const TABLET_MAX_WIDTH = 1100;
export type CompactView = "code" | "console" | "debug" | "guide";

export interface Layout {
  /** Phone or tablet: the compact chrome (52px/44px controls, "..." menu, problem chip). */
  compact: boolean;
  /** Under 700px: one view at a time. */
  phone: boolean;
  /** 700px to 1100px. */
  tablet: boolean;
  /** The key bar shows: any compact layout, or a touch screen (`pointer: coarse`) at a larger width. */
  keyBar: boolean;
}

const PHONE = `(max-width: ${String(PHONE_MAX_WIDTH)}px)`;
const COMPACT = `(max-width: ${String(TABLET_MAX_WIDTH)}px)`;
const COARSE = "(pointer: coarse)";

function read(): Layout {
  if (typeof window === "undefined") return { compact: false, phone: false, tablet: false, keyBar: false };
  const phone = window.matchMedia(PHONE).matches;
  const compact = window.matchMedia(COMPACT).matches;
  return { compact, phone, tablet: compact && !phone, keyBar: compact || window.matchMedia(COARSE).matches };
}

/** The current layout (matchMedia, so it follows rotation and window resizing too). */
export function useLayout(): Layout {
  const [layout, setLayout] = useState(read); // all false when rendered on the server (tests)
  useEffect(() => {
    const queries = [PHONE, COMPACT, COARSE].map((q) => window.matchMedia(q));
    const onChange = (): void => {
      const next = read();
      setLayout((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    for (const m of queries) m.addEventListener("change", onChange);
    onChange();
    return () => {
      for (const m of queries) m.removeEventListener("change", onChange);
    };
  }, []);
  return layout;
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
