"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { BattleCard } from "@/components/battle-card";
import { BattleCommentSection } from "@/components/battle-comment-section";
import type { ContentItem } from "@/lib/content-store";
import type { Duel, DuelVote } from "@/lib/duel-store";
import {
  DUEL_ENTRY_FEE_USDC,
  formatUsdc,
  formatDuelDurationLabel,
  getTreasuryAddress,
} from "@/lib/pricing";

export function BattleDetailClient({ duelId }: { duelId: string }) {
  const { account, isConnected, sendUSDC } = useWeb3();
  const { refreshProfile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [contentA, setContentA] = useState<ContentItem | null>(null);
  const [contentB, setContentB] = useState<ContentItem | null>(null);
  const [votes, setVotes] = useState<DuelVote[]>([]);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = account.address
      ? `?address=${encodeURIComponent(account.address)}`
      : "";
    const res = await fetch(`/api/duels/${duelId}${q}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Not found");
      setLoading(false);
      return;
    }
    setDuel(data.duel);
    setContentA(data.contentA);
    setContentB(data.contentB);
    setVotes(data.votes ?? []);
    setScoreA(data.scoreA ?? 0);
    setScoreB(data.scoreB ?? 0);
    setLoading(false);
  }, [duelId, account.address]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (duel?.status !== "active") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, duel?.status]);

  const canAccept =
    duel?.status === "pending" &&
    account.address &&
    duel.authorB === account.address.toLowerCase();

  const canDecline =
    duel?.status === "pending" &&
    account.address &&
    (duel.authorA === account.address.toLowerCase() ||
      duel.authorB === account.address.toLowerCase());

  const declineBattle = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "decline",
          address: account.address,
          duelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Decline failed");
      toast.success("Battle declined");
      await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  const acceptBattle = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    const treasury = getTreasuryAddress();
    if (!treasury) {
      toast.error("Treasury not configured");
      return;
    }
    setBusy(true);
    try {
      const txHash = await sendUSDC(treasury, DUEL_ENTRY_FEE_USDC);
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "accept",
          address: account.address,
          duelId,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Accept failed");
      toast.success(`Battle is live for ${formatDuelDurationLabel()}!`);
      await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading battle…</p>;
  }

  if (error || !duel) {
    return (
      <div className="card text-center">
        <p className="text-[var(--muted)]">{error ?? "Battle not found"}</p>
        <Link href="/battle" className="btn-secondary mt-3 inline-block">
          Back to battles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/battle" className="btn-ghost inline-flex gap-1 text-sm">
        <ArrowLeft size={16} /> All battles
      </Link>

      <BattleCard
        duel={duel}
        contentA={contentA}
        contentB={contentB}
        scoreA={scoreA}
        scoreB={scoreB}
        showLink={false}
        feedMode={duel.status === "active"}
        viewerAddress={account.address}
        votes={votes}
        onVote={({ scoreA: a, scoreB: b }) => {
          setScoreA(a);
          setScoreB(b);
          load();
        }}
      />

      {canDecline && (
        <div className="card space-y-3 border-penny-coral/30">
          <p className="text-sm text-[var(--muted)]">
            {canAccept
              ? "You can accept this challenge or decline it."
              : "Waiting for opponent — you can cancel this challenge."}
          </p>
          <button
            type="button"
            className="btn-secondary w-full text-penny-coral"
            disabled={busy}
            onClick={declineBattle}
          >
            {canAccept ? "Decline challenge" : "Cancel challenge"}
          </button>
        </div>
      )}

      {canAccept && (
        <div className="card space-y-3 border-penny-coral/30">
          <p className="text-sm">
            You were challenged! Accept and pay ${formatUsdc(DUEL_ENTRY_FEE_USDC)} to start the{" "}
            {formatDuelDurationLabel()} battle.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={acceptBattle}
          >
            Accept battle · ${formatUsdc(DUEL_ENTRY_FEE_USDC)}
          </button>
        </div>
      )}

      {duel.status === "pending" && !canAccept && !canDecline && (
        <div className="card text-sm text-[var(--muted)]">
          Waiting for @{contentB?.authorUsername ?? "opponent"} to accept and pay entry fee.
        </div>
      )}

      {votes.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-sm font-semibold">Votes ({votes.length})</h2>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {votes.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <span className="font-mono truncate">{v.voterAddress.slice(0, 10)}…</span>
                <span>
                  side{" "}
                  {v.sideContentId === duel.contentAId
                    ? `@${contentA?.authorUsername ?? "A"}`
                    : `@${contentB?.authorUsername ?? "B"}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BattleCommentSection duelId={duel.id} duelStatus={duel.status} />
    </div>
  );
}
