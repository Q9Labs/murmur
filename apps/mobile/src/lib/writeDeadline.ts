// Storage writes can hang forever on runtimes missing the platform
// entitlement (e.g. Keychain access without the entitlement on iOS). A write
// that never settles must not leave consent state pending indefinitely — the
// underlying write is left running but the caller fails closed and can retry.
export const SECURE_WRITE_DEADLINE_MS = 8_000;

export function withWriteDeadline<T>(write: Promise<T>, failure: () => Error): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    write.finally(() => clearTimeout(deadline)),
    new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(failure()), SECURE_WRITE_DEADLINE_MS);
    }),
  ]);
}
