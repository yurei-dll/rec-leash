import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const filename = `${packageJson.name}.firefox.${packageJson.version}.zip`;
const result = spawnSync(
  "web-ext",
  [
    "build",
    "--source-dir",
    "dist",
    "--artifacts-dir",
    "web-ext-artifacts",
    "--filename",
    filename,
    "--overwrite-dest",
    "--no-input"
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NO_UPDATE_NOTIFIER: "1" }
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
