import { NextRequest, NextResponse } from "next/server";
import { createComment, listCommentsByDuel } from "@/lib/comment-store";
import { getProfile } from "@/lib/profile-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateText } from "@/lib/security/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comments = await listCommentsByDuel(id);
  const enriched = await Promise.all(
    comments.map(async (c) => {
      const profile = await getProfile(c.authorAddress);
      return { ...c, authorAvatar: profile?.avatarDataUrl ?? null };
    }),
  );
  return NextResponse.json({ comments: enriched });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const address = parseAddress(body.address);
  const text = validateText(body.body, 500);
  if (!address || !text) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const profile = await resolveProfile(req, address);
  if (!profile?.username) {
    return NextResponse.json({ error: "Profile required" }, { status: 400 });
  }

  const comment = await createComment({
    duelId: id,
    authorAddress: address,
    authorUsername: profile.username,
    body: text,
  });
  return NextResponse.json({
    comment: { ...comment, authorAvatar: profile.avatarDataUrl },
  });
}
