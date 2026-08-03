import { describe, expect, it, vi } from "vitest";

const share = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({
  Share: { share },
}));

import { shareMurmur } from "./shareMurmur";

describe("share Murmur", () => {
  it("shares a tagged public landing URL without caption content", async () => {
    await shareMurmur();

    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining("https://murmur.q9labs.ai/?utm_source=murmur-app"),
      title: "Murmur: Live Voice Translator",
      url: expect.stringContaining("utm_campaign=organic-share"),
    });
    expect(JSON.stringify(share.mock.calls)).not.toContain("translated_caption");
  });
});
