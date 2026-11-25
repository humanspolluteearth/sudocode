// Names for the pseudocode-to-pseudocode converter (CNV-08).
//
// Compiler concept: a *name-mangling pass*. The two languages disagree about which words are reserved and about
// capital letters, so every identifier is mapped once, before printing: a name that is a keyword or builtin of the
// target gets a trailing `_`, and Cambridge (which ignores case) refuses a program whose names differ only by case.
import { CIE_RESERVED } from "../../cie/cursor.ts";
import { RESERVED as EDEXCEL_RESERVED } from "../../edexcel/cursor.ts";
import type { Program } from "../../ir/ir.ts";

export type PseudoTarget = "cie" | "edexcel";

/** Cambridge's built-in function names are not reserved words, but a variable called `left` would hide the function. */
const CIE_BUILTINS = [
  ...["LENGTH", "LEFT", "RIGHT", "MID", "UCASE", "LCASE", "TO_UPPER", "TO_LOWER", "NUM_TO_STR", "STR_TO_NUM"],
  ...["IS_NUM", "ASC", "CHR", "INT", "RAND", "EOF", "DAY", "MONTH", "YEAR", "DAYINDEX", "SETDATE", "TODAY"],
];
const EDEXCEL_BUILTINS = ["LENGTH", "RANDOM"];

const reserved = (target: PseudoTarget, name: string): boolean => {
  const upper = name.toUpperCase();
  return target === "cie"
    ? CIE_RESERVED.has(upper) || CIE_BUILTINS.includes(upper)
    : EDEXCEL_RESERVED.has(upper) || EDEXCEL_BUILTINS.includes(upper);
};

/** Every name the program uses, in the order it first appears. */
function allNames(program: Program): string[] {
  const seen: string[] = [];
  const add = (name: string): void => {
    seen.push(name);
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const node = value as { kind?: unknown; name?: unknown; callee?: unknown };
    if (node.kind === "var" && typeof node.name === "string") add(node.name);
    if (typeof node.callee === "string") add(node.callee);
    for (const [key, child] of Object.entries(value)) if (key !== "span") walk(child);
  };
  Object.keys(program.declared ?? {}).forEach(add);
  walk(program.main);
  for (const sub of Object.values(program.subprograms)) {
    add(sub.name);
    sub.params.forEach(add);
    Object.keys(sub.declared ?? {}).forEach(add);
    walk(sub.body);
  }
  return seen;
}

export class Names {
  private readonly map = new Map<string, string>();
  private readonly taken = new Set<string>();

  private constructor() {}

  /** The name to print for a name in the source. */
  of(name: string): string {
    return this.map.get(name.toLowerCase()) ?? this.map.get(name) ?? name;
  }

  /** A new name such as `i_1`, `i_2` that nothing else uses (CNV-14). */
  fresh(prefix: string): string {
    for (let n = 1; ; n++) {
      const name = `${prefix}_${String(n)}`;
      if (!this.taken.has(name.toLowerCase())) {
        this.taken.add(name.toLowerCase());
        return name;
      }
    }
  }

  /**
   * Builds the mapping, or says which two names clash. `caseBlind` is true for a Cambridge source (its names ignore
   * case, so `Count` and `count` are one name) and for a Cambridge target (which cannot tell two such names apart).
   */
  static build(program: Program, source: PseudoTarget, target: PseudoTarget): Names | { clash: string } {
    const names = new Names();
    const first = new Map<string, string>(); // lower-case spelling -> first spelling seen
    for (const name of allNames(program)) {
      const key = name.toLowerCase();
      const earlier = first.get(key);
      if (earlier === undefined) first.set(key, name);
      else if (earlier !== name && source === "edexcel" && target === "cie") {
        return {
          clash: `The names ${earlier} and ${name} differ only by capital letters, and Cambridge treats them as the same name.`,
        };
      }
    }
    for (const [key, spelling] of first) {
      let out = spelling;
      while (reserved(target, out) || names.taken.has(out.toLowerCase())) out += "_";
      names.taken.add(out.toLowerCase());
      names.map.set(key, out);
    }
    // Edexcel names are case-sensitive: a spelling that is not the first one (CIE source) maps through its lower-case key.
    return names;
  }
}
