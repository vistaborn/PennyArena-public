"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useToast } from "@/components/toast-provider";
import { formatUsdc } from "@/lib/pricing";
import { UsdcIcon } from "@/components/brand-icons";
import type { UserDuelOutcome } from "@/lib/duel-payouts";
import type { Duel } from "@/lib/duel-store";
import type { ContentItem } from "@/lib/content-store";

export type BattleNotification = {
  duel: Duel;
  contentA: ContentItem | null;
  contentB: ContentItem | null;
  outcome: UserDuelOutcome | null;
  votes?: import("@/lib/duel-store").DuelVote[];
  scoreA?: number;
  scoreB?: number;
};

export function BattleResultModal({
  notification,
  onClose,
  onAcknowledge,
}: {
  notification: BattleNotification;
  onClose: () => void;
  onAcknowledge: (claimed: boolean) => void;
}) {
  const { account, refreshBalances } = useWeb3();
  const { refreshProfile } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { duel, contentA, contentB, outcome } = notification;

  if (!outcome) return null;

  const won = outcome.earnedUsdc > 0;
  const lost =
    outcome.role === "loser_author" || outcome.role === "losing_voter";

  const claim = async () => {
    if (!account.address || !outcome.canClaim) {
      onAcknowledge(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          amountUsdc: outcome.earnedUsdc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      toast.success(`Claimed $${formatUsdc(data.amountUsdc ?? outcome.earnedUsdc)}`);
      await refreshProfile();
      await refreshBalances();
      onAcknowledge(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className={`card w-full max-w-md space-y-4 ${
          won
            ? "border-penny-mint/40"
            : lost
              ? "border-penny-coral/40"
              : "border-penny-gold/30"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{outcome.headline}</h2>
          <button type="button" className="text-[var(--muted)]" onClick={() => onAcknowledge(false)}>
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-[var(--muted)]">
          {contentA ? `@${contentA.authorUsername}` : "A"} vs{" "}
          {contentB ? `@${contentB.authorUsername}` : "B"} · {duel.topicSlug}
        </p>

        {outcome.earnedUsdc > 0 && (
          <p className="flex items-center gap-2 text-2xl font-bold text-penny-mint">
            <UsdcIcon size={24} />+${formatUsdc(outcome.earnedUsdc)}
          </p>
        )}

        <ul className="space-y-1.5 rounded-xl bg-white/[0.03] p-3 text-sm text-[var(--muted)]">
          {outcome.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {outcome.canClaim && outcome.earnedUsdc > 0 ? (
            <button type="button" className="btn-primary flex-1" disabled={busy} onClick={claim}>
              {busy ? "Claiming…" : `Claim $${formatUsdc(outcome.earnedUsdc)}`}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => onAcknowledge(false)}
          >
            {won ? "Close" : "OK"}
          </button>
        </div>

        <Link href={`/battle/${duel.id}`} className="block text-center text-xs text-penny-mint hover:underline">
          View battle details
        </Link>
      </div>
    </div>
  );
}
