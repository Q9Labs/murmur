import { vi } from "vitest";
import type { ReactNode } from "react";

export const router = {
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  dismissTo: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  setParams: vi.fn(),
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
  Mail: () => null,
  Settings: () => null,
  ShieldCheck: () => null,
  Sparkles: () => null,
  Star: () => null,
};
