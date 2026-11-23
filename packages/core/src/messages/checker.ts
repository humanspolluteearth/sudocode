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
    spec: ["EDX-12", "EDX-17", "EDX-25", "CIE-13"],
    default: {
      message: "{name} holds {expected} values, so it can't be given a {actual}",
      hint: "Use a new variable, or convert the value first.",
    },
    // Edexcel passes {actual} with its article ("an INTEGER") and has no conversion functions (Q-EDX-4).
    languages: {
      edexcel: {
        message: "{name} holds {expected} values, so it can't be given {actual}",
        hint: "Use a new variable for the new value.",
      },
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
  "E-CHK-READ-ONE-VARIABLE": {
    spec: ["EDX-82"],
    default: {
      message: "READ reads one variable at a time",
      hint: "Read one line per READ: READ {file} {first}, then READ {file} {second}.",
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
  "E-CHK-RETURN-OUTSIDE": {
    spec: ["EDX-61"],
    default: {
      message: "RETURN only works inside a PROCEDURE or FUNCTION",
      hint: "Put it between BEGIN FUNCTION and END FUNCTION.",
    },
  },
  "E-CHK-PROCEDURE-RETURN": {
    spec: ["EDX-60", "EDX-61"],
    default: {
      message: "{name} is a PROCEDURE, so it can't RETURN a value",
      hint: "Change it to a FUNCTION if it should give a value back.",
    },
  },
  "E-CHK-PROCEDURE-VALUE": {
    spec: ["EDX-60", "EDX-61"],
    default: {
      message: "{name} is a PROCEDURE, so it doesn't give back a value",
      hint: "Call it on its own line, or make it a FUNCTION that RETURNs a value.",
    },
  },
  "E-CHK-DUPLICATE-SUBPROGRAM": {
    spec: ["EDX-60", "EDX-61"],
    default: {
      message: "There are two subprograms called {name}",
      hint: "The first is on line {line}. Give one of them a different name.",
    },
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
    variants: {
      "did-you-mean": { hint: "Did you mean {suggestion}?" },
      procedure: {
        message: "There is no procedure called {name}",
        hint: "Check the spelling, or define it with PROCEDURE {name}(...).",
      },
    },
  },
  "E-CHK-ARG-TYPE": {
    spec: ["CIE-121", "CIE-74", "EDX-90"],
    default: {
      message: "{function} needs a {expected} here, but {argument} is a {actual}",
      hint: "Give {function} a {expected}.",
    },
    // Edexcel passes {expected} and {actual} with their articles ("an array or a STRING", "an INTEGER").
    languages: {
      edexcel: {
        message: "{function} needs {expected} here, but {argument} is {actual}",
        hint: "Give {function} {expected}.",
      },
    },
    variants: { "use-to-upper": { hint: "For a whole STRING use {alternative}({argument})." } },
  },
  "E-CHK-ARG-COUNT": {
    spec: ["EDX-64", "CIE-74"],
    default: {
      message: "{name} needs {expected} but was given {actual}",
      hint: "It is defined on line {line} as {signature}.",
    },
    variants: { builtin: { hint: "Write {signature}." } },
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
    variants: {
      while: { hint: "Compare it, e.g. WHILE {name} > 0 DO." },
      until: { hint: "Compare it, e.g. UNTIL {name} > 0." },
    },
  },
  // Edexcel has no declarations: a name that is never given a value anywhere is caught before the run (EDX-12).
  "E-CHK-UNKNOWN-NAME": {
    spec: ["EDX-03", "EDX-12"],
    default: { message: "{name} is never given a value", hint: "Give it a value first, e.g. SET {name} TO 0." },
    variants: {
      "other-case": { hint: "Capital letters matter in names: did you mean {suggestion}?" },
      "did-you-mean": { hint: "Did you mean {suggestion}?" },
    },
  },
  "E-CHK-CONST-SET-TWICE": {
    spec: ["EDX-17"],
    default: {
      message: "{name} is a constant, so it can only be set once",
      hint: "It is already set on line {line}. Leave out CONST if its value needs to change.",
    },
  },
  "E-CHK-CONST-NEVER-SET": {
    spec: ["EDX-17"],
    default: {
      message: "{name} is a constant but is never given its value",
      hint: "Add SET {name} TO ... after the CONST line.",
    },
  },
  "E-CHK-ARRAY-MIXED": {
    spec: ["EDX-25"],
    default: {
      message: "This element is {actual}, but the first element is {expected}",
      hint: "All the elements of an array must have the same type.",
    },
  },
  "E-CHK-OPERAND-TYPE": {
    spec: ["EDX-13", "EDX-43"],
    default: {
      message: "{operator} can't be used with {type} values",
      hint: "Check the values on both sides of {operator}.",
    },
    variants: {
      arithmetic: { hint: "{operator} works on numbers. To join text, use &." },
      logic: { hint: "{operator} works on TRUE and FALSE values, e.g. a comparison such as x > 0." },
      order: { hint: "{operator} compares two numbers or two pieces of text." },
      concat: { hint: "& joins text, so at least one side must be a STRING or a CHARACTER." },
    },
  },
  "E-CHK-COMPARE-TYPES": {
    spec: ["EDX-32"],
    default: {
      message: "Can't compare {left} with {right}",
      hint: "Compare two numbers, two pieces of text or two BOOLEAN values.",
    },
  },
  "E-CHK-FOREACH-TYPE": {
    spec: ["EDX-57"],
    default: {
      message: "FOR EACH needs an array or a STRING, but this is {type}",
      hint: "To count, use FOR {name} FROM 1 TO ... DO instead.",
    },
  },
  "E-CHK-NEEDS-INTEGER": {
    spec: ["EDX-22", "EDX-52"],
    default: { message: "This must be an INTEGER, but it is {type}", hint: "Use a whole number." },
    variants: {
      index: { hint: "An index is a whole number, e.g. {name}[0]." },
      count: { hint: "Give a whole number of times, e.g. REPEAT 3 TIMES." },
    },
  },
  "E-CHK-NOT-INDEXABLE": {
    spec: ["EDX-22"],
    default: {
      message: "Only arrays and STRINGs can be indexed, but {name} is {type}",
      hint: "Use [ ] after an array or a STRING, e.g. Scores[0].",
    },
  },
  "E-CHK-STRING-ELEMENT": {
    spec: ["EDX-23"],
    default: {
      message: "A STRING can't be changed one character at a time",
      hint: "Build a new STRING with & instead.",
    },
  },
};
