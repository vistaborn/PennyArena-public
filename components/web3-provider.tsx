"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createPublicClient } from "viem";
import {
  type P256Credential,
  type SmartAccount,
  toWebAuthnAccount,
  createBundlerClient,
} from "viem/account-abstraction";
import {
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  WebAuthnMode,
  encodeTransfer,
} from "@circle-fin/modular-wallets-core";
import {
  arcTestnet,
  USDC_ADDRESS,
  USDC_ERC20_DECIMALS,
  resolveArcUserOpGasFees,
} from "@/lib/arc";
import { usdcToUnits } from "@/lib/pricing";
import { requireWebAuthn } from "@/lib/webauthn";
import { createPasskeyCredential, loginPasskeyCredential } from "@/lib/passkey-credential";
import {
  normalizeCircleClientUrl,
  toCirclePasskeyUsername,
} from "@/lib/passkey-utils";

const PASSKEY_STORAGE_KEY = "penny_passkey_credential";

type Account = {
  smartAccount: SmartAccount | null;
  address: string | null;
  bundlerClient: ReturnType<typeof createBundlerClient> | null;
  publicClient: ReturnType<typeof createPublicClient> | null;
};

type TokenBalance = { usdc: string };

type Web3ContextType = {
  account: Account;
  isConnected: boolean;
  isInitialized: boolean;
  error: string | null;
  registerPasskey: (username: string) => Promise<string>;
  loginWithPasskey: () => Promise<string>;
  sendUSDC: (to: string, amountUsdc: number) => Promise<string>;
  balance: TokenBalance;
  refreshBalances: () => Promise<void>;
  clearSession: () => void;
};

const emptyAccount: Account = {
  smartAccount: null,
  address: null,
  bundlerClient: null,
  publicClient: null,
};

const Web3Context = createContext<Web3ContextType | null>(null);

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider");
  return ctx;
}

function loadStoredCredential(): P256Credential | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(PASSKEY_STORAGE_KEY) ??
      sessionStorage.getItem(PASSKEY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as P256Credential) : null;
  } catch {
    return null;
  }
}

function storeCredential(credential: P256Credential) {
  const json = JSON.stringify(credential);
  localStorage.setItem(PASSKEY_STORAGE_KEY, json);
  sessionStorage.setItem(PASSKEY_STORAGE_KEY, json);
}

