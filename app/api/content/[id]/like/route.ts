import { NextRequest, NextResponse } from "next/server";
import { addLike, getContent, userLikedContent } from "@/lib/content-store";
import { incrementStat, addPoints } from "@/lib/profile-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { parseAddress, parseTxHash } from "@/lib/security/validation";
import { verifyPaidAction } from "@/lib/security/paid-action";
import { LIKE_FEE_USDC } from "@/lib/pricing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ liked: false });
  const liked = await userLikedContent(id, address);
  return NextResponse.json({ liked });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const address = parseAddress(body.address);
  const txHash = parseTxHash(body.txHash);

  if (!address || !txHash) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const content = await getContent(id);
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const verified = await verifyPaidAction({
    txHash,
    fromAddress: address,
    toAddress: content.authorAddress,
    amountUsdc: LIKE_FEE_USDC,
    purpose: `like:${id}`,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const like = await addLike({
    contentId: id,
    fromAddress: address,
    amountUsdc: LIKE_FEE_USDC,
    txHash,
  });
  if (!like) {
    return NextResponse.json({ error: "Already voted or duplicate tx" }, { status: 409 });
  }

  await incrementStat(address, "votesCast");
  await incrementStat(content.authorAddress, "tipsReceivedUsdc", LIKE_FEE_USDC);
  await addPoints(content.authorAddress, "tip_received");

  return NextResponse.json({ like });
}
