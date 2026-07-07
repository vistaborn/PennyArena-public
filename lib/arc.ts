import { defineChain } from "viem";
import type { Client, PublicClient, Transport } from "viem";
import { getUserOperationGasPrice } from "@circle-fin/modular-wallets-core";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;
export const USDC_ERC20_DECIMALS = 6;
export const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx/";
export const ARC_EXPLORER_USER_OP = "https://testnet.arcscan.app/op/";
export const ARC_MIN_PRIORITY_FEE_WEI = 1_000_000_000n;

export async function resolveArcUserOpGasFees(
  publicClient: Client<Transport> | PublicClient,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    const fees = await getUserOperationGasPrice(publicClient);
    const tier = fees.medium ?? fees.high ?? fees.low;
    let maxPriorityFeePerGas = BigInt(tier.maxPriorityFeePerGas);
    let maxFeePerGas = BigInt(tier.maxFeePerGas);
    if (maxPriorityFeePerGas < ARC_MIN_PRIORITY_FEE_WEI) {
      maxPriorityFeePerGas = ARC_MIN_PRIORITY_FEE_WEI;
    }
    if (maxFeePerGas < maxPriorityFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas + 47_000_000_000n;
    }
    return { maxFeePerGas, maxPriorityFeePerGas };
  } catch {
    let maxPriorityFeePerGas = ARC_MIN_PRIORITY_FEE_WEI;
    let maxFeePerGas = 50_000_000_000n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }
}
