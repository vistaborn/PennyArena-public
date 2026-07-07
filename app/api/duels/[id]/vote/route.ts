import { NextRequest, NextResponse } from "next/server";
import { castVote, getDuel, getVotesForDuel } from "@/lib/duel-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, parsePositiveAmount, parseTxHash } from "@/lib/security/validation";
import { verifyPaidAction } from "@/lib/security/paid-action";
import { getTreasuryAddress, VOTE_UNIT_USDC } from "@/lib/pricing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const address = parseAddress(body.address);
  const txHash = parseTxHash(body.txHash);
  const amountUsdc = parsePositiveAmount(body.amountUsdc);
  const sideContentId = typeof body.sideContentId === "string" ? body.sideContentId : null;

  if (!address || !txHash || !sideContentId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (amountUsdc !== VOTE_UNIT_USDC) {
    return NextResponse.json(
      { error: `Vote must be exactly $${VOTE_UNIT_USDC}` },
      { status: 400 },
    );
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const duel = await getDuel(id);
  if (!duel || duel.status !== "active") {
    return NextResponse.json({ error: "Duel not active" }, { status: 400 });
  }

  const treasury = getTreasuryAddress();
  if (!treasury) return NextResponse.json({ error: "Treasury not configured" }, { status: 500 });

  const verified = await verifyPaidAction({
    txHash,
    fromAddress: address,
    toAddress: treasury,
    amountUsdc,
    purpose: `duel-vote:${id}`,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  const vote = await castVote({
    duelId: id,
    voterAddress: address,
    sideContentId,
    amountUsdc,
    txHash,
  });
  if (!vote) {
    return NextResponse.json(
      { error: "Already voted or vote rejected" },
      { status: 400 },
    );
  }

  const votes = await getVotesForDuel(id);
  return NextResponse.json({
    vote,
    weight: 1,
    scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
    scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
  });
}
