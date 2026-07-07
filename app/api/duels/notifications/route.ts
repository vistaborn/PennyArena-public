import { NextRequest, NextResponse } from "next/server";
import { getContent } from "@/lib/content-store";
import { listAllDuels, getVotesForDuel } from "@/lib/duel-store";
import { getUserDuelOutcome } from "@/lib/duel-payouts";
import { getAcknowledgedDuels } from "@/lib/duel-notifications";
import { requireSessionForAddress } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function GET(req: NextRequest) {
  const address = parseAddress(req.nextUrl.searchParams.get("address") ?? "");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const authErr = requireSessionForAddress(req, address);
  if (authErr) return authErr;

  const viewer = address.toLowerCase();
  const acked = await getAcknowledgedDuels(viewer);
  const all = await listAllDuels();
  const settled = all.filter((d) => d.status === "settled");

  const involved = [];
  for (const duel of settled) {
    const votes = await getVotesForDuel(duel.id);
    const participated =
      duel.authorA === viewer ||
      duel.authorB === viewer ||
      votes.some((v) => v.voterAddress === viewer);
    if (!participated) continue;

    const [contentA, contentB] = await Promise.all([
      getContent(duel.contentAId),
      getContent(duel.contentBId),
    ]);
    const outcome = getUserDuelOutcome(viewer, duel, votes, contentA, contentB);
    involved.push({
      duel,
      contentA,
      contentB,
      votes,
      scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
      scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
      outcome,
      acknowledged: acked.has(duel.id),
    });
  }

  involved.sort(
    (a, b) =>
      new Date(b.duel.settledAt ?? b.duel.createdAt).getTime() -
      new Date(a.duel.settledAt ?? a.duel.createdAt).getTime(),
  );

  const pending = involved.filter((n) => !n.acknowledged);

  return NextResponse.json({ history: involved, pending });
}
