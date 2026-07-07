import { NextRequest, NextResponse } from "next/server";
import { getDuel, getVotesForDuel } from "@/lib/duel-store";
import { getContent } from "@/lib/content-store";
import { parseAddress } from "@/lib/security/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const duel = await getDuel(id);
  if (!duel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [contentA, contentB, votes] = await Promise.all([
    getContent(duel.contentAId),
    getContent(duel.contentBId),
    getVotesForDuel(id),
  ]);

  const address = parseAddress(req.nextUrl.searchParams.get("address"));
  const myVote = address
    ? votes.find((v) => v.voterAddress === address.toLowerCase()) ?? null
    : null;

  return NextResponse.json({
    duel,
    contentA,
    contentB,
    votes,
    myVote,
    scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
    scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
  });
}
