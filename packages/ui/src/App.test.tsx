import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";

describe("MISC the app shell", () => {
  it("MISC renders the name Sudocode and the three languages", () => {
    expect(renderToStaticMarkup(<App />)).toBe(
      "<main><h1>Sudocode</h1><p>Write, run and debug programs in:</p><ul>" +
        "<li>Edexcel IGCSE pseudocode</li><li>Cambridge 9618 pseudocode</li><li>Python</li></ul></main>",
    );
  });
});
