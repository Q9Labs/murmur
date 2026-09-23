import { describe, expect, it } from "vitest";

import { RevenueCatEventRepository } from "./revenueCatEventRepository";

describe("RevenueCat merged guest identity", () => {
  it("resolves a deleted guest to the active registered customer", async () => {
    const database = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            return sql.includes("FROM customer_aliases")
              ? { customer_id: "registered-1" }
              : null;
          },
        };
      },
    };

    const repository = new RevenueCatEventRepository(database);
    await expect(repository.resolveCustomerId(["guest-1"])).resolves.toBe("registered-1");
  });
});
