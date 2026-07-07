import { NextRequest, NextResponse } from "next/server";
import { setUsername, ownProfile } from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateUsername } from "@/lib/security/validation";
import { getSessionFromRequest, setSessionCookie } from "@/lib/security/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const username = validateUsername(body.username);
  if (!address || !username) {
    return NextResponse.json({ error: "Invalid address or username" }, { status: 400 });
  }
  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const result = await setUsername(address, username);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  const session = getSessionFromRequest(req);
  const res = NextResponse.json({ profile: ownProfile(result.profile) });
  if (session) {
    setSessionCookie(res, address, session.sessionId, result.profile.username);
  }
  return res;
}
