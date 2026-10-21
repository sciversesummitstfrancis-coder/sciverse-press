import { buildApp } from "./app.js";
import { getDb } from "./db.js";

const port = Number(process.env.PORT ?? 4000);
getDb(); // ensure schema
const app = buildApp();
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`press-platform backend on :${port}`);
});
