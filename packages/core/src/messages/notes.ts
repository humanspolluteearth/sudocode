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
  "W-EDX-GRID-BRACKETS": {
    spec: ["EDX-24"],
    default: {
      message: "A grid element is written {official} in Edexcel",
      hint: "Write {official}.",
      fix: "Write {official}",
    },
  },
  "W-EDX-FOREACH": {
    spec: ["EDX-58"],
    default: { message: "{word} is written {official} in Edexcel", hint: "Write {official}.", fix: "Write {official}" },
  },
  "W-EDX-FOR-VAR-SET": {
    spec: ["EDX-55"],
    default: {
      message: "This changes {name}, the FOR loop's own variable",
      hint: "The loop sets {name} itself on each pass, so use another variable for your own values.",
    },
  },
  "W-CIE-NAME-CASE": {
    spec: ["CIE-03"],
    default: {
      message: "{word} is the same name as {name}, written differently",
      hint: "Write it the same way everywhere: {name}.",
      fix: "Write {name}",
    },
  },
  "W-CIE-ELSE-IF": {
    spec: ["CIE-51"],
    default: {
      message: "ELSE IF continues the same IF, so one ENDIF closes the whole chain",
      hint: "Write only one ENDIF at the end, after the last ELSE.",
    },
  },
  "I-PY-CLASS-DECLARATIONS": {
    spec: ["PY-54"],
    default: {
      message: "Class {name} has no commented attribute declarations",
      hint: "Cambridge Paper 4 asks for them as comments at the top of the class, e.g. # {example}.",
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
  "W-CIE-BYREF-FUNCTION": {
    spec: ["CIE-75"],
    default: {
      message: "A function should not take BYREF parameters",
      hint: "Use BYVAL, or make it a PROCEDURE.",
    },
  },
  "W-CIE-DIV-FUNCTION": {
    spec: ["CIE-42"],
    default: {
      message: "DIV and MOD are written between the numbers",
      hint: "Write {official} instead.",
      fix: "Use the operator",
    },
  },
  "W-CIE-REAL-FORM": {
    spec: ["CIE-05"],
    default: {
      message: "A REAL needs a digit on both sides of the point",
      hint: "Write {official} instead.",
      fix: "Add the missing digit",
    },
  },
  "W-CIE-SINGLE-QUOTES": {
    spec: ["CIE-07"],
    default: {
      message: "Text with more than one character uses double quotes",
      hint: "Write {official} instead.",
      fix: "Use double quotes",
    },
  },
  "W-CIE-ENDIF": {
    spec: ["CIE-51"],
    default: {
      message: "ENDIF is one word",
      hint: "Write ENDIF instead of END IF.",
      fix: "Write ENDIF",
    },
  },
  "W-CIE-WHILE-DO": {
    spec: ["CIE-63"],
    default: {
      message: "WHILE does not need DO",
      hint: "Remove DO.",
      fix: "Remove DO",
    },
  },
  "W-CIE-BYVALUE": {
    spec: ["CIE-73"],
    default: {
      message: "The keyword is BYVAL",
      hint: "Write BYVAL instead of BYVALUE.",
      fix: "Write BYVAL",
    },
  },
  "W-CIE-FIELD-DECLARE": {
    spec: ["CIE-30"],
    default: {
      message: "A field in a TYPE starts with DECLARE",
      hint: "Write DECLARE before the field name.",
      fix: "Add DECLARE",
    },
  },
};
