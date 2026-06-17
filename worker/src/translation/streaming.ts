import {
  defaultTranslationModelRoute,
  isGroqPreviewGemmaRoute,
} from "../../../lib/translationModelRoutes";
import type {
  TranslationModelRoute,
  TranslationRequest,
} from "../../../lib/transport/types";
import type { Env } from "../env";
import {
  send,
  type WorkerWebSocket,
} from "../http/response";
import { logWorkerEvent } from "../privacy";
import {
  buildGroqChatPayload,
  buildGroqPreviewChatPayload,
} from "../providers/groq";
import {
  getGroqApiKey,
  getOpenRouterApiKey,
} from "../providers/credentials";
import {
  buildOpenRouterChatPayload,
  selectOpenRouterModel,
} from "../providers/openrouter";
import { readProviderChatCompletionStream } from "../providers/chatCompletionStream";
import { mergeProviderMetadata } from "../providers/streamParsing";
import type {
  ChatCompletionPayload,
  TranslationProviderMetadata,
} from "../providers/types";
import { validateTranslatedCaption } from "./errors";
import {
  shouldUseTargetActionProtocol,
} from "./prompts";
import {
  parseInterpreterTargetAction,
  parsePreviewTargetAction,
  parseStreamingInterpreterTargetAction,
  parseStreamingPreviewTargetAction,
} from "./targetAction";

export async function streamProviderTranslation(
  request: TranslationRequest,
  translationRequestId: string,
  socket: WorkerWebSocket,
  env: Env,
  signal: AbortSignal,
  nextServerEventSeq: () => number,
): Promise<void> {
  if (isGroqPreviewGemmaRoute(request.translation_model_route)) {
    await streamGroqPreviewGemmaTranslation(
      request,
      translationRequestId,
      socket,
      env,
      signal,
      nextServerEventSeq,
    );
    return;
  }

  const route = buildTranslationProviderRoute(request, env);
  if (!route.api_key) {
    throw new Error(route.missing_api_key_error);
  }

  const timeoutMs = Number(env.OPENROUTER_TIMEOUT_MS ?? "12000");
  let translatedCaption = "";
  let firstDeltaLogged = false;
  let partialSeq = 0;
  let rawActionOutput = "";
  const useTargetActionProtocol = shouldUseTargetActionProtocol(request);
  const providerMetadata: TranslationProviderMetadata = { ...route.provider_metadata };
  if (useTargetActionProtocol) {
    providerMetadata.action_protocol = "interpreter_v1";
  }
  if (request.source_status) {
    providerMetadata.source_status = request.source_status;
  }

  const emitTranslationDelta = (nextDraftText: string, deltaFallback: string): void => {
    if (nextDraftText === translatedCaption) {
      return;
    }
    const delta = nextDraftText.startsWith(translatedCaption)
      ? nextDraftText.slice(translatedCaption.length)
      : deltaFallback;
    translatedCaption = nextDraftText;
    if (!firstDeltaLogged) {
      firstDeltaLogged = true;
      logWorkerEvent({
        event: "translation_first_delta",
        app_session_id: request.app_session_id,
        delta_chars: delta.length,
        span_id: request.span_id,
        translation_request_id: translationRequestId,
        translation_route: route.id,
        upstream_model: providerMetadata.upstream_model,
        upstream_provider: providerMetadata.upstream_provider,
        at_ms: Date.now(),
      });
    }
    partialSeq += 1;
    sendTranslationDelta(socket, request, translationRequestId, translatedCaption, delta, partialSeq, nextServerEventSeq);
  };

  const result = await readProviderChatCompletionStream({
    api_key: route.api_key,
    endpoint: route.endpoint,
    error_prefix: route.error_prefix,
    extra_headers: route.extra_headers,
    onDelta: (delta, metadata) => {
      mergeProviderMetadata(providerMetadata, metadata);
      if (useTargetActionProtocol) {
        rawActionOutput += delta;
        const action = parseStreamingInterpreterTargetAction(rawActionOutput);
        if (action.action === "commit") {
          providerMetadata.target_action = "commit";
          emitTranslationDelta(action.translated_caption, delta);
        } else if (action.action === "wait") {
          providerMetadata.target_action = "wait";
        }
        return;
      }
      emitTranslationDelta(`${translatedCaption}${delta}`, delta);
    },
    payload: route.payload,
    signal,
    timeout_ms: timeoutMs,
  });
  mergeProviderMetadata(providerMetadata, result.provider_metadata);

  if (useTargetActionProtocol) {
    const action = parseInterpreterTargetAction(rawActionOutput);
    providerMetadata.target_action = action.action;
    if (action.action === "wait") {
      if (request.source_status === "final") {
        throw new Error(`${route.error_prefix}_wait_for_final_source`);
      }
      logTranslationWait(request, translationRequestId, route.id);
      sendWait(socket, request, translationRequestId, action.reason, nextServerEventSeq());
      return;
    }
    emitTranslationDelta(action.translated_caption, action.translated_caption);
  }

  const finalCaption = validateTranslatedCaption(request, translatedCaption || result.text, route.error_prefix);
  logTranslationDone(request, translationRequestId, route.id, finalCaption, providerMetadata);
  sendDone(socket, request, translationRequestId, finalCaption, providerMetadata, nextServerEventSeq());
}

