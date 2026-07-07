import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { arcTestnet, USDC_ADDRESS } from "@/lib/arc";
import { usdcToUnits } from "@/lib/pricing";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export async function verifyUsdcTransferOnChain(params: {
  txHash: `0x${string}`;
  fromAddress: string;
  toAddress: string;
  amountUsdc: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: params.txHash });
  } catch {
    return { ok: false, error: "Transaction not found on Arc Testnet" };
  }
  if (receipt.status !== "success") {
    return { ok: false, error: "Transaction failed on-chain" };
  }

  const from = params.fromAddress.toLowerCase();
  const to = params.toAddress.toLowerCase();
  const expected = usdcToUnits(params.amountUsdc);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      if (
        decoded.args.from?.toLowerCase() === from &&
        decoded.args.to?.toLowerCase() === to &&
        decoded.args.value === expected
      ) {
        return { ok: true };
      }
    } catch {
      /* skip */
    }
  }
  return { ok: false, error: "USDC transfer amount/recipient not verified on-chain" };
}
