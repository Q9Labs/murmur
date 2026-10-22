// cspell:words avfaudio osstatus
const captureSteps = [
  "session_category", "session_sample_rate", "session_buffer_duration", "session_activation",
  "voice_processing", "hardware_input", "input_format", "install_tap", "engine_start",
] as const;
const captureRoutes = ["none", "built_in", "bluetooth", "wired", "usb", "other"] as const;
const captureErrorDomains = ["murmur", "avfaudio", "osstatus", "other"] as const;

export type CaptureFailure = {
  step: (typeof captureSteps)[number];
  hardware_rate: number;
  hardware_channels: number;
  output_rate: number;
  output_channels: number;
  route: (typeof captureRoutes)[number];
  voice_processing: boolean;
  error_domain: (typeof captureErrorDomains)[number];
  error_code: number;
};

// getAudioState is the native dictionary boundary, not an Error.userInfo field.
export function parseCaptureFailure(state: unknown): CaptureFailure | undefined {
  if (!state || typeof state !== "object" || !("capture_failure" in state)) return undefined;
  const value = state.capture_failure;
  if (!value || typeof value !== "object") return undefined;
  if (!hasCaptureFields(value)) return undefined;
  const { step, hardware_rate, hardware_channels, output_rate, output_channels,
    route, voice_processing, error_domain, error_code } = value;
  if (!isMember(step, captureSteps) || !isMember(route, captureRoutes)
    || !isMember(error_domain, captureErrorDomains)) return undefined;
  if (!inRange(hardware_rate, 384_000) || !inRange(output_rate, 384_000)
    || !isChannelCount(hardware_channels) || !isChannelCount(output_channels)
    || typeof voice_processing !== "boolean" || !isErrorCode(error_code)) return undefined;
  return { step, hardware_rate, hardware_channels, output_rate, output_channels,
    route, voice_processing, error_domain, error_code };
}

function inRange(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum;
}

function hasCaptureFields(value: object): value is { [Field in keyof CaptureFailure]: unknown } {
  return "step" in value && "hardware_rate" in value && "hardware_channels" in value
    && "output_rate" in value && "output_channels" in value && "route" in value
    && "voice_processing" in value && "error_domain" in value && "error_code" in value;
}

function isMember<Value extends string>(value: unknown, allowed: readonly Value[]): value is Value {
  return allowed.some((member) => member === value);
}

function isChannelCount(value: unknown): value is number {
  return inRange(value, 64) && Number.isInteger(value);
}

function isErrorCode(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
    && value >= -2_147_483_648 && value <= 2_147_483_647;
}
