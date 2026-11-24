// A tiny Vite plugin that writes dist/sw.js from src/sw-template.js: it fills in the list of built files to store
// and a version (a hash of that list) so a new build replaces the old cache. No dependency; hand-written.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

export function pwa(): Plugin {
  let outDir = "dist";
  return {
    name: "sudocode-pwa",
    apply: "build",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle) {
      const files = Object.keys(bundle).map((f) => `/${f}`);
      const urls = ["/", "/manifest.webmanifest", "/icon.svg", ...files].sort();
      const version = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 10);
      const template = readFileSync(new URL("./src/sw-template.js", import.meta.url), "utf8");
      writeFileSync(
        join(outDir, "sw.js"),
        template
          .replace("const PRECACHE = __PRECACHE__;", `const PRECACHE = ${JSON.stringify(urls)};`)
          .replace('"sudocode-__VERSION__"', `"sudocode-${version}"`),
      );
    },
  };
}
