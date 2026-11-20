// Fill each built page's <!--app--> slot with its server-rendered HTML (run after both builds).
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const server = resolve(root, ".prerender/prerender.js");
const { render } = (await import(server)) as { render: (page: "landing" | "planner") => string };
const pages = { landing: "index.html", planner: "plan.html" } as const;

for (const [page, file] of Object.entries(pages) as ["landing" | "planner", string][]) {
  const path = resolve(root, "src/aegis/static", file);
  const html = await readFile(path, "utf8");
  if (!html.includes("<!--app-->")) throw new Error(`${file} has no <!--app--> slot`);
  await writeFile(
    path,
    html.replace("<!--app-->", () => render(page)),
  );
}
await rm(resolve(root, ".prerender"), { recursive: true });
