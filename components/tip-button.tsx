"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { formatUsdc } from "@/lib/pricing";

const TIP_PRESETS = [0.01, 0.05, 0.1];

export function TipButton({
  contentId,
  authorAddress,
  compact,
}: {
  contentId: string;
  authorAddress: string;
  compact?: boolean;
}) {
  const { isConnected, sendUSDC, account, balance } = useWeb3();
  const { refreshProfile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasTipped, setHasTipped] = useState(false);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  const balanceUsdc = parseFloat(balance.usdc) || 0;
  const minTip = TIP_PRESETS[0]!;
  const hasFundsForTips = balanceUsdc >= minTip;
  const showLowBalanceHint = open && isConnected && (!hasFundsForTips || insufficientFunds);

  useEffect(() => {
    if (!account.address) return;
    fetch(
      `/api/tips?contentId=${encodeURIComponent(contentId)}&address=${encodeURIComponent(account.address)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((d) => setHasTipped(Boolean(d.tipped)))
      .catch(() => undefined);
  }, [contentId, account.address]);

  const tip = async (amount: number) => {
    if (!isConnected) {
      showLogin();
      return;
    }
    if (!account.address) return;
    setBusy(true);
    try {
      const txHash = await sendUSDC(authorAddress, amount);
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          contentId,
          amountUsdc: amount,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tip failed");
      setHasTipped(true);
      toast.success(`Tip sent · ${formatUsdc(amount)} USDC`);
      await refreshProfile();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tip failed";
      if (/insufficient/i.test(msg)) {
        setInsufficientFunds(true);
        toast.error("Not enough USDC for tips.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const heartClass = hasTipped ? "fill-penny-coral text-penny-coral" : "";

  const toggleMenu = () => {
    if (!isConnected) {
      showLogin();
      return;
    }
    setInsufficientFunds(false);
    setOpen((prev) => !prev);
  };

  const lowBalanceHint = (
    <div className="min-w-[11rem] space-y-1.5">
      <p className="text-xs leading-snug text-penny-coral">Not enough USDC for tips.</p>
      <Link
        href="/rewards"
        className="block text-xs leading-snug text-penny-gold hover:underline"
        onClick={() => {
          setOpen(false);
          setInsufficientFunds(false);
        }}
      >
        Top up your balance in Rewards &amp; Wallet →
      </Link>
    </div>
  );

  const presetMenu = showLowBalanceHint ? (
    lowBalanceHint
  ) : (
    <>
      {TIP_PRESETS.map((a) => (
        <button
          key={a}
          type="button"
          className="rounded-lg bg-penny-coral/20 px-2 py-1 text-xs font-medium hover:bg-penny-coral/30"
          disabled={busy}
          onClick={() => tip(a)}
        >
          ${formatUsdc(a)}
        </button>
      ))}
      <Link
        href="/rewards"
        className="inline-flex items-center justify-center rounded-lg border border-penny-gold/35 bg-penny-gold/15 px-2 py-1 text-penny-gold transition hover:bg-penny-gold/25"
        title="Add funds — Rewards & Wallet"
        onClick={() => setOpen(false)}
      >
        <Plus size={14} strokeWidth={2.5} />
      </Link>
    </>
  );

  if (compact) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          className={`btn-action px-2.5 py-1 text-xs uppercase tracking-wide ${hasTipped ? "text-penny-coral" : ""}`}
          disabled={busy}
          onClick={toggleMenu}
        >
          <Heart size={12} className={heartClass} /> Tip
        </button>
        {open && (
          <div
            className={`absolute right-0 top-full z-20 mt-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg ${
              showLowBalanceHint ? "block" : "flex gap-1"
            }`}
          >
            {presetMenu}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={`btn-action ${hasTipped ? "text-penny-coral" : ""}`}
        disabled={busy}
        onClick={toggleMenu}
      >
        <Heart size={14} className={heartClass} /> Tip
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-10 mt-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg ${
            showLowBalanceHint ? "block" : "flex gap-1"
          }`}
        >
          {presetMenu}
        </div>
      )}
    </div>
  );
}