async function streamGroqPreviewGemmaTranslation(
  request: TranslationRequest,
  translationRequestId: string,
  socket: WorkerWebSocket,
  env: Env,
  signal: AbortSignal,
  nextServerEventSeq: () => number,
): Promise<void> {
  const groqApiKey = getGroqApiKey(env);
  if (!groqApiKey) {
    throw new Error("missing_groq_api_key");
  }
  const openRouterApiKey = getOpenRouterApiKey(env);
  if (!openRouterApiKey) {
    throw new Error("missing_openrouter_api_key");
  }

  const timeoutMs = Number(env.OPENROUTER_TIMEOUT_MS ?? "12000");
  let clientDraftText = "";
  let partialSeq = 0;
  let firstDeltaLogged = false;
  const emitClientDraft = (nextDraftText: string, deltaFallback: string, phase: "final" | "preview"): void => {
    if (nextDraftText === clientDraftText) {
      return;
    }
    const delta = nextDraftText.startsWith(clientDraftText)
      ? nextDraftText.slice(clientDraftText.length)
      : deltaFallback;
    clientDraftText = nextDraftText;
    if (!firstDeltaLogged) {
      firstDeltaLogged = true;
      logWorkerEvent({
        event: "translation_first_delta",
        app_session_id: request.app_session_id,
        delta_chars: delta.length,
        span_id: request.span_id,
        translation_request_id: translationRequestId,
        translation_route: request.translation_model_route ?? defaultTranslationModelRoute,
        upstream_model: phase === "preview" ? "openai/gpt-oss-20b" : selectOpenRouterModel(request, env),
        upstream_provider: phase === "preview" ? "groq" : "openrouter",
        at_ms: Date.now(),
      });
    }
    partialSeq += 1;
    sendTranslationDelta(socket, request, translationRequestId, clientDraftText, delta, partialSeq, nextServerEventSeq);
  };

  let rawPreviewOutput = "";
  let previewTargetAction: "commit" | "wait" | undefined;
  const previewMetadata: TranslationProviderMetadata = {
    model: "openai/gpt-oss-20b",
    provider: "groq",
    reasoning_effort: "low",
    route_id: request.translation_model_route,
    source_status: request.source_status,
  };
  await readProviderChatCompletionStream({
    api_key: groqApiKey,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    error_prefix: "groq",
    extra_headers: {},
    onDelta: (delta, metadata) => {
      mergeProviderMetadata(previewMetadata, metadata);
      rawPreviewOutput += delta;
      const action = parseStreamingPreviewTargetAction(rawPreviewOutput);
      if (action.action === "wait") {
        previewTargetAction = "wait";
        return;
      }
      if (action.action === "commit") {
        previewTargetAction = "commit";
        if (action.translated_caption.trim()) {
          emitClientDraft(action.translated_caption, delta, "preview");
        }
      }
    },
    payload: buildGroqPreviewChatPayload(request),
    signal,
    timeout_ms: timeoutMs,
  });

  const previewAction = parsePreviewTargetAction(rawPreviewOutput);
  previewTargetAction = previewAction.action;
  if (previewAction.action === "wait" && request.source_status !== "final") {
    logTranslationWait(
      request,
      translationRequestId,
      request.translation_model_route ?? defaultTranslationModelRoute,
    );
    sendWait(socket, request, translationRequestId, previewAction.reason, nextServerEventSeq());
    return;
  }
  if (previewAction.action === "commit" && previewAction.translated_caption.trim()) {
    emitClientDraft(previewAction.translated_caption, previewAction.translated_caption, "preview");
  }

  const finalRequest: TranslationRequest = {
    ...request,
    translation_model_route: "openrouter_gemma_deepinfra",
    translation_mode: "phrase",
  };
  const finalModel = selectOpenRouterModel(finalRequest, env);
  const providerMetadata: TranslationProviderMetadata = {
    experiment: "groq_preview_gemma",
    final_model: finalModel,
    final_provider: "openrouter",
    model: "groq-preview-gemma-final",
    preview_model: "openai/gpt-oss-20b",
    preview_provider: "groq",
    preview_target_action: previewTargetAction,
    provider: "mixed",
    route_id: request.translation_model_route,
    source_status: request.source_status,
    target_action: previewAction.action === "wait" ? "commit" : previewAction.action,
  };
  let finalDraftText = "";
  const finalResult = await readProviderChatCompletionStream({
    api_key: openRouterApiKey,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    error_prefix: "openrouter",
    extra_headers: {
      "HTTP-Referer": env.OPENROUTER_SITE_URL ?? "https://murmur.q9labs.ai",
      "X-Title": env.OPENROUTER_APP_NAME ?? "Murmur",
    },
    onDelta: (delta, metadata) => {
      mergeProviderMetadata(providerMetadata, metadata);
      finalDraftText += delta;
      emitClientDraft(finalDraftText, delta, "final");
    },
    payload: buildOpenRouterChatPayload(finalRequest, env),
    signal,
    timeout_ms: timeoutMs,
  });

  const finalCaption = validateTranslatedCaption(finalRequest, finalResult.text, "openrouter");
  logTranslationDone(
    request,
    translationRequestId,
    request.translation_model_route ?? defaultTranslationModelRoute,
    finalCaption,
    providerMetadata,
  );
  sendDone(socket, request, translationRequestId, finalCaption, providerMetadata, nextServerEventSeq());
}

