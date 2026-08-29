import { describe, expect, it } from "vitest";

import { createMurmurAuth, getMurmurSession } from "./auth";

describe("Murmur Worker authentication", () => {
  it("stays unavailable when durable auth storage is not configured", async () => {
    expect(createMurmurAuth({ MURMUR_ENV: "production" })).toBeNull();
    await expect(getMurmurSession(
      new Request("https://worker.example.test/v3/customer"),
      { MURMUR_ENV: "production" },
    )).resolves.toBeNull();
  });
});
