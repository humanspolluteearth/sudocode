import { describe, expect, it } from "vitest";
import { run } from "../../tests/support/run-ir.ts";
import { analyse } from "./engine.ts";

const out = async (n: number): Promise<string> => {
  const { program } = analyse(
    `DECLARE N : INTEGER\nN <- ${String(n)}\nCASE OF N\n  1 : OUTPUT "one"\n  3 TO 5 : OUTPUT "range"\n  OTHERWISE : OUTPUT "other"\nENDCASE`,
  );
  if (program === null) throw new Error("did not compile");
  return (await run(program)).stdout;
};

describe("CIE-52 CASE ranges", () => {
  it.each([
    [1, "one\n"],
    [2, "other\n"],
    [3, "range\n"],
    [4, "range\n"],
    [5, "range\n"],
    [6, "other\n"],
  ])("CIE-52 a range includes both ends: N = %i prints %j", async (n, expected) => {
    expect(await out(n)).toBe(expected);
  });
  it("CIE-52 a range of the wrong type is a checker error", () => {
    const d = analyse('DECLARE N : INTEGER\nCASE OF N\n  1 TO "x" : OUTPUT 1\nENDCASE').diagnostics;
    expect(d.map((x) => x.code)).toEqual(["E-CHK-COMPARE-TYPES"]);
  });
});
