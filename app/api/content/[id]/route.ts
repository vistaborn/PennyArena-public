import { NextRequest, NextResponse } from "next/server";
import { deleteContent, getContent } from "@/lib/content-store";
import { findOpenDuelForContent } from "@/lib/duel-store";
import { incrementStat } from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await getContent(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const address = parseAddress(body.address);
  if (!address) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const item = await getContent(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.authorAddress.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const openDuel = await findOpenDuelForContent(id);
  if (openDuel) {
    return NextResponse.json(
      { error: "Cannot delete a post in an open battle" },
      { status: 400 },
    );
  }

  const ok = await deleteContent(id, address);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });

  await incrementStat(address, "posts", -1);
  return NextResponse.json({ ok: true });
}
