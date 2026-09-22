/// <reference types="@cloudflare/workers-types" />

import { describe, expect, it } from "vitest";

import { closeAbandonedUsageSessions } from "./usageSessionStore";

function stubUsageSessionDatabase(changes: number): {
  bindings: unknown[][];
  database: D1Database;
  statements: string[];
} {
  const bindings: unknown[][] = [];
  const statements: string[] = [];
  const database = {
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            async run() {
              return { meta: { changes } };
            },
          };
        },
      } as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
  return { bindings, database, statements };
}

describe("Abandoned usage session sweep", () => {
  it("fails sessions left open longer than the maximum session length", async () => {
    const { bindings, database, statements } = stubUsageSessionDatabase(3);

    await expect(closeAbandonedUsageSessions(database, 2_000_000, 900_000)).resolves.toBe(3);
    expect(statements[0]).toContain("UPDATE usage_sessions");
    expect(statements[0]).toContain("state = 'open'");
    expect(bindings[0]).toEqual([2_000_000, 2_000_000, 1_100_000]);
  });

  it("does nothing when the billing database is unavailable", async () => {
    await expect(closeAbandonedUsageSessions(undefined, 2_000_000, 900_000)).resolves.toBe(0);
  });
});
