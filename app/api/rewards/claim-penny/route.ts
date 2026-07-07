import { NextRequest, NextResponse } from "next/server";
import { claimPennyLaunch } from "@/lib/profile-store";
import { getTreasuryAddress } from "@/lib/pricing";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  try {
    const amountUsdc = await claimPennyLaunch(address);
    const poolAddress = getTreasuryAddress();
    return NextResponse.json({
      ok: true,
      amountUsdc,
      poolAddress,
      message: `$${amountUsdc} added to your claimable balance`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claim failed" },
      { status: 400 },
    );
  }
}
