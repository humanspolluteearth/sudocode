// Checker errors (E-CHK-): found before the program runs, so it doesn't run at all.
import type { Catalogue } from "./types.ts";

export const checkerMessages: Catalogue = {
  "E-CHK-BARE-ASSIGN": {
    spec: ["EDX-33"],
    default: {
      message: "Assignments need SET",
      hint: "Write SET {name} TO {value}.",
      fix: "Write SET {name} TO {value}",
    },
  },
  "E-CHK-TYPE-CHANGE": {
    spec: ["EDX-12", "CIE-13"],
    default: {
      message: "{name} holds {expected} values, so it can't be given a {actual}",
      hint: "Use a new variable, or convert the value first.",
    },
  },
  "E-CHK-CONCAT-ARRAY": {
    spec: ["EDX-26"],
    default: {
      message: "& joins text, not arrays",
      hint: "Join single elements instead, e.g. Names[0] & ' ' & Names[1].",
    },
  },
  "E-CHK-CONCAT-NUMBER": {
    spec: ["CIE-45"],
    default: {
      message: "& joins STRING and CHAR values, but {value} is {type}",
      hint: 'Convert it with NUM_TO_STR(...), or output it separately: OUTPUT "Total: ", Total.',
    },
  },
  "E-CHK-DIV-MOD-INTEGER": {
    spec: ["EDX-31", "CIE-42"],
    default: {
      message: "{operator} needs two INTEGER values, but one side is {type}",
      hint: "Use / to divide REAL values.",
    },
  },
  "E-CHK-MISSING-PARENS": {
    spec: ["EDX-66"],
    default: { message: "{name} needs () even when it has no parameters", hint: "Write {name}().", fix: "Add ()" },
  },
  "E-CHK-SEND-COMMA": {
    spec: ["EDX-71"],
    default: {
      message: "SEND sends one value at a time",
      hint: "Join values with &, e.g. SEND 'Total: ' & Total TO DISPLAY.",
    },
  },
  "E-CHK-SEND-ARRAY": {
    spec: ["EDX-75"],
    default: {
      message: "SEND can't send a whole array",
      hint: "Send each element in a loop: FOR EACH Item FROM {name} DO ... END FOREACH.",
    },
    // EDX-75 also covers WRITE <File> (QUESTIONS.md 19).
    variants: {
      write: {
        message: "WRITE can't write a whole array to a file",
        hint: "Write each element in a loop: FOR EACH Item FROM {name} DO ... END FOREACH.",
      },
    },
  },
  "E-CHK-RECEIVE-NO-TYPE": {
    spec: ["EDX-73"],
    default: {
      message: "RECEIVE needs the type of the value in brackets",
      hint: "Write RECEIVE {name} FROM (INTEGER) KEYBOARD, or (STRING), (REAL), (BOOLEAN), (CHARACTER).",
    },
  },
  "E-CHK-UNDECLARED": {
    spec: ["CIE-11"],
    default: { message: "{name} has not been declared", hint: "Declare it first: DECLARE {name} : <type>." },
    variants: { "did-you-mean": { hint: "Did you mean {suggestion}? Otherwise declare it: DECLARE {name} : <type>." } },
  },
  "E-CHK-UNKNOWN-FUNCTION": {
    spec: ["Q-EDX-4", "CIE-120"],
    default: {
      message: "There is no function called {name}",
      hint: "Check the spelling, or define it with FUNCTION {name}(...).",
    },
    languages: {
      edexcel: {
        hint: "Edexcel's only built-in functions are LENGTH and RANDOM; define your own with FUNCTION {name}(...).",
      },
    },
    variants: { "did-you-mean": { hint: "Did you mean {suggestion}?" } },
  },
  "E-CHK-ARG-TYPE": {
    spec: ["CIE-121", "CIE-74"],
    default: {
      message: "{function} needs a {expected} here, but {argument} is a {actual}",
      hint: "Give {function} a {expected}.",
    },
    variants: { "use-to-upper": { hint: "For a whole STRING use {alternative}({argument})." } },
  },
  "E-CHK-ARG-COUNT": {
    spec: ["EDX-64", "CIE-74"],
    default: {
      message: "{name} needs {expected} but was given {actual}",
      hint: "It is defined on line {line} as {signature}.",
    },
  },
  "E-CHK-CALL-REQUIRED": {
    spec: ["CIE-71"],
    default: {
      message: "To run a procedure, start the line with CALL",
      hint: "Write CALL {name}(...).",
      fix: "Add CALL",
    },
  },
  "E-CHK-CONDITION-TYPE": {
    spec: ["EDX-43", "CIE-64"],
    default: {
      message: "The condition must be TRUE or FALSE, but this is {type}",
      hint: "Compare it, e.g. IF {name} > 0 THEN.",
    },
  },
};
