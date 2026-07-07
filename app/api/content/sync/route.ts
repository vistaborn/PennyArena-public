import { NextRequest, NextResponse } from "next/server";
import { upsertUserPosts } from "@/lib/content-store";
import type { ContentItem } from "@/lib/content-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, validateHttpUrl, validateMediaUrl } from "@/lib/security/validation";
import { isValidTopicSlug } from "@/lib/topics";

function sanitizeItem(raw: unknown, owner: string): ContentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ContentItem>;
  if (!o.id || typeof o.id !== "string") return null;
  if (!o.topicSlug || !isValidTopicSlug(o.topicSlug)) return null;
  if (o.authorAddress?.toLowerCase() !== owner) return null;
  return {
    id: o.id,
    authorAddress: owner,
    authorUsername: typeof o.authorUsername === "string" ? o.authorUsername : "",
    topicSlug: o.topicSlug,
    type: o.type ?? "post",
    title: typeof o.title === "string" ? o.title.slice(0, 120) : "",
    body: typeof o.body === "string" ? o.body.slice(0, 5000) : "",
    mediaUrl: validateMediaUrl(o.mediaUrl),
    linkUrl: validateHttpUrl(o.linkUrl),
    linkPreviewImage: validateHttpUrl(o.linkPreviewImage),
    repostOfId: typeof o.repostOfId === "string" ? o.repostOfId : null,
    publishTxHash: typeof o.publishTxHash === "string" ? o.publishTxHash : `sync:${o.id}`,
    tipsTotalUsdc: typeof o.tipsTotalUsdc === "number" ? o.tipsTotalUsdc : 0,
    tipCount: typeof o.tipCount === "number" ? o.tipCount : 0,
    likeCount: typeof o.likeCount === "number" ? o.likeCount : 0,
    votesTotalUsdc: typeof o.votesTotalUsdc === "number" ? o.votesTotalUsdc : 0,
    commentCount: typeof o.commentCount === "number" ? o.commentCount : 0,
    repostCount: typeof o.repostCount === "number" ? o.repostCount : 0,
    voteScore: typeof o.voteScore === "number" ? o.voteScore : 0,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  if (!address || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const owner = address.toLowerCase();
  const items = (body.items as unknown[])
    .slice(0, 40)
    .map((raw) => sanitizeItem(raw, owner))
    .filter((x): x is ContentItem => x !== null);

  const synced = await upsertUserPosts(owner, items);
  return NextResponse.json({ ok: true, synced, total: items.length });
}
