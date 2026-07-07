import { NextRequest, NextResponse } from "next/server";
import { acknowledgeDuels } from "@/lib/duel-notifications";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const duelIds = Array.isArray(body.duelIds) ? body.duelIds.filter((x: unknown) => typeof x === "string") : [];
  if (!address || duelIds.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  await acknowledgeDuels(address, duelIds);
  return NextResponse.json({ ok: true });
}
