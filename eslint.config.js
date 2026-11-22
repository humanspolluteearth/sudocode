// ESLint flat config for the whole monorepo.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// `reference/` holds the old prototype as read-only material. Nothing outside it may import from it.
// Matches any import or require path with a `reference` folder segment, relative or absolute.
export const referenceImportPattern = "(^|[\\\\/])reference([\\\\/]|$)";
const referenceImportMessage =
  "reference/ is read-only material from the old prototype. Port the idea into the new code instead of importing it.";

export default tseslint.config(
  {
    ignores: ["reference/**", "**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.mjs", ".claude/hooks/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: referenceImportPattern, message: referenceImportMessage }] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.name='require'] > Literal[value=/${referenceImportPattern}/]`,
          message: referenceImportMessage,
        },
        {
          selector: `ImportExpression > Literal[value=/${referenceImportPattern}/]`,
          message: referenceImportMessage,
        },
      ],
    },
  },
  {
    // packages/core must run in Node AND in a Web Worker (CLAUDE.md, .claude/rules/core.md):
    // no React, CodeMirror or UI package, no Node built-ins, no DOM or Node globals in its source.
    files: ["packages/core/src/**/*.ts"],
    ignores: ["packages/core/src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: referenceImportPattern, message: referenceImportMessage },
            {
              regex: "^(react|react-dom|@codemirror/.*|@sudocode/(ui|web))(/|$)",
              message: "packages/core cannot use UI code. The UI talks to core through the Runner interface.",
            },
            {
              regex: "^node:",
              message: "packages/core must also run in a Web Worker, so it cannot use Node built-ins.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...["window", "document", "localStorage", "sessionStorage", "navigator", "process", "Buffer", "require"].map(
          (name) => ({ name, message: "packages/core must run in Node and in a Web Worker; pass this in instead." }),
        ),
      ],
    },
  },
  {
    // Dependencies point one way: apps -> ui -> core (CLAUDE.md). The UI uses core's public entry only (the
    // Runner interface and plain types), never parser or runtime internals.
    files: ["packages/ui/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: referenceImportPattern, message: referenceImportMessage },
            {
              regex: "^@sudocode/web(/|$)|(^|/)apps/",
              message: "packages/ui cannot import an app: apps depend on ui, not the reverse.",
            },
            {
              // Only the public entry and the two worker entry files (optionally with Vite's ?worker suffix).
              regex: "^@sudocode/core/(?!(run|check)-worker(\\?worker)?$)|(^|/)packages/core/|^\\.\\./(\\.\\./)*core/",
              message:
                'Import "@sudocode/core" (or its run-worker/check-worker entries) only: the UI talks to the engine through the Runner interface.',
            },
          ],
        },
      ],
    },
  },
  {
    // Apps are thin shells: the same rule as the UI for reaching into core.
    files: ["apps/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: referenceImportPattern, message: referenceImportMessage },
            {
              regex: "^@sudocode/core/(?!(run|check)-worker(\\?worker)?$)|(^|/)packages/core/",
              message: 'Import "@sudocode/core" (or its run-worker/check-worker entries) only.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests are never skipped, focused or left as todo (CLAUDE.md: never skip a test to make it pass).
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.name='require'] > Literal[value=/${referenceImportPattern}/]`,
          message: referenceImportMessage,
        },
        {
          selector: `ImportExpression > Literal[value=/${referenceImportPattern}/]`,
          message: referenceImportMessage,
        },
        {
          selector:
            "MemberExpression[object.name=/^(it|test|describe|suite)$/][property.name=/^(skip|only|todo|skipIf|runIf)$/]",
          message: "Tests are never skipped, focused or left as todo. A test that can't pass yet goes in pending.json.",
        },
        {
          selector:
            "MemberExpression[object.name=/^(xit|xdescribe|fit|fdescribe)$/], Identifier[name=/^(xit|xdescribe|fit|fdescribe)$/]",
          message: "Tests are never skipped or focused.",
        },
      ],
    },
  },
  {
    // Plain JavaScript files (configs, Claude Code hooks) are not type-checked.
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
);
