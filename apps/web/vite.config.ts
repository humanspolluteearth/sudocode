import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { pwa } from "./pwa-plugin.ts";

// Cross-origin isolation is on from day one (docs/DECISIONS.md), in dev too; production sets the same headers
// in public/_headers (Cloudflare).
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react(), pwa()],
  server: { headers: isolation },
  preview: { headers: isolation },
});
