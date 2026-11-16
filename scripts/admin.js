import { openDb } from "../server/db.js";
import { register, passwordHash } from "../server/auth.js";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  get = (k) => args[args.indexOf(k) + 1];
if (!args.includes("--handle") || !process.env.MIMELO_ADMIN_PASSWORD) {
  console.error(
    "Usage: MIMELO_ADMIN_PASSWORD=<secret> npm run admin -- --handle <handle> --name <display name>",
  );
  process.exit(1);
}
const password = await passwordHash(process.env.MIMELO_ADMIN_PASSWORD),
  db = openDb(process.env.MIMELO_DATABASE || resolve(".runtime/book.sqlite"));
const u = db
  .transaction(() =>
    register(
      db,
      {
        handle: get("--handle"),
        name: args.includes("--name") ? get("--name") : get("--handle"),
        email: args.includes("--email") ? get("--email") : null,
      },
      password,
      null,
      true,
    ),
  )
  .immediate();
console.log("Created site admin " + u.handle + ".");
db.close();
