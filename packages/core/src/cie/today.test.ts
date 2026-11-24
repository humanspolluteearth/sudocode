// CIE-129: TODAY() reads an injected date, so the tests never depend on the real clock.
import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../engine.ts";
import { runHeadless } from "../runner/headless.ts";

async function stdout(source: string): Promise<string> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    {
      language: "cie",
      source,
      files: {},
      seed: 1,
      breakpoints: [],
      trace: false,
      today: { day: 5, month: 3, year: 2025 },
    },
    [],
  );
  return r.stdout;
}

describe("CIE-129 TODAY", () => {
  // 5 March 2025 was a Wednesday, so DAYINDEX (Sunday = 1) is 4.
  it("CIE-129 TODAY() prints the injected date as dd/mm/yyyy", async () => {
    expect(await stdout("OUTPUT TODAY()")).toBe("05/03/2025\n");
  });
  it("CIE-129 DAY, MONTH, YEAR and DAYINDEX of TODAY() use the injected date", async () => {
    expect(await stdout("OUTPUT DAY(TODAY()), MONTH(TODAY()), YEAR(TODAY()), DAYINDEX(TODAY())")).toBe(
      "532025" + "4\n",
    );
  });
});
