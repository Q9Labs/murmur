import type { SummaryRequest, TranslationRequest } from "../../../lib/transport/types";

export function buildSystemPrompt(sourceLanguage: string, targetLanguage: string): string {
  return [
    `You are a professional translator from ${sourceLanguage} to ${targetLanguage}.`,
    "Accurately preserve meaning, tone, names, numbers, and cultural nuance.",
    `Produce only the ${targetLanguage} translation. Do not add explanations.`,
  ].join("\n");
}

export function buildInterpreterSystemPrompt(sourceLanguage: string, targetLanguage: string): string {
  return [
    `You are a simultaneous interpreter from ${sourceLanguage} to ${targetLanguage}.`,
    "You receive short source-language prefixes from live speech recognition.",
    "Return exactly one action:",
    "WAIT",
    "or",
    `COMMIT\\n${targetLanguage} translation`,
    "Use WAIT only when the current prefix is too incomplete or ambiguous to translate safely.",
    "If source_status is final, you must COMMIT.",
    "Translate only the current source prefix. Use prior context only for references, tone, names, and terminology.",
    "Do not add explanations, markdown, quotes, labels, or alternatives.",
  ].join("\n");
}

export function buildPreviewGateSystemPrompt(sourceLanguage: string, targetLanguage: string): string {
  return [
    `You are a low-latency simultaneous interpreter from ${sourceLanguage} to ${targetLanguage}.`,
    "Return exactly one action:",
    "W",
    "or",
    `C\\n${targetLanguage} draft translation`,
    "Use W only when the current live prefix is too incomplete or ambiguous to show even as a temporary preview.",
    "If source_status is final, you must return C.",
    "The draft is temporary UI text. Prefer speed and plausible meaning over polished final wording.",
    "Translate only the current source prefix. Use prior context only for references, tone, names, and terminology.",
    "Do not add explanations, markdown, quotes, labels, alternatives, WAIT, or COMMIT.",
  ].join("\n");
}

export function buildUserPrompt(request: TranslationRequest): string {
  return buildContextualUserPrompt(request, {
    currentLabel: "Current span to translate:",
    previousLabel: "Previous stable spans for context only. Do not translate them again:",
  });
}

export function buildInterpreterUserPrompt(request: TranslationRequest): string {
  return buildContextualUserPrompt(request, {
    currentLabel: "Current live source prefix:",
    previousLabel: "Previous committed spans for context only. Do not translate them again:",
    sourceStatus: true,
    trailingInstruction: "Return only WAIT or COMMIT followed by a newline and the target-language translation.",
  });
}

export function buildPreviewGateUserPrompt(request: TranslationRequest): string {
  return buildContextualUserPrompt(request, {
    currentLabel: "Current live source prefix:",
    previousLabel: "Previous committed spans for context only. Do not translate them again:",
    sourceStatus: true,
    trailingInstruction: "Return only W or C followed by a newline and the target-language draft translation.",
  });
}

function formatContextSpans(request: TranslationRequest): string {
  const context = request.context_spans
    .map((span, index) => {
      const translated = span.translated_caption ? `Target: ${span.translated_caption}` : "Target: ";
      return `${index + 1}. Source: ${span.source_caption}\n${translated}`;
    })
    .join("\n\n");
  return context || "(none)";
}

function buildContextualUserPrompt(
  request: TranslationRequest,
  options: {
    currentLabel: string;
    previousLabel: string;
    sourceStatus?: boolean;
    trailingInstruction?: string;
  },
): string {
  const lines = [
    "Untrusted session summary for context only. Do not translate it:",
    request.context_summary?.trim() || "(none)",
    "",
    options.previousLabel,
    formatContextSpans(request),
    "",
  ];
  if (options.sourceStatus) {
    lines.push(`source_status: ${request.source_status ?? "stable"}`, "");
  }
  lines.push(
    options.currentLabel,
    request.source_caption,
  );
  if (options.trailingInstruction) {
    lines.push("", options.trailingInstruction);
  }
  return lines.join("\n");
}

export function shouldUseTargetActionProtocol(request: TranslationRequest): boolean {
  return request.translation_mode === "continuous";
}

export function buildSummaryPrompt(request: SummaryRequest): string {
  const previous = request.previous_summary.text.trim() || "(none)";
  const spans = request.spans_to_summarize
    .map((span, index) => `${index + 1}. Source: ${span.source_caption}\nTarget: ${span.translated_caption}`)
    .join("\n\n");
  return [
    "Previous compact summary:",
    previous,
    "",
    "New committed spans to fold into the summary:",
    spans,
    "",
    "Return only the updated compact summary.",
  ].join("\n");
}
