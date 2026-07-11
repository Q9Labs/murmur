export type ContinuousStableSpan = {
  source_caption: string;
};

export type ContinuousStabilizerOptions = {
  maxChunkSourceChars?: number;
  minChunkSourceChars?: number;
};

const defaultMinChunkSourceChars = 36;
const defaultMaxChunkSourceChars = 140;
const boundaryPattern = /[.!?؟。！？]\s*$/;

export class ContinuousSpanStabilizer {
  private emittedWordCount = 0;
  private readonly maxChunkSourceChars: number;
  private readonly minChunkSourceChars: number;

  constructor(options: ContinuousStabilizerOptions = {}) {
    this.maxChunkSourceChars = options.maxChunkSourceChars ?? defaultMaxChunkSourceChars;
    this.minChunkSourceChars = options.minChunkSourceChars ?? defaultMinChunkSourceChars;
  }

  acceptTranscript(transcript: string, force = false): ContinuousStableSpan[] {
    const words = splitWords(transcript);
    if (words.length <= this.emittedWordCount) {
      return [];
    }

    const spans: ContinuousStableSpan[] = [];
    while (this.emittedWordCount < words.length) {
      const remaining = words.slice(this.emittedWordCount);
      const chunkWordCount = this.selectChunkWordCount(remaining, force);
      if (chunkWordCount === 0) {
        break;
      }
      const chunk = remaining.slice(0, chunkWordCount).join(" ").trim();
      if (!chunk) {
        break;
      }
      spans.push({ source_caption: chunk });
      this.emittedWordCount += chunkWordCount;
    }
    return spans;
  }

  getUnemittedText(transcript: string): string {
    const words = splitWords(transcript);
    if (words.length <= this.emittedWordCount) {
      return "";
    }
    return words.slice(this.emittedWordCount).join(" ").trim();
  }

  reset(): void {
    this.emittedWordCount = 0;
  }

  private selectChunkWordCount(words: string[], force: boolean): number {
    let chars = 0;
    let lastBoundaryIndex = -1;
    let maxIndex = -1;

    for (let index = 0; index < words.length; index += 1) {
      chars += words[index].length + (index === 0 ? 0 : 1);
      if (boundaryPattern.test(words[index])) {
        lastBoundaryIndex = index;
      }
      if (chars >= this.maxChunkSourceChars && maxIndex === -1) {
        maxIndex = index;
      }
      if (lastBoundaryIndex >= 0 && chars >= this.minChunkSourceChars) {
        return lastBoundaryIndex + 1;
      }
    }

    if (maxIndex >= 0) {
      return maxIndex + 1;
    }

    const totalChars = words.join(" ").length;
    if (force && totalChars > 0) {
      return words.length;
    }
    if (totalChars >= this.minChunkSourceChars) {
      return words.length;
    }
    return 0;
  }
}

function splitWords(transcript: string): string[] {
  return transcript.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
}
