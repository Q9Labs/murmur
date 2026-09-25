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
  AudioLines: () => null,
  Captions: () => null,
  Check: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Clock: () => null,
  KeyRound: () => null,
  Mail: () => null,
  MessagesSquare: () => null,
  Settings: () => null,
  ShieldAlert: () => null,
  ShieldCheck: () => null,
  Smartphone: () => null,
  Sparkles: () => null,
  Star: () => null,
  UserRound: () => null,
};
