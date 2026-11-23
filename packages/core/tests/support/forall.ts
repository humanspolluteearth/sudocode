// A tiny property-test helper: runs a property over many generated cases from a fixed seed (SH-12: deterministic).
// docs/milestones/M05 asks for fast-check; the package could not be installed in the build sandbox (no network), so
// this stands in. Swapping to fast-check later only changes the generators. Run count: SUDOCODE_RUNS (nightly sets it high).
import { seededRandom } from "../../src/runtime/random.ts";

export type Rng = () => number;
export const RUNS = Number(process.env["SUDOCODE_RUNS"] ?? 300);

export const int = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T>(r: Rng, items: readonly T[]): T => items[int(r, 0, items.length - 1)] as T;

/** Runs `property` on `runs` cases; the failing case's seed and input are in the thrown message. */
export function forAll<T>(seed: number, gen: (r: Rng) => T, property: (value: T) => void, runs = RUNS): void {
  const r = seededRandom(seed);
  for (let i = 0; i < runs; i++) {
    const value = gen(r);
    try {
      property(value);
    } catch (e) {
      throw new Error(
        `Property failed on case ${String(i)} (seed ${String(seed)}): ${JSON.stringify(value)}\n${String(e)}`,
        { cause: e },
      );
    }
  }
}
