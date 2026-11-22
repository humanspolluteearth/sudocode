// Syntax errors (E-SYN-): the program can't be read. Wording adapted from the prototype (docs/messages-harvest.md).
import type { Catalogue } from "./types.ts";

export const syntaxMessages: Catalogue = {
  "E-SYN-UNEXPECTED-CHAR": {
    spec: ["SH-15"],
    default: {
      message: "Sudocode doesn't understand the character {char}",
      hint: "Remove it, or put it inside quotes if it is text.",
    },
    languages: { cie: { hint: "Remove it. Comments in Cambridge pseudocode start with //." } },
  },
  "E-SYN-UNCLOSED-STRING": {
    spec: ["EDX-06", "CIE-04"],
    default: {
      message: "This text is missing its closing quote",
      hint: "End the text with the same quote it starts with.",
    },
    languages: {
      edexcel: { hint: "Edexcel text goes in single quotes, e.g. 'Hello'." },
      cie: { hint: 'A STRING starts and ends with a double quote, e.g. "Hello".' },
    },
  },
  "E-SYN-BAD-NUMBER": {
    spec: ["EDX-08", "CIE-04"],
    default: {
      message: "{text} is not a number Sudocode can read",
      hint: "A number has at most one decimal point, with digits after it.",
    },
  },
  "E-SYN-NOT-EQUAL": {
    spec: ["EDX-32", "CIE-44"],
    default: {
      message: '!= is not how pseudocode writes "not equal to"',
      hint: 'Use <> for "not equal to".',
      fix: "Change != to <>",
    },
  },
  "E-SYN-DOUBLE-EQUALS": {
    spec: ["EDX-32", "CIE-44"],
    default: {
      message: "== is not used in pseudocode",
      hint: "Use a single = to compare two values.",
      fix: "Change == to =",
    },
  },
  "E-SYN-EXPECTED": {
    spec: ["SH-15"],
    default: { message: "Expected {expected} but found {found}", hint: "{advice}" },
  },
  "E-SYN-LINE-ENDS-EARLY": {
    spec: ["SH-15"],
    default: {
      message: "This line ends before the expression is complete",
      hint: "Something is missing after the last operator.",
    },
  },
  "E-SYN-UNKNOWN-STATEMENT": {
    spec: ["SH-15"],
    default: {
      message: "Sudocode doesn't know a statement that starts with {word}",
      hint: "Check the spelling of the first word on the line.",
    },
    languages: {
      edexcel: {
        hint: "Statements start with a keyword such as SET, SEND, IF, WHILE or FOR, or call a subprogram like {word}().",
      },
      cie: {
        hint: "Statements start with a keyword such as DECLARE, OUTPUT, IF or FOR, or with a variable to assign.",
      },
    },
  },
  "E-SYN-OTHER-LANGUAGE": {
    spec: ["SH-15"],
    default: { message: "{word} is not part of this language", hint: "Check the language chosen for this file." },
    languages: {
      edexcel: { message: "{word} is not an Edexcel statement", hint: "Edexcel uses {official}." },
      cie: { message: "{word} is not Cambridge pseudocode", hint: "Cambridge pseudocode uses {official}." },
    },
  },
  "E-SYN-BLOCK-NOT-CLOSED": {
    spec: ["EDX-40", "CIE-50"],
    default: {
      message: "{block} on line {line} is never closed",
      hint: "Add {closer} after the last line of the block.",
      fix: "Add {closer}",
    },
  },
  "E-SYN-WRONG-CLOSER": {
    spec: ["EDX-41", "CIE-50"],
    default: {
      message: "{closer} found, but the open block is {block} from line {line}",
      hint: "Close blocks in reverse order: add {expected} before this line.",
    },
  },
  "E-SYN-UNMATCHED-CLOSER": {
    spec: ["EDX-41", "CIE-50"],
    default: {
      message: "{closer} has no matching {block}",
      hint: "Remove this line, or check that the block it closes was opened.",
    },
  },
  "E-SYN-KEYWORD-AS-NAME": {
    spec: ["CIE-03"],
    default: {
      message: "{word} is a keyword, so it can't be used as a name",
      hint: "Choose a different name, e.g. {suggestion}.",
    },
  },
  "E-SYN-NOT-SUPPORTED": {
    spec: ["SH-18", "PY-02"],
    default: { message: "{feature} is not supported in Sudocode yet", hint: "{advice}" },
  },
};
