import { NextRequest, NextResponse } from "next/server";
import { createComment, listComments } from "@/lib/comment-store";
import { getContent } from "@/lib/content-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateText } from "@/lib/security/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comments = await listComments(id);
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const address = parseAddress(body.address);
  const text = validateText(body.body, 2000);

  if (!address || !text) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const profile = await resolveProfile(req, address);
  if (!profile?.username) {
    return NextResponse.json({ error: "Username not found" }, { status: 400 });
  }

  const content = await getContent(id);
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await createComment({
    contentId: id,
    authorAddress: address,
    authorUsername: profile.username,
    body: text,
  });

  return NextResponse.json({ comment });
}
