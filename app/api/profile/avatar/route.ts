import { NextRequest, NextResponse } from "next/server";
import { getProfileByUsername } from "@/lib/profile-store";
import { isOfficialUsername, OFFICIAL_AVATAR_URL } from "@/lib/official-account";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  if (isOfficialUsername(u)) {
    return NextResponse.json({ avatarDataUrl: OFFICIAL_AVATAR_URL });
  }
  const profile = await getProfileByUsername(u);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ avatarDataUrl: profile.avatarDataUrl });
}
