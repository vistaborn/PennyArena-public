import { NextRequest, NextResponse } from "next/server";
import {
  requestEmailVerification,
  verifyEmailCode,
  ownProfile,
} from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateEmail } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  if (body.action === "verify") {
    const profile = await verifyEmailCode(address, body.code ?? "");
    if (!profile) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    return NextResponse.json({ profile: ownProfile(profile) });
  }

  const email = validateEmail(body.email);
  if (!email) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const result = await requestEmailVerification(address, email);
  if (!result) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({
    profile: ownProfile(result.profile),
    message: "Verification code sent",
  });
}
