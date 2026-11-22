// Warnings (W-) and info notes (I-): the program still runs. Lenient forms never change meaning (SH-16).
import type { Catalogue } from "./types.ts";

export const noteMessages: Catalogue = {
  "W-EDX-DOUBLE-QUOTES": {
    spec: ["EDX-07"],
    default: { message: "Edexcel text uses single quotes", hint: "Write {official}.", fix: "Use single quotes" },
  },
  "W-LOWERCASE-KEYWORD": {
    spec: ["EDX-05", "CIE-02"],
    default: {
      message: "Keywords are written in capitals",
      hint: "Write {official} instead of {word}.",
      fix: "Write {official}",
    },
  },
  "W-EDX-ELSE-IF": {
    spec: ["EDX-42"],
    default: {
      message: "ELSE IF is not in the Edexcel command set",
      hint: "The official form puts ELSE on its own line, then a nested IF ... END IF inside it.",
    },
  },
  "W-EDX-ENDIF": {
    spec: ["EDX-44"],
    default: { message: "ENDIF is written as two words in Edexcel", hint: "Write END IF.", fix: "Write END IF" },
  },
  "W-EDX-FOREACH": {
    spec: ["EDX-58"],
    default: { message: "{word} is written {official} in Edexcel", hint: "Write {official}.", fix: "Write {official}" },
  },
  "W-CIE-NAME-CASE": {
    spec: ["CIE-03"],
    default: {
      message: "{word} is the same name as {name}, written differently",
      hint: "Write it the same way everywhere: {name}.",
      fix: "Write {name}",
    },
  },
  "I-EDX-ARRAY-GROWS": {
    spec: ["EDX-27", "Q-EDX-1"],
    default: {
      message: "{array} grew to {length} elements to make room for index {index}",
      hint: "Any gap has no value until you set it.",
    },
  },
  "I-EDX-GLOBAL-UPDATE": {
    spec: ["EDX-63", "Q-EDX-3"],
    default: {
      message: "This changes the global variable {name}",
      hint: "Inside a subprogram, assigning to a global updates it everywhere.",
    },
  },
};
