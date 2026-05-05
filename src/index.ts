import "dotenv/config";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const { app } = await buildServer();

await app.listen({ port, host });

