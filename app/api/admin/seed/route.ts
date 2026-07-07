import { NextResponse } from "next/server";
import { runOfficialSeed } from "@/lib/seed-official";

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SEED) {
    return false;
  }
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await runOfficialSeed();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 },
    );
  }
}
