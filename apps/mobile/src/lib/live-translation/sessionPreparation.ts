export type SessionPreparationStatus =
  | "idle"
  | "checking_microphone"
  | "checking_device"
  | "ready"
  | "microphone_denied"
  | "failed";

export type SessionPreparationResult = {
  app_install_id: string | null;
  identity_ready_at_ms: number | null;
  microphone_granted: boolean;
  microphone_ready_at_ms: number;
};

export type SessionPreparation = {
  dispose: () => void;
  invalidateIdentity: () => void;
  prepare: () => Promise<SessionPreparationResult>;
};

export function createSessionPreparation(options: {
  getInstallId: () => Promise<string>;
  now?: () => number;
  onStatusChange: (status: SessionPreparationStatus) => void;
  requestMicrophonePermission: () => Promise<boolean>;
}): SessionPreparation {
  const now = options.now ?? Date.now;
  let active = true;
  let generation = 0;
  let identityPromise: Promise<{
    app_install_id: string | null;
    ready_at_ms: number | null;
  }> | null = null;
  let microphonePromise: Promise<{
    granted: boolean;
    ready_at_ms: number;
  }> | null = null;
  let preparationPromise: Promise<SessionPreparationResult> | null = null;

  function updateStatus(status: SessionPreparationStatus, expectedGeneration: number): void {
    if (active && generation === expectedGeneration) {
      options.onStatusChange(status);
    }
  }

  function getIdentity(): NonNullable<typeof identityPromise> {
    identityPromise ??= Promise.resolve()
      .then(options.getInstallId)
      .then((appInstallId) => ({
        app_install_id: appInstallId,
        ready_at_ms: now(),
      }))
      .catch(() => ({ app_install_id: null, ready_at_ms: null }));
    return identityPromise;
  }

  function getMicrophonePermission(): NonNullable<typeof microphonePromise> {
    microphonePromise ??= Promise.resolve()
      .then(options.requestMicrophonePermission)
      .then((granted) => ({ granted, ready_at_ms: now() }))
      .catch(() => ({ granted: false, ready_at_ms: now() }));
    return microphonePromise;
  }

  function prepare(): Promise<SessionPreparationResult> {
    if (preparationPromise) {
      return preparationPromise;
    }
    const expectedGeneration = generation;
    updateStatus("checking_microphone", expectedGeneration);
    const identity = getIdentity();
    preparationPromise = getMicrophonePermission().then(async (microphone) => {
      updateStatus("checking_device", expectedGeneration);
      const installIdentity = await identity;
      const result = {
        app_install_id: installIdentity.app_install_id,
        identity_ready_at_ms: installIdentity.ready_at_ms,
        microphone_granted: microphone.granted,
        microphone_ready_at_ms: microphone.ready_at_ms,
      };
      updateStatus(
        !result.microphone_granted
          ? "microphone_denied"
          : result.app_install_id
            ? "ready"
            : "failed",
        expectedGeneration,
      );
      if (generation === expectedGeneration && (!result.microphone_granted || !result.app_install_id)) {
        preparationPromise = null;
        if (!result.microphone_granted) {
          microphonePromise = null;
        }
        if (!result.app_install_id) {
          identityPromise = null;
        }
      }
      return result;
    });
    return preparationPromise;
  }

  return {
    dispose(): void {
      active = false;
    },
    invalidateIdentity(): void {
      generation += 1;
      identityPromise = null;
      preparationPromise = null;
      if (active) {
        options.onStatusChange("idle");
      }
    },
    prepare,
  };
}
