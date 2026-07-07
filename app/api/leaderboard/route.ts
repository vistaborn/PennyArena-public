import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/duel-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getLeaderboard();
  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
