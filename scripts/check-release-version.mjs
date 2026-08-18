import { readFile } from "node:fs/promises";

const tag = process.argv[2];

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Release tag must use vMAJOR.MINOR.PATCH; received ${JSON.stringify(tag)}`);
}

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8")
);
const expectedVersion = tag.slice(1);

for (const [file, version] of [
  ["package.json", packageJson.version],
  ["manifest.json", manifest.version]
]) {
  if (version !== expectedVersion) {
    throw new Error(`${file} version ${version} does not match release tag ${tag}`);
  }
}

console.log(`Release versions match ${tag}`);
