// Saving and opening files through the browser: a download for Save, a file picker for Open. Kept apart from the
// components so the name and type rules can be tested without a browser.
import { EXTENSIONS } from "./workspace.ts";
import type { PseudocodeLanguage } from "./preferences.ts";

/** The types the Save dialog offers. `.txt` is plain text and keeps the language the file already has. */
export type SaveType = "epc" | "cpc" | "py" | "txt";
export const SAVE_TYPES: readonly { type: SaveType; label: string }[] = [
  { type: "epc", label: "Edexcel pseudocode (.epc)" },
  { type: "cpc", label: "Cambridge 9618 pseudocode (.cpc)" },
  { type: "py", label: "Python (.py)" },
  { type: "txt", label: "Plain text (.txt)" },
];

const LANGUAGE_OF = { epc: "edexcel", cpc: "cie", py: "python" } as const;

export function typeOf(language: PseudocodeLanguage): SaveType {
  return EXTENSIONS[language];
}

/** A safe file name stem: no folders or dots-and-slashes, no leading/trailing spaces; empty becomes "untitled". */
export function cleanName(raw: string): string {
  const stem = raw
    .trim()
    .replace(/\.(epc|cpc|py|txt)$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim();
  return stem === "" ? "untitled" : stem;
}

/** Splits a picked file name into the tab's name and language; unknown types open as the current language. */
export function parseFileName(
  file: string,
  fallback: PseudocodeLanguage,
): { name: string; language: PseudocodeLanguage } {
  const ext = /\.(epc|cpc|py)$/i.exec(file)?.[1]?.toLowerCase();
  const language = ext === "epc" || ext === "cpc" || ext === "py" ? LANGUAGE_OF[ext] : fallback;
  return { name: cleanName(file), language };
}

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/** Opens the browser's file picker and reads the chosen files as text. Resolves with [] if the picker is dismissed. */
export function pickTextFiles(): Promise<{ name: string; text: string }[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".epc,.cpc,.py,.txt";
    input.addEventListener("change", () => {
      const chosen = [...(input.files ?? [])];
      void Promise.all(chosen.map(async (f) => ({ name: f.name, text: await f.text() }))).then(resolve);
    });
    input.addEventListener("cancel", () => {
      resolve([]);
    });
    input.click();
  });
}
