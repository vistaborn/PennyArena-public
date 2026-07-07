import { NextRequest, NextResponse } from "next/server";
import {
  fetchLinkPreview,
  faviconUrl,
  isSafePreviewUrl,
} from "@/lib/fetch-link-preview";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!checkRateLimit(`link-preview:${ip}`, 40, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url || !isSafePreviewUrl(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.data);
  }

  const preview = await fetchLinkPreview(url);
  const hostname = new URL(url).hostname;
  const payload = {
    ...preview,
    favicon: faviconUrl(url),
    hostname,
    imageProxy: preview.image
      ? `/api/link-preview/image?url=${encodeURIComponent(preview.image)}`
      : null,
  };

  cache.set(url, { data: payload, expires: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(payload);
}
