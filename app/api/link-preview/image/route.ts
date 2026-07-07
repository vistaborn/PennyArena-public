import { NextRequest, NextResponse } from "next/server";
import { isSafePreviewUrl } from "@/lib/fetch-link-preview";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url || !isSafePreviewUrl(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PennyArena/1.0)" },
      redirect: "follow",
    });

    if (!res.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
