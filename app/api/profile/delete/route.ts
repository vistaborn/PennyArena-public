import { NextRequest, NextResponse } from "next/server";
import { deleteProfile } from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  await deleteProfile(address);
  return NextResponse.json({ ok: true });
}
