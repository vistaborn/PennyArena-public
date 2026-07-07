import { NextRequest, NextResponse } from "next/server";
import { getProfileByUsernameForRequest } from "@/lib/resolve-profile";
import { publicProfile, syncUsernameIndexFromContent } from "@/lib/profile-store";
import { isOfficialUsername, OFFICIAL_AVATAR_URL, OFFICIAL_BIO } from "@/lib/official-account";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  await syncUsernameIndexFromContent();
  const profile = await getProfileByUsernameForRequest(req, u);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const official = isOfficialUsername(profile.username);
  const avatarDataUrl = official ? OFFICIAL_AVATAR_URL : profile.avatarDataUrl;
  const bio = official ? OFFICIAL_BIO : profile.bio;
  return NextResponse.json({
    profile: {
      ...publicProfile(profile),
      avatarDataUrl,
      bio,
      walletAddress: profile.walletAddress,
    },
  });
}
