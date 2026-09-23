import { vi } from "vitest";
import type { ReactNode } from "react";

export const router = {
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  push: vi.fn(),
  replace: vi.fn(),
};

export const expoRouterMock = {
  useLocalSearchParams: vi.fn(() => ({})),
  useRouter: () => router,
};

export const safeAreaMock = {
  SafeAreaView: ({ children }: { children?: ReactNode }) => children,
};

export const lucideMock = {
  Check: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
};
