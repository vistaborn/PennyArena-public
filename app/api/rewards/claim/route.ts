import { NextRequest, NextResponse } from "next/server";
import { addPendingWinnings, claimPendingWinnings } from "@/lib/profile-store";
import { sendTreasuryUsdc, hasTreasuryPayout } from "@/lib/treasury-payout";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const amountUsdc =
    typeof body.amountUsdc === "number" && body.amountUsdc > 0 ? body.amountUsdc : undefined;

  const amount = await claimPendingWinnings(address, amountUsdc);
  if (amount <= 0) {
    return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
  }

  if (hasTreasuryPayout()) {
    try {
      const txHash = await sendTreasuryUsdc(address, amount);
      return NextResponse.json({ ok: true, amountUsdc: amount, txHash, onChain: true });
    } catch (e) {
      await addPendingWinnings(address, amount);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "On-chain payout failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, amountUsdc: amount, onChain: false });
}
