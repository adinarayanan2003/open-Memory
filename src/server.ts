import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { PrismaClient } from "@prisma/client";
import { MemoryEngine } from "./engine/memory-engine.js";
import { InProcessJobQueue } from "./queue/job-queue.js";
import { InMemoryStore } from "./repositories/in-memory-store.js";
import type { MemoryStore } from "./repositories/memory-store.js";
import { PrismaMemoryStore } from "./repositories/prisma-store.js";
import { registerRoutes } from "./http/routes.js";

export type BuildServerOptions = {
  store?: MemoryStore;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });
  await app.register(sensible);
  const prisma =
    options.store || process.env.MEMORY_STORE === "memory" ? undefined : new PrismaClient();
  const store = options.store ?? (prisma ? new PrismaMemoryStore(prisma) : new InMemoryStore());
  const engine = new MemoryEngine(store);
  const queue = new InProcessJobQueue(engine);
  if (prisma) {
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  }
  await registerRoutes(app, engine, queue);
  return { app, engine, queue };
}
