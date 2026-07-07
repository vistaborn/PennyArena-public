import { NextRequest, NextResponse } from "next/server";
import { searchContent } from "@/lib/content-store";
import { getProfileByUsername } from "@/lib/profile-store";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const items = await searchContent(q);

  let user = null;
  if (q.startsWith("@")) {
    user = await getProfileByUsername(q.slice(1));
  } else if (q && !q.includes(" ")) {
    user = await getProfileByUsername(q);
  }

  return NextResponse.json({ items, user: user ? { username: user.username, bio: user.bio, stats: user.stats } : null });
}
