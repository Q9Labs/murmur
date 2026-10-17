import { describe, expect, it } from "vitest";
import { failures, failureDefinition, isFailureCode } from "./failures";

describe("failure registry v1", () => {
  it("contains all four classes and never treats an unknown code as expected", () => {
    expect(new Set(Object.values(failures).map((entry) => entry.class))).toEqual(new Set(["defect", "expected", "dependency", "unknown"]));
    expect(failureDefinition("new.unregistered_failure")).toEqual(failures["worker.request_failed"]);
    expect(isFailureCode("toString")).toBe(false);
    expect(isFailureCode("__proto__")).toBe(false);
  });
});
