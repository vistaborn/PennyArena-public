import { NextRequest, NextResponse } from "next/server";
import {
  acceptDuel,
  createDuelChallenge,
  declineDuel,
  getActiveDuels,
  getPopularDuels,
  getVotesForDuel,
} from "@/lib/duel-store";
import { getContent } from "@/lib/content-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, parseTxHash } from "@/lib/security/validation";
import { verifyPaidAction } from "@/lib/security/paid-action";
import { DUEL_ENTRY_FEE_USDC, getTreasuryAddress } from "@/lib/pricing";

async function enrichActiveDuels() {
  const active = await getActiveDuels();
  return Promise.all(
    active.map(async (duel) => {
      const [contentA, contentB, votes] = await Promise.all([
        getContent(duel.contentAId),
        getContent(duel.contentBId),
        getVotesForDuel(duel.id),
      ]);
      return {
        duel,
        contentA,
        contentB,
        scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
        scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
      };
    }),
  );
}

export async function GET() {
  const active = await enrichActiveDuels();
  const popular = await getPopularDuels();
  return NextResponse.json({ active, popular });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const txHash = parseTxHash(body.txHash);

  if (body.action === "decline") {
    if (!address || !body.duelId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const authErr = await requireWalletAuth(req, address);
    if (authErr) return authErr;

    const duel = await declineDuel({ duelId: body.duelId, actorAddress: address });
    if (!duel) return NextResponse.json({ error: "Cannot decline duel" }, { status: 400 });
    return NextResponse.json({ duel });
  }

  if (body.action === "accept") {
    if (!address || !txHash || !body.duelId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const authErr = await requireWalletAuth(req, address);
    if (authErr) return authErr;

    const treasury = getTreasuryAddress();
    if (!treasury) return NextResponse.json({ error: "Treasury not configured" }, { status: 500 });

    const verified = await verifyPaidAction({
      txHash,
      fromAddress: address,
      toAddress: treasury,
      amountUsdc: DUEL_ENTRY_FEE_USDC,
      purpose: `duel-accept:${body.duelId}`,
    });
    if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

    const duel = await acceptDuel({
      duelId: body.duelId,
      authorAddress: address,
      entryTxB: txHash,
    });
    if (!duel) return NextResponse.json({ error: "Cannot accept duel" }, { status: 400 });
    return NextResponse.json({ duel });
  }

  if (!address || !txHash || !body.contentAId || !body.contentBId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const a = await getContent(body.contentAId);
  const b = await getContent(body.contentBId);
  if (!a || !b) {
    return NextResponse.json(
      {
        error: "Content not found — ask your opponent to open the app once so their post syncs",
      },
      { status: 404 },
    );
  }
  if (a.authorAddress !== address.toLowerCase()) {
    return NextResponse.json({ error: "You must own content A" }, { status: 403 });
  }

  const treasury = getTreasuryAddress();
  if (!treasury) return NextResponse.json({ error: "Treasury not configured" }, { status: 500 });

  const verified = await verifyPaidAction({
    txHash,
    fromAddress: address,
    toAddress: treasury,
    amountUsdc: DUEL_ENTRY_FEE_USDC,
    purpose: `duel-challenge:${a.id}:${b.id}`,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  try {
    const duel = await createDuelChallenge({
      topicSlug: a.topicSlug,
      contentAId: a.id,
      contentBId: b.id,
      challengerAddress: address,
      entryTxA: txHash,
    });
    return NextResponse.json({ duel });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Challenge failed" },
      { status: 400 },
    );
  }
}
