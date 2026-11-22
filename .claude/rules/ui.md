---
paths:
  - "packages/ui/**/*.{ts,tsx,css}"
  - "apps/**/*.{ts,tsx,css}"
---

# Rules for the UI and app shells

- Talk to the interpreter only via the `Runner` interface / worker messages from `@sudocode/core`. Never import parser or runtime internals.
- Every tool (lint, autocomplete, debugger, inspector...) must be switchable off in Settings, and hidden in Simple mode unless the spec says otherwise.
- Touch targets at least 44x44 px; everything reachable by keyboard; visible focus; labels for screen readers.
- Design values (colours, spacing, type) come from the design tokens file; don't hard-code new ones.
- Keep bundles small (2 GB RAM target): no new dependency without asking me; lazy-load heavy panels.
- Split view is desktop only.
