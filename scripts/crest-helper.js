import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { crestHelperZip } from "../server/badge-import.js";

const folder = resolve(import.meta.dirname, "../artifacts");
mkdirSync(folder, { recursive: true });
const path = resolve(folder, "mimelo-crest-helper.zip");
writeFileSync(path, await crestHelperZip());
console.log("Browser helper: " + path);
