import { describe, expect, it } from "vitest";
import { judge } from "./size-budget.ts";

describe("MISC size budget", () => {
  it("MISC passes at or under the budget", () => {
    expect(judge(1000, 1000).ok).toBe(true);
    expect(judge(10, 1000).ok).toBe(true);
  });
  it("MISC fails over the budget and says by how much", () => {
    const v = judge(3072, 1024);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("2.0 kB");
  });
});
