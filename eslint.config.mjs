// ESLint for the React front end (TypeScript, type-aware), its tests and the Playwright specs.
// The size, complexity and magic-number limits below are this repo's code-quality rules;
// CODE_QUALITY.md reports the measured values against them.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const APP = "web/**/*.{ts,tsx}";

export default tseslint.config(
  {
    ignores: [
      "src/aegis/static/**",
      ".prerender/**",
      "node_modules/**",
      ".venv/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  {
    files: [APP, "tests/web/**/*.{ts,tsx}", "vite.config.ts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: [APP],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      "react-hooks/exhaustive-deps": "error",
      "max-lines": ["error", { max: 110, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 30, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 6],
      "max-depth": ["error", 3],
      "max-params": ["error", 3],
      "no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2, 100],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
    },
  },
  // Components: Prettier sets JSX one attribute per line, so markup gets room that logic does not.
  {
    files: ["web/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  // The API contract mirrors models/ declaration for declaration; it has no logic to size.
  { files: ["web/src/lib/types.ts"], rules: { "max-lines": "off" } },
  // Geometry and motion constants live in these files; this is where the numbers are allowed.
  {
    files: ["web/src/lib/geometry.ts", "web/src/lib/motion.ts", "web/src/landing/haze.ts"],
    rules: { "no-magic-numbers": "off" },
  },
  { files: ["web/prerender.ts", "vite.config.ts"], languageOptions: { globals: globals.node } },
  { files: ["tests/**/*.mjs", "*.mjs"], languageOptions: { globals: globals.node } },
  // Playwright callbacks passed to page.evaluate run in the browser.
  { files: ["tests/e2e/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    rules: {
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-globals": "error",
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-param-reassign": ["error", { props: false }],
      "object-shorthand": "error",
      "prefer-template": "error",
      curly: ["error", "multi-line"],
    },
  },
);
