import { NextRequest, NextResponse } from "next/server";
import { getProfile, profileHasSession, touchSession } from "@/lib/profile-store";
import { hasSharedStore } from "@/lib/shared-store";
import {
  assertSameOrigin,
  getSessionFromRequest,
  requireAddressSession,
} from "@/lib/security/session";

/** Cookie session must match the requested wallet (read-only duel/profile routes). */
export function requireSessionForAddress(
  req: NextRequest,
  address: string,
): NextResponse | null {
  const auth = requireAddressSession(req, address);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  return null;
}

export async function requireWalletAuth(
  req: NextRequest,
  address: string,
): Promise<NextResponse | null> {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const auth = requireAddressSession(req, address);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }
  if (!hasSharedStore()) {
    return null;
  }

  let profile = await getProfile(address);
  if (!profile) {
    profile = await touchSession(
      address,
      auth.session.sessionId,
      req.headers.get("user-agent") ?? "unknown",
    );
  } else if (!profileHasSession(profile, auth.session.sessionId)) {
    profile = await touchSession(
      address,
      auth.session.sessionId,
      req.headers.get("user-agent") ?? "unknown",
    );
  }

  if (!profileHasSession(profile, auth.session.sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  return null;
}

export function getOptionalSessionAddress(req: NextRequest): string | null {
  return getSessionFromRequest(req)?.address ?? null;
}
