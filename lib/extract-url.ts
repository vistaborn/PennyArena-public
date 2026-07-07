const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.replace(/[.,;:!?)]+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function extractFirstHttpUrl(
  ...chunks: (string | undefined | null)[]
): string | null {
  for (const chunk of chunks) {
    if (!chunk) continue;
    const matches = chunk.match(URL_RE);
    if (!matches) continue;
    for (const match of matches) {
      const url = normalizeUrl(match);
      if (url) return url;
    }
  }
  return null;
}
