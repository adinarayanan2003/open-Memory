import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { MemoryEngine } from "./engine/memory-engine.js";
import { InProcessJobQueue } from "./queue/job-queue.js";
import { InMemoryStore } from "./repositories/in-memory-store.js";
import { registerRoutes } from "./http/routes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(sensible);
  const engine = new MemoryEngine(new InMemoryStore());
  const queue = new InProcessJobQueue(engine);
  await registerRoutes(app, engine, queue);
  return { app, engine, queue };
}

