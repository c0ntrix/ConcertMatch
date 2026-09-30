import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
if (!process.env.npm_execpath) throw new Error("Run npm run install:ci.");
process.env.SHARP_IGNORE_GLOBAL_LIBVIPS ??= "1";
const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "ci",
    "--prefix",
    projectRoot,
    "--include=dev",
    "--include=optional",
    "--no-audit",
    "--no-fund",
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
