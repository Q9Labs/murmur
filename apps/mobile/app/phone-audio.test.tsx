import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/phoneAudio/phoneAudioScreen", () => ({ PhoneAudioScreen: () => <p>phone audio</p> }));

import PhoneAudioRoute from "./phone-audio";

describe("phone audio route", () => {
  it("renders the phone audio screen", () => {
    expect(renderToStaticMarkup(<PhoneAudioRoute />)).toContain("phone audio");
  });
});
