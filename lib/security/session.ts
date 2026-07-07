import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "penny_auth";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;

type SessionPayload = {
  address: string;
  sessionId: string;
  username?: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.PENNY_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PENNY_SESSION_SECRET must be set in production (min 32 chars)");
  }
  return "penny-dev-session-secret-change-me-32ch";
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(
  address: string,
  sessionId: string,
  username?: string,
): string {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    sessionId,
    ...(username ? { username: username.toLowerCase() } : {}),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.address || !payload.sessionId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { ...payload, address: payload.address.toLowerCase() };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(
  res: NextResponse,
  address: string,
  sessionId: string,
  username?: string,
) {
  res.cookies.set(SESSION_COOKIE, createSessionToken(address, sessionId, username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function requireAddressSession(
  req: NextRequest,
  address: string,
): { ok: true; session: SessionPayload } | { ok: false; status: 401 | 403 } {
  const session = getSessionFromRequest(req);
  if (!session) return { ok: false, status: 401 };
  if (session.address !== address.toLowerCase()) return { ok: false, status: 403 };
  return { ok: true, session };
}

export function assertSameOrigin(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "none") return true;

  return false;
}

export function newSessionId(): string {
  return randomBytes(16).toString("hex");
}
