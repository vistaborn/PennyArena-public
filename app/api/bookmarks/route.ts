import { NextRequest, NextResponse } from "next/server";
import { getContent } from "@/lib/content-store";
import { isBookmarked, listBookmarks, toggleBookmark, addBookmark } from "@/lib/bookmark-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { getSessionFromRequest } from "@/lib/security/session";
import { parseAddress } from "@/lib/security/validation";

export async function GET(req: NextRequest) {
  const address = parseAddress(req.nextUrl.searchParams.get("address") ?? "");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const contentId = req.nextUrl.searchParams.get("contentId");
  if (contentId) {
    const bookmarked = await isBookmarked(address, contentId);
    return NextResponse.json({ bookmarked });
  }

  const session = getSessionFromRequest(req);
  if (!session || session.address !== address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookmarks = await listBookmarks(address);
  const items = await Promise.all(
    bookmarks.map(async (b) => {
      const item = await getContent(b.contentId);
      return item ? { bookmarkedAt: b.createdAt, item } : null;
    }),
  );

  return NextResponse.json({
    items: items.filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const contentId = typeof body.contentId === "string" ? body.contentId : null;

  if (!address || !contentId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const content = await getContent(contentId);
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result =
    body.action === "add"
      ? await addBookmark(address, contentId)
      : await toggleBookmark(address, contentId);
  return NextResponse.json(result);
}
