import { NextRequest, NextResponse } from "next/server";
import { addTip, getContent, userTippedContent } from "@/lib/content-store";
import { addPoints, incrementStat } from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, parsePositiveAmount, parseTxHash } from "@/lib/security/validation";
import { verifyPaidAction } from "@/lib/security/paid-action";

export async function GET(req: NextRequest) {
  const contentId = req.nextUrl.searchParams.get("contentId");
  const address = parseAddress(req.nextUrl.searchParams.get("address") ?? "");
  if (!contentId || !address) {
    return NextResponse.json({ tipped: false });
  }
  const tipped = await userTippedContent(contentId, address);
  return NextResponse.json({ tipped });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const txHash = parseTxHash(body.txHash);
  const amountUsdc = parsePositiveAmount(body.amountUsdc);
  const contentId = typeof body.contentId === "string" ? body.contentId : null;

  if (!address || !txHash || !amountUsdc || !contentId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const content = await getContent(contentId);
  if (!content) return NextResponse.json({ error: "Content not found" }, { status: 404 });

  const verified = await verifyPaidAction({
    txHash,
    fromAddress: address,
    toAddress: content.authorAddress,
    amountUsdc,
    purpose: `tip:${contentId}`,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const tip = await addTip({
    contentId,
    fromAddress: address,
    toAddress: content.authorAddress,
    amountUsdc,
    txHash,
  });
  if (!tip) {
    const already = await userTippedContent(contentId, address);
    if (already) {
      return NextResponse.json({ error: "Already tipped this post" }, { status: 409 });
    }
    return NextResponse.json({ error: "Duplicate tx" }, { status: 409 });
  }

  await addPoints(content.authorAddress, "tip_received");
  await incrementStat(address, "tipsSentUsdc", amountUsdc);
  await incrementStat(content.authorAddress, "tipsReceivedUsdc", amountUsdc);

  return NextResponse.json({ tip });
}
