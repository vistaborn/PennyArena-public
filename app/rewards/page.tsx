"use client";

import { useEffect, useState } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useToast } from "@/components/toast-provider";
import { WalletModals } from "@/components/wallet-modals";
import {
  POINT_RULES,
  PENNY_CONVERSION_NOTE,
  PENNY_LAUNCH_THRESHOLD,
} from "@/lib/rewards-config";
import { formatUsdc } from "@/lib/pricing";
import { UsdcIcon } from "@/components/brand-icons";

export default function RewardsPage() {
  const { balance, account, refreshBalances } = useWeb3();
  const { profile, refreshProfile } = useApp();
  const toast = useToast();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (account.address) {
      refreshProfile(account.address);
    }
  }, [account.address, refreshProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBalances();
    } finally {
      setRefreshing(false);
    }
  };

  if (!profile) {
    return (
      <div className="card">
        <p>Log in to view rewards & wallet.</p>
      </div>
    );
  }

  const canClaimPenny =
    profile.points >= PENNY_LAUNCH_THRESHOLD && !profile.pennyLaunchClaimed;

  const claimPenny = async () => {
    if (!account.address || !canClaimPenny) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rewards/claim-penny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      toast.success(`$${formatUsdc(data.amountUsdc)} added to your balance`);
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const claimPending = async () => {
    if (!account.address || profile.pendingWinningsUsdc <= 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      toast.success(
        data.onChain
          ? `Claimed $${formatUsdc(data.amountUsdc)} — sent to your wallet`
          : `Claimed $${formatUsdc(data.amountUsdc)}`,
      );
      await refreshProfile();
      await refreshBalances();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Rewards & Wallet</h1>

      <div className="card space-y-4">
        <p className="text-sm text-[var(--muted)]">Passkey smart account on Arc testnet</p>
        <p className="font-mono text-xs break-all">{account.address ?? "—"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="wallet-stat-tile">
            <p className="text-xs text-[var(--muted)]">USDC balance</p>
            <p className="mt-1 text-lg font-bold">{formatUsdc(parseFloat(balance.usdc))}</p>
          </div>
          <div className="wallet-stat-tile">
            <p className="text-xs text-[var(--muted)]">Unclaimed battle winnings</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-bold text-penny-mint">
              <UsdcIcon size={18} />
              {formatUsdc(profile.pendingWinningsUsdc)}
            </p>
          </div>
          <button type="button" className="btn-primary w-full self-end" onClick={() => setModal("deposit")}>
            Deposit
          </button>
          <button
            type="button"
            className="btn-primary w-full self-end"
            onClick={() => setModal("withdraw")}
          >
            Withdraw
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh balance"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh balance"}
        </button>
        {profile.pendingWinningsUsdc > 0 && (
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={claimPending}
          >
            Claim ${formatUsdc(profile.pendingWinningsUsdc)}
          </button>
        )}
      </div>

      <div className="card space-y-3">
        <p className="text-3xl font-bold text-penny-gold">{profile.points.toLocaleString()} PENNY</p>
        <p className="text-xs text-[var(--muted)]">{PENNY_CONVERSION_NOTE}</p>
        {canClaimPenny && (
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={claimPenny}
          >
            Claim $1 USDC · {PENNY_LAUNCH_THRESHOLD.toLocaleString()} PENNY
          </button>
        )}
        {profile.pennyLaunchClaimed && (
          <p className="text-xs text-penny-mint">Launch reward already claimed</p>
        )}
        <ul className="space-y-2 text-sm">
          {POINT_RULES.map((r) => (
            <li key={r.action} className="flex justify-between border-b border-[var(--border)] pb-2">
              <span>{r.label}</span>
              <span className="text-penny-gold">+{r.points}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[var(--muted)]">Tips received</p>
          <p className="font-semibold">{formatUsdc(profile.stats.tipsReceivedUsdc)} USDC</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Duels W/L</p>
          <p className="font-semibold">
            {profile.stats.duelWins} / {profile.stats.duelLosses}
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Votes cast (weight)</p>
          <p className="font-semibold">{profile.stats.votesCast}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Posts</p>
          <p className="font-semibold">{profile.stats.posts}</p>
        </div>
      </div>

      <WalletModals mode={modal} onClose={() => setModal(null)} />
    </div>
  );
}
