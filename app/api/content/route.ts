import { NextRequest, NextResponse } from "next/server";
import { createContent, listContent } from "@/lib/content-store";
import { ensureOfficialSeedIfEmpty } from "@/lib/seed-official";
import { addPoints, incrementStat } from "@/lib/profile-store";
import { resolveProfile } from "@/lib/resolve-profile";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { verifyPaidAction } from "@/lib/security/paid-action";
import {
  parseAddress,
  parseTxHash,
  validateContentType,
  validateHttpUrl,
  validateMediaUrl,
  validateText,
} from "@/lib/security/validation";
import { isValidTopicSlug } from "@/lib/topics";
import { getTreasuryAddress, PUBLISH_FEE_USDC } from "@/lib/pricing";
import { extractFirstHttpUrl } from "@/lib/extract-url";
import { fetchLinkPreview, isSafePreviewUrl } from "@/lib/fetch-link-preview";

export async function GET(req: NextRequest) {
  await ensureOfficialSeedIfEmpty();
  const author = req.nextUrl.searchParams.get("author");
  const topic = req.nextUrl.searchParams.get("topic") ?? undefined;
  const items = await listContent({
    authorAddress: author ?? undefined,
    topicSlug: topic,
    limit: 50,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const txHash = parseTxHash(body.publishTxHash);
  const type = validateContentType(body.type);
  const title = validateText(body.title, 120) ?? "";
  const text = validateText(body.body, 5000) ?? "";
  const topicSlug = body.topicSlug;

  if (!address || !txHash || !type || !isValidTopicSlug(topicSlug)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!title && !text && !body.mediaUrl) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const profile = await resolveProfile(req, address);
  if (!profile?.username) {
    return NextResponse.json({ error: "Username not found — log in again" }, { status: 400 });
  }

  const treasury = getTreasuryAddress();
  if (!treasury) {
    return NextResponse.json({ error: "Treasury not configured" }, { status: 500 });
  }

  const verified = await verifyPaidAction({
    txHash,
    fromAddress: address,
    toAddress: treasury,
    amountUsdc: PUBLISH_FEE_USDC,
    purpose: "publish",
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const linkUrl =
    typeof body.linkUrl === "string"
      ? validateHttpUrl(body.linkUrl)
      : extractFirstHttpUrl(text, title);
  if (linkUrl && !isSafePreviewUrl(linkUrl)) {
    return NextResponse.json({ error: "Invalid link URL" }, { status: 400 });
  }
  let linkPreviewImage =
    typeof body.linkPreviewImage === "string" ? validateHttpUrl(body.linkPreviewImage) : null;
  if (linkUrl && !linkPreviewImage) {
    const preview = await fetchLinkPreview(linkUrl);
    linkPreviewImage = preview.image;
  }

  const item = await createContent({
    authorAddress: address,
    authorUsername: profile.username,
    topicSlug,
    type,
    title,
    body: text,
    mediaUrl: validateMediaUrl(body.mediaUrl),
    linkUrl,
    linkPreviewImage,
    publishTxHash: txHash,
  });

  await addPoints(address, "publish");
  await incrementStat(address, "posts");

  return NextResponse.json({ item });
}
