import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(root, ".netlify-content");
const marker = path.join(output, "manifest.json");
for (const source of ["quiz", path.join("notes", "raw")]) {
  if (!existsSync(path.join(root, "..", source))) throw new Error(`Missing learning source: ${source}`);
}
if (existsSync(output)) {
  if (!existsSync(marker) || JSON.parse(readFileSync(marker, "utf8")).generator !== "tako-jp") {
    throw new Error("Refusing to replace an unrecognized .netlify-content directory.");
  }
  rmSync(output, { recursive: true });
}
mkdirSync(output, { recursive: true });
writeFileSync(marker, JSON.stringify({ generator: "tako-jp", version: 1 }));
for (const [source, extension] of [
  ["quiz", /\.json$/i],
  [path.join("notes", "raw"), /\.(md|png|jpe?g|gif|webp)$/i],
]) {
  cpSync(path.join(root, "..", source), path.join(output, source), {
    recursive: true,
    filter: (filename) => statSync(filename).isDirectory() || extension.test(filename),
  });
}
cpSync(path.join(root, "data", "vocabulary"), path.join(output, "vocabulary"), { recursive: true });
console.log("[tako-jp] Read-only JSON, Markdown and note images packaged for serverless deployment.");
