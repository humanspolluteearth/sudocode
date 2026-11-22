import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Cross-origin isolation is on from day one (docs/DECISIONS.md), in dev too; production sets the same headers
// in public/_headers (Cloudflare).
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
});
