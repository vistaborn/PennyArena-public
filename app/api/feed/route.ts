import { NextRequest, NextResponse } from "next/server";
import { getPopularContent, getContent } from "@/lib/content-store";
import { getActiveDuels, getVotesForDuel, settleDueDuels } from "@/lib/duel-store";
import { ensureOfficialSeedIfEmpty } from "@/lib/seed-official";

export async function GET(req: NextRequest) {
  await settleDueDuels();
  await ensureOfficialSeedIfEmpty();

  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);

  const popular = await getPopularContent(limit + offset);
  const items = popular.slice(offset, offset + limit);
  const activeDuelsRaw = await getActiveDuels();
  const activeDuels = await Promise.all(
    activeDuelsRaw.map(async (duel) => {
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

  return NextResponse.json({ items, activeDuels });
}
