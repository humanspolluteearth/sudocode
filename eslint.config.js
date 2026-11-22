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
    // Plain JavaScript files (configs, Claude Code hooks) are not type-checked.
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
);
