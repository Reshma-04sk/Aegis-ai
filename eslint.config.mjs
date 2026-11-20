// ESLint for the no-build front end (ES modules), the node:test helpers and the Playwright specs.
// The size, complexity and magic-number limits below are the code-quality rules of this repo;
// CODE_QUALITY.md reports the measured values against them.
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

const APP = "src/aegis/static/js/**/*.js";

export default [
  {
    ignores: [
      "src/aegis/static/vendor/**",
      "node_modules/**",
      ".venv/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  {
    files: [APP],
    languageOptions: { sourceType: "module", globals: globals.browser },
    plugins: { jsdoc },
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 8],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2, 100, 1000],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
      "jsdoc/require-jsdoc": [
        "error",
        { publicOnly: true, require: { FunctionDeclaration: true, ArrowFunctionExpression: true } },
      ],
    },
  },
  // Named constants live here; this is where the numbers are allowed.
  {
    files: ["src/aegis/static/js/motion/constants.js", "src/aegis/static/js/chart.js"],
    rules: { "no-magic-numbers": "off" },
  },
  { files: ["tests/**/*.mjs", "*.mjs"], languageOptions: { globals: globals.node } },
  // Playwright callbacks passed to page.evaluate run in the browser.
  { files: ["tests/e2e/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    rules: {
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-globals": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-param-reassign": ["error", { props: false }],
      "no-shadow": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      curly: ["error", "multi-line"],
    },
  },
];
