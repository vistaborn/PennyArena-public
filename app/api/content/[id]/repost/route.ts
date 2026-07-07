import { NextRequest, NextResponse } from "next/server";
import { createContent, getContent } from "@/lib/content-store";
import { incrementStat } from "@/lib/profile-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress } from "@/lib/security/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const address = parseAddress(body.address);

  if (!address) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const profile = await resolveProfile(req, address);
  if (!profile?.username) {
    return NextResponse.json({ error: "Username not found" }, { status: 400 });
  }

  const original = await getContent(id);
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await createContent({
    authorAddress: address,
    authorUsername: profile.username,
    topicSlug: original.topicSlug,
    type: "post",
    title: "",
    body: `Reposted from @${original.authorUsername}`,
    mediaUrl: null,
    linkUrl: `/post/${original.id}`,
    repostOfId: original.id,
    publishTxHash: `repost:${id}:${Date.now()}`,
  });

  await incrementStat(address, "posts");

  return NextResponse.json({ item });
}
