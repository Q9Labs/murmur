export type InterpreterTargetAction =
  | {
      action: "commit";
      translated_caption: string;
    }
  | {
      action: "wait";
      reason: string;
    }
  | {
      action: "pending";
    };

export type PreviewTargetAction =
  | {
      action: "commit";
      translated_caption: string;
    }
  | {
      action: "wait";
      reason: string;
    }
  | {
      action: "pending";
    };

type FinalTargetAction =
  | {
      action: "commit";
      translated_caption: string;
    }
  | {
      action: "wait";
      reason: string;
    };

function makeWaitTargetAction(raw: string, prefix: RegExp): { action: "wait"; reason: string } {
  return {
    action: "wait",
    reason: raw.replace(prefix, "").trim().slice(0, 120) || "needs_more_context",
  };
}

function parseCommitTargetAction(
  raw: string,
  pattern: RegExp = /^COMMIT\s*(?::|\n)\s*([\s\S]*)$/i,
): { action: "commit"; translated_caption: string } | null {
  const match = raw.match(pattern);
  return match
    ? {
        action: "commit",
        translated_caption: match[1] ?? "",
      }
    : null;
}

function finalizeTargetAction<T extends FinalTargetAction | { action: "pending" }>(
  parsed: T,
  raw: string,
): Exclude<T, { action: "pending" }> | { action: "commit"; translated_caption: string } {
  if (parsed.action === "commit") {
    return {
      action: "commit",
      translated_caption: parsed.translated_caption.trim(),
    } as Exclude<T, { action: "pending" }>;
  }
  if (parsed.action === "wait") {
    return parsed as Exclude<T, { action: "pending" }>;
  }
  return {
    action: "commit",
    translated_caption: raw.trim(),
  };
}

export function parseStreamingPreviewTargetAction(raw: string): PreviewTargetAction {
  const withoutLeadingSpace = raw.replace(/^\s+/, "");
  if (!withoutLeadingSpace) {
    return { action: "pending" };
  }
  const upper = withoutLeadingSpace.toUpperCase();
  if (upper.length < 1) {
    return { action: "pending" };
  }
  if (/^WAIT(?:\s|:|$)/i.test(withoutLeadingSpace)) {
    return makeWaitTargetAction(withoutLeadingSpace, /^WAIT\s*:?\s*/i);
  }
  if (/^W(?:\s|:|$)/i.test(withoutLeadingSpace)) {
    return makeWaitTargetAction(withoutLeadingSpace, /^W\s*:?\s*/i);
  }
  if (upper.length < "COMMIT".length && "COMMIT".startsWith(upper)) {
    return { action: "pending" };
  }
  const commitWordAction = parseCommitTargetAction(withoutLeadingSpace);
  if (commitWordAction) {
    return commitWordAction;
  }
  const commitLetterAction = parseCommitTargetAction(withoutLeadingSpace, /^C\s*(?::|\n|\s)\s*([\s\S]*)$/i);
  if (commitLetterAction) {
    return commitLetterAction;
  }
  if (withoutLeadingSpace.trim().toUpperCase() === "C") {
    return { action: "commit", translated_caption: "" };
  }
  if (withoutLeadingSpace.length <= 2) {
    return { action: "pending" };
  }
  return {
    action: "commit",
    translated_caption: raw,
  };
}

export function parsePreviewTargetAction(raw: string): Exclude<PreviewTargetAction, { action: "pending" }> {
  if (raw.trim().toUpperCase() === "C") {
    return {
      action: "commit",
      translated_caption: "",
    };
  }
  return finalizeTargetAction(parseStreamingPreviewTargetAction(raw), raw);
}

export function parseStreamingInterpreterTargetAction(raw: string): InterpreterTargetAction {
  const withoutLeadingSpace = raw.replace(/^\s+/, "");
  const upper = withoutLeadingSpace.toUpperCase();
  if (!withoutLeadingSpace) {
    return { action: "pending" };
  }
  if (upper.length < "WAIT".length && "WAIT".startsWith(upper)) {
    return { action: "pending" };
  }
  if (/^WAIT(?:\s|:|$)/i.test(withoutLeadingSpace)) {
    return makeWaitTargetAction(withoutLeadingSpace, /^WAIT\s*:?\s*/i);
  }
  if (upper.length < "COMMIT".length && "COMMIT".startsWith(upper)) {
    return { action: "pending" };
  }
  const commitAction = parseCommitTargetAction(withoutLeadingSpace);
  if (commitAction) {
    return commitAction;
  }
  if (withoutLeadingSpace.length <= "COMMIT\n".length) {
    return { action: "pending" };
  }
  return {
    action: "commit",
    translated_caption: raw,
  };
}

export function parseInterpreterTargetAction(raw: string): Exclude<InterpreterTargetAction, { action: "pending" }> {
  return finalizeTargetAction(parseStreamingInterpreterTargetAction(raw), raw);
}
