// Runtime errors (E-RUN-): found while the program runs; output printed before them stays on screen.
import type { Catalogue } from "./types.ts";

export const runtimeMessages: Catalogue = {
  "E-RUN-DIV-ZERO": {
    spec: ["SH-09"],
    default: {
      message: "{operator} by zero",
      hint: "The value on the right of {operator} is 0. Check it with an IF first.",
    },
  },
  "E-RUN-INDEX-RANGE": {
    spec: ["EDX-27", "CIE-22"],
    default: { message: "Index {index} is outside {array}", hint: "Check the loop limits." },
    languages: {
      edexcel: { hint: "{array} has {length} elements, so its indexes are 0 to {last}. Check the loop limits." },
      cie: { hint: "{array} is declared with indexes {low} to {high}. Check the loop limits." },
    },
  },
  "E-RUN-NUMBER-TOO-LARGE": {
    spec: ["SH-07"],
    default: {
      message: "This number is too large: the answer is beyond ±9,007,199,254,740,991",
      hint: "Use smaller numbers, or a REAL if you don't need it exact.",
    },
  },
  "E-RUN-NO-VALUE": {
    spec: ["CIE-14", "EDX-56"],
    default: { message: "{name} has no value yet", hint: "Give it a value first, e.g. with an assignment or INPUT." },
  },
  "E-RUN-ARRAY-GAP": {
    spec: ["EDX-27"],
    default: { message: "{array}[{index}] has no value yet", hint: "Give that element a value before reading it." },
  },
  "E-RUN-INPUT-TYPE": {
    spec: ["SH-06", "EDX-72", "CIE-80"],
    default: { message: "The input {input} is not {expected}", hint: "Run the program again and type {example}." },
  },
  "E-RUN-STEP-ZERO": {
    spec: ["EDX-54", "CIE-61"],
    default: { message: "STEP can't be 0", hint: "A STEP of 0 would never reach the end value." },
  },
  "E-RUN-NO-RETURN": {
    spec: ["EDX-61"],
    default: {
      message: "FUNCTION {name} ended without a RETURN",
      hint: "Every path through a FUNCTION must reach a RETURN.",
    },
  },
  "E-RUN-RECURSION-LIMIT": {
    spec: ["SH-13"],
    default: {
      message: "{name} called itself more than 1,000 times without stopping",
      hint: "Make sure it has a base case that returns without calling itself again.",
    },
  },
  "E-RUN-FILE-NOT-FOUND": {
    spec: ["SH-11", "CIE-97"],
    default: {
      message: "The file {file} doesn't exist",
      hint: "Check the name in the Files panel, or create the file first.",
    },
    languages: {
      cie: { hint: "Create it first: OPENFILE {file} FOR WRITE, then WRITEFILE lines into it and CLOSEFILE it." },
    },
  },
  "E-RUN-FILE-LEFT-OPEN": {
    spec: ["CIE-96"],
    default: {
      message: "The file {file} is still open at the end of the program",
      hint: "Add CLOSEFILE {file} when you have finished with it.",
    },
  },
  "E-RUN-READ-PAST-END": {
    spec: ["EDX-84", "CIE-93"],
    default: { message: "Tried to read past the end of {file}", hint: "Check there are lines left before reading." },
    languages: {
      edexcel: { hint: "Count the records first, and READ that many times." },
      cie: { hint: "Loop with WHILE NOT EOF({file}) before each READFILE." },
    },
  },
  "E-INTERNAL-NO-ENGINE": {
    spec: [],
    default: {
      message: "Sudocode can't run {language} programs yet",
      hint: "This language is still being built. Try again in a later version.",
    },
  },
};
