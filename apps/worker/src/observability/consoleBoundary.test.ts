import { expect, it, vi } from "vitest";

it("drops SDK and dependency writes at module initialization", async () => {
  const original = { ...console };
  const sink = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await import("./consoleBoundary");
    console.error("PRIVATE_EMAIL@example.invalid", new Error("PRIVATE_PROVIDER_RESPONSE"));
    expect(sink).not.toHaveBeenCalled();
  } finally { Object.assign(console, original); sink.mockRestore(); }
});
