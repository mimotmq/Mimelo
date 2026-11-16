import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = JSON.parse(
  readFileSync(new URL("../design-reference/SOURCE.json", import.meta.url)),
);
let count = 0;
for (const [name, hash] of Object.entries(source.files)) {
  const reference = readFileSync(
    new URL("../design-reference/" + name, import.meta.url),
  );
  if (createHash("sha256").update(reference).digest("hex") !== hash)
    throw new Error("Reference modified: " + name);
  if (
    name.endsWith(".html") ||
    name.startsWith("css/") ||
    name.startsWith("assets/")
  ) {
    const live = readFileSync(new URL("../static/" + name, import.meta.url));
    if (!live.equals(reference)) throw new Error("Template differs: " + name);
    count++;
  }
}
console.log(
  `PASS ${count} unchanged HTML, CSS and asset files; all ${Object.keys(source.files).length} reference hashes verified.`,
);
