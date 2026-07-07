import { NextRequest, NextResponse } from "next/server";
import {
  getChallengesByAuthor,
  getPendingDuelsForAuthor,
} from "@/lib/duel-store";
import { requireSessionForAddress } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function GET(req: NextRequest) {
  const address = parseAddress(req.nextUrl.searchParams.get("address"));
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }
  const authErr = requireSessionForAddress(req, address);
  if (authErr) return authErr;

  const [incoming, outgoing] = await Promise.all([
    getPendingDuelsForAuthor(address),
    getChallengesByAuthor(address),
  ]);

  return NextResponse.json({ incoming, outgoing });
}
