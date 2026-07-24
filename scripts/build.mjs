import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });

await Promise.all([
  build({
    entryPoints: ["src/content/index.ts"],
    bundle: true,
    outfile: "dist/content/index.js",
    format: "iife",
    target: "firefox109",
    sourcemap: true,
    logLevel: "info"
  }),
  build({
    entryPoints: ["src/options/options.ts"],
    bundle: true,
    outfile: "dist/options/options.js",
    format: "iife",
    target: "firefox109",
    sourcemap: true,
    logLevel: "info"
  })
]);

const files = [
  ["manifest.json", "dist/manifest.json"],
  ["src/content/content.css", "dist/content/content.css"],
  ["src/options/options.html", "dist/options/options.html"],
  ["src/options/options.css", "dist/options/options.css"]
];

for (const [from, to] of files) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}
