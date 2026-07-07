"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { X, Copy, ExternalLink } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { formatUsdc } from "@/lib/pricing";
import { WithdrawReceipt, type WithdrawReceiptData } from "@/components/withdraw-receipt";

export function WalletModals({
  mode,
  onClose,
}: {
  mode: "deposit" | "withdraw" | null;
  onClose: () => void;
}) {
  const { account, balance, sendUSDC, refreshBalances } = useWeb3();
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<WithdrawReceiptData | null>(null);

  if (!mode || !account.address) return null;

  const copy = () => {
    navigator.clipboard.writeText(account.address!);
    setMsg("Address copied");
  };

  const withdraw = async () => {
    setBusy(true);
    setMsg(null);
    setReceipt(null);
    try {
      const amount = parseFloat(withdrawAmount);
      const tx = await sendUSDC(withdrawTo, amount);
      setReceipt({
        txHash: tx,
        amountUsdc: amount,
        fromAddress: account.address!,
        toAddress: withdrawTo,
        createdAt: new Date().toISOString(),
      });
      await refreshBalances();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="card w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}</h3>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--muted)]">
          Balance: <strong>{formatUsdc(parseFloat(balance.usdc))} USDC</strong>
        </p>

        {mode === "deposit" ? (
          <div className="mt-4 space-y-3">
            <div className="flex justify-center rounded-xl bg-white p-3">
              <QRCode value={account.address} size={140} />
            </div>
            <p className="break-all font-mono text-xs">{account.address}</p>
            <button type="button" className="btn-secondary flex w-full items-center justify-center gap-2" onClick={copy}>
              <Copy size={16} /> Copy address
            </button>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <ExternalLink size={16} /> Arc Testnet Faucet
            </a>
          </div>
        ) : receipt ? (
          <WithdrawReceipt data={receipt} onDone={onClose} />
        ) : (
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="Recipient 0x…"
              value={withdrawTo}
              onChange={(e) => setWithdrawTo(e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="0.001"
              min="0.001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={withdraw}>
              {busy ? "Sending…" : "Send USDC"}
            </button>
          </div>
        )}

        {msg && <p className="mt-3 text-sm text-penny-coral">{msg}</p>}
      </div>
    </div>
  );
}
