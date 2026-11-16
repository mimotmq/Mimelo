import { openDb } from "../server/db.js";
import { resolve } from "node:path";
const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run backup -- /absolute/path/backup.sqlite");
  process.exit(1);
}
const db = openDb(
  process.env.MIMELO_DATABASE || resolve(".runtime/book.sqlite"),
);
await db.backup(resolve(target));
db.close();
console.log(
  "Database backup complete. Copy .runtime/uploads separately for profile photos.",
);
