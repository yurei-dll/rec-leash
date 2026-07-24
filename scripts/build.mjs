import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  ["src/content/content.css", "dist/content/content.css"],
  ["src/options/options.css", "dist/options/options.css"]
];

for (const [from, to] of files) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

const sourceManifest = JSON.parse(await readFile("manifest.json", "utf8"));
sourceManifest.content_scripts[0].js = ["content/index.js"];
sourceManifest.content_scripts[0].css = ["content/content.css"];
sourceManifest.options_ui.page = "options/options.html";
await writeFile("dist/manifest.json", `${JSON.stringify(sourceManifest, null, 2)}\n`);

const sourceOptionsHtml = await readFile("src/options/options.html", "utf8");
const distOptionsHtml = sourceOptionsHtml.replace("../../dist/options/options.js", "./options.js");
await writeFile("dist/options/options.html", distOptionsHtml);
