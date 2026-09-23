import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ term: undefined as string | undefined }));

vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ term: "packs" }) }));
vi.mock("../src/screens/plans/plansScreen", () => ({
  planTermFromParam: (value: string) => (value === "packs" ? "pack" : undefined),
  PlansScreen: (props: { initialTerm?: string }) => {
    seen.term = props.initialTerm;
    return null;
  },
}));

import PlansRoute from "./plans";

describe("plans route", () => {
  it("opens the tab named in the deep link", () => {
    renderToStaticMarkup(<PlansRoute />);
    expect(seen.term).toBe("pack");
  });
});
