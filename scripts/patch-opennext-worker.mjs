import { readFile, writeFile } from "node:fs/promises";

const workerPath = new URL("../.open-next/worker.js", import.meta.url);
const marker = "globalThis.require ??=";
const source = await readFile(workerPath, "utf8");

if (!source.includes(marker)) {
  const compatibilityPrelude = [
    'import { createRequire as __waypointCreateRequire } from "node:module";',
    "globalThis.require ??= __waypointCreateRequire(import.meta.url);",
    "",
  ].join("\n");
  await writeFile(workerPath, compatibilityPrelude + source);
}
