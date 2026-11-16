import { createApp } from "./app.js";
const app = await createApp({ logger: true });
await app.listen({
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT) || 8080,
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