async function waitForUserOpReceipt(
  bundlerClient: NonNullable<Account["bundlerClient"]>,
  userOpHash: `0x${string}`,
) {
  try {
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      pollingInterval: 2_000,
      timeout: 180_000,
    });
    return receipt;
  } catch (error) {
    for (let i = 0; i < 30; i++) {
      const result = await bundlerClient
        .getUserOperationReceipt({ hash: userOpHash })
        .catch(() => null);
      if (result?.receipt?.transactionHash) return result.receipt;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw error;
  }
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<TokenBalance>({ usdc: "0" });

  const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY;
  const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL;

  const fetchBalances = useCallback(async (accountData: Account) => {
    if (!accountData.address || !accountData.publicClient) {
      setBalance({ usdc: "0" });
      return;
    }
    try {
      const result = await accountData.publicClient.readContract({
        address: USDC_ADDRESS,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const,
        functionName: "balanceOf",
        args: [accountData.address as `0x${string}`],
      });
      setBalance({ usdc: (Number(result) / 10 ** USDC_ERC20_DECIMALS).toString() });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const initializeChain = useCallback(
    async (credentialData: P256Credential, walletName?: string): Promise<Account> => {
      if (!clientKey || !clientUrl) throw new Error("Missing Circle client configuration");
      const baseUrl = normalizeCircleClientUrl(clientUrl);
      const modularTransport = toModularTransport(`${baseUrl}/arcTestnet`, clientKey);
      const publicClient = createPublicClient({ chain: arcTestnet, transport: modularTransport });
      const webAuthnAccount = toWebAuthnAccount({ credential: credentialData });
      const circleAccount = await toCircleSmartAccount({
        client: publicClient,
        owner: webAuthnAccount,
        ...(walletName ? { name: walletName } : {}),
      });
      const bundlerClient = createBundlerClient({
        account: circleAccount,
        client: publicClient,
        chain: arcTestnet,
        transport: modularTransport,
        pollingInterval: 2_000,
        userOperation: {
          estimateFeesPerGas: () => resolveArcUserOpGasFees(publicClient),
        },
      });
      return {
        smartAccount: circleAccount,
        address: circleAccount.address,
        bundlerClient,
        publicClient,
      };
    },
    [clientKey, clientUrl],
  );

  const initializeWeb3 = useCallback(
    async (credentialData: P256Credential, walletName?: string): Promise<string> => {
      setError(null);
      const accountData = await initializeChain(credentialData, walletName);
      setAccount(accountData);
      setIsConnected(!!accountData.address);
      await fetchBalances(accountData);
      return accountData.address ?? "";
    },
    [fetchBalances, initializeChain],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!clientKey || !clientUrl) {
      setError("Add NEXT_PUBLIC_CIRCLE_CLIENT_KEY to .env.local");
      setIsInitialized(true);
      return;
    }
    const stored = loadStoredCredential();
    if (stored) {
      initializeWeb3(stored)
        .catch((e) => setError(e instanceof Error ? e.message : "Wallet init failed"))
        .finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true);
    }
  }, [clientKey, clientUrl, initializeWeb3]);

  const registerPasskey = async (username: string): Promise<string> => {
    if (!clientKey || !clientUrl) throw new Error("Missing Circle configuration");
    requireWebAuthn();
    const circleUsername = toCirclePasskeyUsername(username);
    const credential = await createPasskeyCredential(clientUrl, clientKey, circleUsername);
    storeCredential(credential);
    return initializeWeb3(credential, circleUsername);
  };

  const loginWithPasskey = async (): Promise<string> => {
    if (!clientKey || !clientUrl) throw new Error("Missing Circle configuration");
    requireWebAuthn();
    const passkeyTransport = toPasskeyTransport(
      normalizeCircleClientUrl(clientUrl),
      clientKey,
    );

    let credential: P256Credential;
    try {
      // Default desktop path — unchanged Circle SDK flow.
      credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const needsSerializedPayload =
        message.includes("API parameter invalid") ||
        message.includes("Missing or invalid parameters");
      if (!needsSerializedPayload) throw error;
      credential = await loginPasskeyCredential(clientUrl, clientKey);
    }

    storeCredential(credential);
    return initializeWeb3(credential);
  };

  const sendUSDC = async (to: string, amountUsdc: number): Promise<string> => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("Invalid recipient address");
    if (!account.bundlerClient || !account.smartAccount || !account.publicClient) {
      throw new Error("Wallet not connected");
    }
    const tokenAmount = usdcToUnits(amountUsdc);
    if (tokenAmount <= 0n) throw new Error("Amount must be positive");

    const bal = await account.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const,
      functionName: "balanceOf",
      args: [account.smartAccount.address],
    });
    if (bal < tokenAmount) throw new Error("Insufficient USDC balance");

    const gasFees = await resolveArcUserOpGasFees(account.publicClient);
    const userOpHash = await account.bundlerClient.sendUserOperation({
      account: account.smartAccount,
      calls: [encodeTransfer(to as `0x${string}`, USDC_ADDRESS, tokenAmount)],
      paymaster: true,
      ...gasFees,
    });
    try {
      const receipt = await waitForUserOpReceipt(account.bundlerClient, userOpHash);
      await fetchBalances(account);
      return receipt.transactionHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transfer failed";
      setError(msg);
      throw new Error(msg);
    }
  };

  const refreshBalances = useCallback(async () => {
    await fetchBalances(account);
  }, [account, fetchBalances]);

  const clearSession = () => {
    localStorage.removeItem(PASSKEY_STORAGE_KEY);
    sessionStorage.removeItem(PASSKEY_STORAGE_KEY);
    setAccount(emptyAccount);
    setIsConnected(false);
    setBalance({ usdc: "0" });
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        isConnected,
        isInitialized,
        error,
        registerPasskey,
        loginWithPasskey,
        sendUSDC,
        balance,
        refreshBalances,
        clearSession,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}
