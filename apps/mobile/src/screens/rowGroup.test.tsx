import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findControl, recorded, resetRecorded } from "./__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("./__tests__/navigation").then((m) => m.lucideMock));

import { LinkRow, RowGroup, SwitchRow } from "./rowGroup";

beforeEach(() => {
  resetRecorded();
});

describe("grouped rows", () => {
  it("renders link rows with values and a toggle row", () => {
    const onPress = vi.fn();
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      <RowGroup>
        <LinkRow label="Account" onPress={onPress} value="Guest" />
        <LinkRow label="Delete local data" onPress={vi.fn()} tone="danger" />
        <SwitchRow label="Anonymous analytics" onChange={onChange} value />
      </RowGroup>,
    );

    expect(markup).toContain("Guest");
    findControl("Account, Guest")?.onPress?.();
    expect(onPress).toHaveBeenCalledOnce();
    recorded.switches[0]?.onValueChange?.(false);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(recorded.switches[0]?.accessibilityLabel).toBe("Anonymous analytics");
  });
});
