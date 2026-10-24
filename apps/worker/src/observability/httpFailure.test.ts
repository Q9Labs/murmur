import { describe, expect, it } from "vitest";
import { httpFailureTags, sanitizeHttpFailureTags } from "./httpFailure";

describe("bounded HTTP failure diagnostics", () => {
  it.each([
    [new TypeError("private"), "type_error"], [new RangeError("private"), "range_error"],
    [new SyntaxError("private"), "syntax_error"], [new DOMException("private", "AbortError"), "abort"],
    [new DOMException("private", "TimeoutError"), "timeout"], [new Error("private"), "error"],
    [{ name: "TypeError", status: 503, message: "private" }, "non_error"],
  ])("classifies error instances without exporting their fields", (failure, category) => {
    expect(httpFailureTags({ boundary: "auth_api", status: 503 }, failure)).toEqual({
      http_failure_boundary: "auth_api", http_failure_route: "other",
      http_failure_category: category, http_failure_status: "503",
    });
  });

  it.each([
    ["/v3/customer?private=token", "/v3/customer"], ["/api/auth/private", "/api/auth/*"],
    ["/v1/reports/private", "/v1/reports/:id"], ["/v2/session/private/stop", "/v2/session/:id/stop"],
    ["/private", "other"], ["/v3/customer/private", "other"],
  ])("maps %s to a static template", (path, route) => {
    expect(httpFailureTags({ boundary: "http_handler", request: new Request(`https://worker.invalid${path}`) }, null))
      .toMatchObject({ http_failure_route: route });
  });

  it.each(["private", "503 private", "099", "600", "503.0", 503, null])("rejects arbitrary fields %s", (value) => {
    expect(sanitizeHttpFailureTags({ http_failure_boundary: value, http_failure_route: value,
      http_failure_category: value, http_failure_status: value })).toEqual({});
  });
});
