// One Vite config for the client build, the prerender (SSR) build and the Vitest unit tests.
// The client build writes both pages and their hashed assets into src/aegis/static, which
// FastAPI serves; `web/prerender.ts` then fills each page with its server-rendered HTML.
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const here = import.meta.dirname;
const web = resolve(here, "web");
const BASE = "/static/";

// The display face is font-display: optional (it never swaps in late, so headlines never shift),
// which only works if it is requested early: preload the hashed file the CSS points to.
function preloadDisplayFont(): Plugin {
  return {
    name: "aegis:preload-display-font",
    transformIndexHtml: {
      order: "post",
      handler: (_html, ctx) =>
        Object.keys(ctx.bundle ?? {})
          .filter((file) => /fraunces.*\.woff2$/.test(file))
          .map((file) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              href: `${BASE}${file}`,
              as: "font",
              type: "font/woff2",
              crossorigin: "",
            },
            injectTo: "head" as const,
          })),
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  root: web,
  base: BASE,
  plugins: [react(), preloadDisplayFont()],
  input: isSsrBuild ? undefined : { landing: resolve(web, "index.html"), planner: resolve(web, "plan.html") },
  build: {
    outDir: resolve(here, isSsrBuild ? ".prerender" : "src/aegis/static"),
    emptyOutDir: true,
    target: "es2023",
    // Small enough to inline would mean data: URLs for fonts; keep every asset a cacheable file.
    assetsInlineLimit: 0,
  },
  test: {
    root: here,
    environment: "jsdom",
    include: ["tests/web/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/web/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["web/src/**/*.{ts,tsx}"],
      // Entry points and the canvas painter run only in a real browser (covered by Playwright).
      exclude: [
        "web/src/landing.tsx",
        "web/src/planner.tsx",
        "web/src/prerender.tsx",
        "web/src/landing/haze.ts",
      ],
      thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 },
    },
  },
}));
