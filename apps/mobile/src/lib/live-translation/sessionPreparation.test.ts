import { describe, expect, it, vi } from "vitest";

import { createSessionPreparation } from "./sessionPreparation";

describe("session preparation", () => {
  it("warms identity and recording access only once", async () => {
    let nowMs = 100;
    const getInstallId = vi.fn(async () => "install_1");
    const requestMicrophonePermission = vi.fn(async () => true);
    const statuses: string[] = [];
    const preparation = createSessionPreparation({
      getInstallId,
      now: () => ++nowMs,
      onStatusChange: (status) => statuses.push(status),
      requestMicrophonePermission,
    });

    const [first, second] = await Promise.all([
      preparation.prepare(),
      preparation.prepare(),
    ]);
    await preparation.prepare();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      app_install_id: "install_1",
      microphone_granted: true,
    });
    expect(getInstallId).toHaveBeenCalledOnce();
    expect(requestMicrophonePermission).toHaveBeenCalledOnce();
    expect(statuses).toEqual([
      "checking_microphone",
      "checking_device",
      "ready",
    ]);
  });

  it("reloads a reset identity without repeating a ready access check", async () => {
    const getInstallId = vi.fn()
      .mockResolvedValueOnce("install_1")
      .mockResolvedValueOnce("install_2");
    const requestMicrophonePermission = vi.fn(async () => true);
    const preparation = createSessionPreparation({
      getInstallId,
      onStatusChange: vi.fn(),
      requestMicrophonePermission,
    });

    await preparation.prepare();
    preparation.invalidateIdentity();
    const refreshed = await preparation.prepare();

    expect(refreshed.app_install_id).toBe("install_2");
    expect(getInstallId).toHaveBeenCalledTimes(2);
    expect(requestMicrophonePermission).toHaveBeenCalledOnce();
  });

  it("exposes denied recording access without skipping the identity warmup", async () => {
    const statuses: string[] = [];
    const preparation = createSessionPreparation({
      getInstallId: vi.fn(async () => "install_1"),
      onStatusChange: (status) => statuses.push(status),
      requestMicrophonePermission: vi.fn(async () => false),
    });

    await expect(preparation.prepare()).resolves.toMatchObject({
      app_install_id: "install_1",
      microphone_granted: false,
    });
    expect(statuses.at(-1)).toBe("microphone_denied");
  });

  it("retries denied recording access without reloading a ready identity", async () => {
    const getInstallId = vi.fn(async () => "install_1");
    const requestMicrophonePermission = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const preparation = createSessionPreparation({
      getInstallId,
      onStatusChange: vi.fn(),
      requestMicrophonePermission,
    });

    expect((await preparation.prepare()).microphone_granted).toBe(false);
    expect((await preparation.prepare()).microphone_granted).toBe(true);
    expect(requestMicrophonePermission).toHaveBeenCalledTimes(2);
    expect(getInstallId).toHaveBeenCalledOnce();
  });

  it("retries a failed identity check without repeating a ready access check", async () => {
    const getInstallId = vi.fn()
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValueOnce("install_1");
    const requestMicrophonePermission = vi.fn(async () => true);
    const preparation = createSessionPreparation({
      getInstallId,
      onStatusChange: vi.fn(),
      requestMicrophonePermission,
    });

    expect((await preparation.prepare()).app_install_id).toBeNull();
    expect((await preparation.prepare()).app_install_id).toBe("install_1");
    expect(getInstallId).toHaveBeenCalledTimes(2);
    expect(requestMicrophonePermission).toHaveBeenCalledOnce();
  });
});
