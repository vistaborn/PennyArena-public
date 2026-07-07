const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; PennyArena/1.0; +https://pennyarena.local)";

export type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

function youtubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("youtube.com") && !u.hostname.includes("youtu.be")) {
      return null;
    }
    let id: string | null = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1).split("/")[0] || null;
    } else {
      id = u.searchParams.get("v");
    }
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function resolveUrl(base: string, value: string): string | null {
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function isPrivateOrLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".local") || h === "0.0.0.0") return true;
  if (h === "::1" || h === "::" || h === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;

  if (h.includes(":")) {
    if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
    return false;
  }

  const parts = h.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

export function isSafePreviewUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    if (u.username || u.password) return false;
    if (isPrivateOrLocalHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchHtmlWithRedirects(
  startUrl: string,
  maxRedirects = 4,
): Promise<{ html: string; finalUrl: string } | null> {
  let current = startUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    if (!isSafePreviewUrl(current)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        current = resolveUrl(current, location) ?? location;
        continue;
      }
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return null;
      }
      const html = await res.text();
      return { html, finalUrl: current };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const yt = youtubeThumbnail(url);
  if (yt) {
    return {
      url,
      title: null,
      description: null,
      image: yt,
      siteName: "YouTube",
    };
  }

  const fetched = await fetchHtmlWithRedirects(url);
  if (!fetched) {
    return { url, title: null, description: null, image: null, siteName: null };
  }

  try {
    const slice = fetched.html.slice(0, 120_000);

    const title =
      metaContent(slice, "og:title") ??
      metaContent(slice, "twitter:title") ??
      titleTag(slice);
    const description =
      metaContent(slice, "og:description") ??
      metaContent(slice, "twitter:description") ??
      metaContent(slice, "description");
    const imageRaw =
      metaContent(slice, "og:image") ??
      metaContent(slice, "twitter:image") ??
      metaContent(slice, "twitter:image:src");
    const siteName = metaContent(slice, "og:site_name");

    const imageCandidate = imageRaw ? resolveUrl(fetched.finalUrl, imageRaw) : null;
    const image =
      imageCandidate && isSafePreviewUrl(imageCandidate) ? imageCandidate : null;

    return { url, title, description, image, siteName };
  } catch {
    return { url, title: null, description: null, image: null, siteName: null };
  }
}

export function faviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return "https://www.google.com/s2/favicons?domain=example.com&sz=128";
  }
}
