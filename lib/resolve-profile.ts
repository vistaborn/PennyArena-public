import type { NextRequest } from "next/server";
import {
  getProfile,
  getProfileByUsername,
  setUsername,
  touchSession,
  type UserProfile,
} from "@/lib/profile-store";
import { validateUsername } from "@/lib/security/validation";
import { getSessionFromRequest } from "@/lib/security/session";

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

/** Restore profile from session cookie (Vercel serverless). */
export async function resolveProfile(
  req: NextRequest,
  address: string,
): Promise<UserProfile | null> {
  const key = normalizeAddress(address);
  const session = getSessionFromRequest(req);
  const hint =
    session?.address === key ? validateUsername(session.username ?? "") : null;

  let profile = await getProfile(key);

  if (!profile && session?.address === key) {
    profile = await touchSession(
      key,
      session.sessionId,
      req.headers.get("user-agent") ?? "unknown",
    );
  }

  if (hint && (!profile || !profile.username)) {
    const result = await setUsername(key, hint);
    if (result.ok) profile = result.profile;
  }

  return profile;
}

export async function getProfileByUsernameForRequest(
  req: NextRequest,
  username: string,
): Promise<UserProfile | null> {
  const found = await getProfileByUsername(username);
  if (found) return found;

  const session = getSessionFromRequest(req);
  if (
    session?.username &&
    session.username.toLowerCase() === username.toLowerCase()
  ) {
    return resolveProfile(req, session.address);
  }

  return null;
}
