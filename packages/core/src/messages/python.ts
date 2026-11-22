// Python errors keep CPython's exception name and message (PY-01, PY-03); Sudocode adds only the hint.
// `{detail}` is CPython's own message text, e.g. `can only concatenate str (not "float") to str`.
import type { Catalogue } from "./types.ts";

const py = (name: string, hint: string): Catalogue[string] => ({
  spec: ["PY-03"],
  default: { message: `${name}: {detail}`, hint },
});

export const pythonMessages: Catalogue = {
  "E-PY-SyntaxError": py("SyntaxError", "Check the line for a missing bracket, colon or quote."),
  "E-PY-IndentationError": py("IndentationError", "Line this up with the block it belongs to. Use 4 spaces per level."),
  "E-PY-NameError": py("NameError", "Check the spelling, and that the name is given a value before this line."),
  "E-PY-TypeError": py(
    "TypeError",
    "Check the types on each side. input() always gives text: convert it with int(...) or float(...).",
  ),
  "E-PY-ValueError": py("ValueError", "The value has the right type but can't be used here, e.g. int('twelve')."),
  "E-PY-ZeroDivisionError": py("ZeroDivisionError", "Check the divisor is not 0 before dividing."),
  "E-PY-IndexError": py("IndexError", "Valid indexes are 0 to len(...) - 1. Check the loop limits."),
  "E-PY-KeyError": py("KeyError", "That key is not in the dictionary. Check with: if key in d: or use d.get(key)."),
  "E-PY-AttributeError": py("AttributeError", "Check the spelling of the name after the dot."),
  "E-PY-RecursionError": py(
    "RecursionError",
    "The function keeps calling itself. Make sure it has a base case that returns without another call.",
  ),
  "E-PY-UnboundLocalError": py(
    "UnboundLocalError",
    "The name is assigned inside this function, so Python treats it as local everywhere in it. Use global, or pass it in as a parameter.",
  ),
  "E-PY-FileNotFoundError": py(
    "FileNotFoundError",
    "Check the name in the Files panel, or open the file with 'w' to create it.",
  ),
  "E-PY-EOFError": py("EOFError", "The program asked for more input than was typed."),
};
