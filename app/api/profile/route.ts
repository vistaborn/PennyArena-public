import { NextRequest, NextResponse } from "next/server";
import { updateProfile, ownProfile, publicProfile, getProfile } from "@/lib/profile-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateBio, validateAvatarDataUrl } from "@/lib/security/validation";
import { getSessionFromRequest } from "@/lib/security/session";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
  const parsed = parseAddress(address);
  if (!parsed) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const session = getSessionFromRequest(req);
  const profile =
    session?.address === parsed
      ? await resolveProfile(req, parsed)
      : await getProfile(parsed);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payload =
    session?.address === parsed ? ownProfile(profile) : publicProfile(profile);
  return NextResponse.json({ profile: payload });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request too large — use a smaller avatar image" },
      { status: 413 },
    );
  }
  const address = parseAddress(body.address);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const profile = await updateProfile(address, {
    bio: body.bio !== undefined ? validateBio(body.bio) ?? undefined : undefined,
    avatarDataUrl:
      body.avatarDataUrl !== undefined
        ? validateAvatarDataUrl(body.avatarDataUrl)
        : undefined,
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile: ownProfile(profile) });
}
