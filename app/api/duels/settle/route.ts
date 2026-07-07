import { NextResponse } from "next/server";
import { settleDueDuels } from "@/lib/duel-store";
import { assertCronOrSameOrigin } from "@/lib/security/paid-action";

export async function POST(req: Request) {
  if (!assertCronOrSameOrigin(req as import("next/server").NextRequest)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const count = await settleDueDuels();
  return NextResponse.json({ settled: count });
}
