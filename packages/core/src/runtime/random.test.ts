import { describe, expect, it } from "vitest";
import { seededRandom } from "./random.ts";

const take = (seed: number, n: number): number[] => {
  const next = seededRandom(seed);
  return Array.from({ length: n }, () => next());
};

describe("SH-12 the seedable random generator", () => {
  it("SH-12 the same seed gives the same sequence", () => {
    expect(take(42, 20)).toEqual(take(42, 20));
  });
  it("SH-12 different seeds give different sequences", () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });
  it("SH-12 every value is from 0 up to, but not including, 1", () => {
    for (const v of take(7, 2000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