function logTranslationWait(
  request: TranslationRequest,
  translationRequestId: string,
  translationRoute: string,
): void {
  logWorkerEvent({
    event: "translation_wait",
    app_session_id: request.app_session_id,
    span_id: request.span_id,
    translation_request_id: translationRequestId,
    translation_route: translationRoute,
    at_ms: Date.now(),
  });
}

function logTranslationDone(
  request: TranslationRequest,
  translationRequestId: string,
  translationRoute: string,
  finalCaption: string,
  providerMetadata: TranslationProviderMetadata,
): void {
  logWorkerEvent({
    event: "translation_done",
    app_session_id: request.app_session_id,
    output_chars: finalCaption.length,
    span_id: request.span_id,
    translation_request_id: translationRequestId,
    translation_route: translationRoute,
    upstream_model: providerMetadata.upstream_model,
    upstream_provider: providerMetadata.upstream_provider,
    at_ms: Date.now(),
  });
}

function sendTranslationDelta(
  socket: WorkerWebSocket,
  request: TranslationRequest,
  translationRequestId: string,
  draftText: string,
  delta: string,
  partialSeq: number,
  nextServerEventSeq: () => number,
): void {
  send(socket, {
    app_session_id: request.app_session_id,
    client_request_id: request.client_request_id,
    connection_id: request.connection_id,
    kind: "translation_delta",
    session_epoch: request.session_epoch,
    span_id: request.span_id,
    revision: request.revision,
    server_event_seq: nextServerEventSeq(),
    partial_seq: partialSeq,
    translation_request_id: translationRequestId,
    draft_text: draftText,
    delta,
  });
}

type TranslationProviderRoute = {
  api_key: string | undefined;
  endpoint: string;
  error_prefix: "groq" | "openrouter";
  extra_headers: Record<string, string>;
  id: TranslationModelRoute;
  missing_api_key_error: string;
  payload: ChatCompletionPayload;
  provider_metadata: TranslationProviderMetadata;
};

function buildTranslationProviderRoute(request: TranslationRequest, env: Env): TranslationProviderRoute {
  const routeId = request.translation_model_route ?? defaultTranslationModelRoute;
  if (routeId === "groq_gpt_oss_120b_low") {
    return {
      api_key: getGroqApiKey(env),
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      error_prefix: "groq",
      extra_headers: {},
      id: routeId,
      missing_api_key_error: "missing_groq_api_key",
      payload: buildGroqChatPayload(request),
      provider_metadata: {
        model: "openai/gpt-oss-120b",
        provider: "groq",
        reasoning_effort: "low",
        route_id: routeId,
      },
    };
  }

  return {
    api_key: getOpenRouterApiKey(env),
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    error_prefix: "openrouter",
    extra_headers: {
      "HTTP-Referer": env.OPENROUTER_SITE_URL ?? "https://murmur.q9labs.ai",
      "X-Title": env.OPENROUTER_APP_NAME ?? "Murmur",
    },
    id: routeId,
    missing_api_key_error: "missing_openrouter_api_key",
    payload: buildOpenRouterChatPayload(request, env),
    provider_metadata: {
      model: selectOpenRouterModel(request, env),
      provider: "openrouter",
      route_id: routeId,
    },
  };
}

function sendDone(
  socket: WorkerWebSocket,
  request: TranslationRequest,
  translationRequestId: string,
  translatedCaption: string,
  providerMetadata: TranslationProviderMetadata = {
    model: "google/gemma-4-26b-a4b-it",
    provider: "openrouter",
  },
  serverEventSeq = 0,
): void {
  send(socket, {
    app_session_id: request.app_session_id,
    client_request_id: request.client_request_id,
    connection_id: request.connection_id,
    kind: "translation_done",
    session_epoch: request.session_epoch,
    span_id: request.span_id,
    revision: request.revision,
    server_event_seq: serverEventSeq,
    translation_request_id: translationRequestId,
    translated_caption: translatedCaption,
    provider_metadata: providerMetadata,
  });
}

function sendWait(
  socket: WorkerWebSocket,
  request: TranslationRequest,
  translationRequestId: string,
  reason: string,
  serverEventSeq = 0,
): void {
  send(socket, {
    app_session_id: request.app_session_id,
    client_request_id: request.client_request_id,
    connection_id: request.connection_id,
    kind: "translation_wait",
    session_epoch: request.session_epoch,
    span_id: request.span_id,
    revision: request.revision,
    reason,
    server_event_seq: serverEventSeq,
    translation_request_id: translationRequestId,
  });
}
