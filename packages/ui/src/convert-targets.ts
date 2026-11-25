// The three languages a file can be converted to, with their menu names (Python is a target only, CNV-02).
import type { PseudocodeLanguage } from "./preferences.ts";

export const CONVERT_TARGETS: readonly { id: PseudocodeLanguage; label: string }[] = [
  { id: "edexcel", label: "Edexcel pseudocode" },
  { id: "cie", label: "Cambridge 9618 pseudocode" },
  { id: "python", label: "Python" },
];
