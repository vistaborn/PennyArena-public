import { NextRequest, NextResponse } from "next/server";
import { claimTxHash, isTxHashUsed } from "@/lib/security/used-tx";
import { verifyUsdcTransferOnChain } from "@/lib/security/verify-transfer";
import { assertSameOrigin } from "@/lib/security/session";

export async function verifyPaidAction(params: {
  txHash: `0x${string}`;
  fromAddress: string;
  toAddress: string;
  amountUsdc: number;
  purpose: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await isTxHashUsed(params.txHash)) {
    return { ok: false, error: "Transaction already used" };
  }

  const verified = await verifyUsdcTransferOnChain({
    txHash: params.txHash,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    amountUsdc: params.amountUsdc,
  });
  if (!verified.ok) return verified;

  const claimed = await claimTxHash(params.txHash, params.purpose);
  if (!claimed) {
    return { ok: false, error: "Transaction already used" };
  }

  return { ok: true };
}

export function assertCronOrSameOrigin(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  return assertSameOrigin(req);
}
