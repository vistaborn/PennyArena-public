import { NextRequest, NextResponse } from "next/server";
import { touchSession, syncUsernameIndexFromContent, ownProfile } from "@/lib/profile-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { parseAddress } from "@/lib/security/validation";
import { assertSameOrigin, setSessionCookie } from "@/lib/security/session";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`sessions:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address || typeof body.sessionId !== "string" || body.sessionId.length < 8) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await touchSession(
    address,
    body.sessionId,
    typeof body.userAgent === "string" ? body.userAgent.slice(0, 200) : "unknown",
    typeof body.referralCode === "string" ? body.referralCode : undefined,
  );

  await syncUsernameIndexFromContent();

  const profile = await resolveProfile(req, address);
  if (!profile) {
    return NextResponse.json({ error: "Profile unavailable" }, { status: 500 });
  }

  const res = NextResponse.json({
    profile: ownProfile(profile),
    sessionId: body.sessionId,
  });
  setSessionCookie(res, address, body.sessionId, profile.username);
  return res;
}
