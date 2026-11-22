<!-- Title: Conventional Commits, e.g. "feat(edexcel): FOR loops with STEP" or "tests(edexcel): FOR loops" -->

## What and why
<!-- One or two sentences. Link the issue: Closes #... -->

## Spec IDs covered
<!-- e.g. EDX-52, EDX-53, EDX-54 -->

## New or changed expected files (reviewer checks each one against its spec row)
<!-- e.g. packages/core/tests/golden/edexcel/EDX-54-step-zero.expected.json -->

## Design and concept
<!-- For packages/core: how it works, and the compiler concept it uses -->

## How it was verified
<!-- `pnpm check` output; screenshots for UI changes -->

## Checklist
- [ ] Spec rows exist for every new behaviour (`docs/language-spec/`)
- [ ] Core: tests merged in an earlier `tests:` PR and not modified here
- [ ] Exact-value assertions; at least one negative case per feature
- [ ] Bug fixes include a regression test that failed on `main`
- [ ] Commits signed off (`git commit -s`)
- [ ] CI green
