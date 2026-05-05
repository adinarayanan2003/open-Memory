import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

describe("HTTP API", () => {
  it("creates a manual source and schedules extraction", async () => {
    const { app } = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/sources/manual",
      payload: {
        userId: "user",
        title: "Current work",
        text: "I am working on open-Memory and building a backend memory engine."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.source.id).toBeTruthy();
    expect(body.job.id).toBeTruthy();
    await app.close();
  });
});

