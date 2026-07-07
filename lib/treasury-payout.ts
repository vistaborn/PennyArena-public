import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, USDC_ADDRESS } from "@/lib/arc";
import { getTreasuryAddress, usdcToUnits } from "@/lib/pricing";

const transferAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export function hasTreasuryPayout(): boolean {
  const pk = process.env.PENNY_TREASURY_PRIVATE_KEY;
  return Boolean(pk?.match(/^0x[a-fA-F0-9]{64}$/) && getTreasuryAddress());
}

export async function sendTreasuryUsdc(
  toAddress: string,
  amountUsdc: number,
): Promise<`0x${string}`> {
  const pk = process.env.PENNY_TREASURY_PRIVATE_KEY;
  const treasury = getTreasuryAddress();
  if (!pk?.match(/^0x[a-fA-F0-9]{64}$/) || !treasury) {
    throw new Error("Treasury payout not configured");
  }
  if (amountUsdc <= 0) throw new Error("Invalid payout amount");

  const account = privateKeyToAccount(pk as `0x${string}`);
  if (account.address.toLowerCase() !== treasury.toLowerCase()) {
    throw new Error("Treasury private key does not match treasury address");
  }

  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(arcTestnet.rpcUrls.default.http[0]),
  });

  return client.writeContract({
    address: USDC_ADDRESS,
    abi: transferAbi,
    functionName: "transfer",
    args: [toAddress.toLowerCase() as `0x${string}`, usdcToUnits(amountUsdc)],
  });
}
