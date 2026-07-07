"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import {
  formatUsdc,
  formatDuelDurationLabel,
  getTreasuryAddress,
  VOTE_UNIT_USDC,
} from "@/lib/pricing";
import { useLiveCountdown } from "@/lib/use-live-countdown";
import { BattleSideCard } from "@/components/battle-card";
import type { ContentItem } from "@/lib/content-store";
import type { Duel } from "@/lib/duel-store";

export function VotePanel({
  duel,
  contentA,
  contentB,
  scoreA = 0,
  scoreB = 0,
  highlightContentId,
  onVoted,
}: {
  duel: Duel;
  contentA?: ContentItem | null;
  contentB?: ContentItem | null;
  scoreA?: number;
  scoreB?: number;
  highlightContentId?: string;
  onVoted?: (scores: { scoreA: number; scoreB: number }) => void;
}) {
  const { isConnected, account, sendUSDC } = useWeb3();
  const { refreshProfile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [side, setSide] = useState(highlightContentId ?? duel.contentAId);
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState(false);
  const [votedSide, setVotedSide] = useState<string | null>(null);
  const [localA, setLocalA] = useState(scoreA);
  const [localB, setLocalB] = useState(scoreB);

  const treasury = getTreasuryAddress();
  const { expired } = useLiveCountdown(duel.endsAt);

  const labelA = contentA ? `@${contentA.authorUsername}` : "Side A";
  const labelB = contentB ? `@${contentB.authorUsername}` : "Side B";

  useEffect(() => {
    setLocalA(scoreA);
    setLocalB(scoreB);
  }, [scoreA, scoreB]);

  const checkVote = () => {
    if (!account.address) return;
    fetch(`/api/duels/${duel.id}?address=${encodeURIComponent(account.address)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        setLocalA(d.scoreA ?? 0);
        setLocalB(d.scoreB ?? 0);
        if (d.myVote) {
          setVoted(true);
          setVotedSide(d.myVote.sideContentId);
          setSide(d.myVote.sideContentId);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    checkVote();
  }, [duel.id, account.address]);

  const vote = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    if (voted) return;
    if (!treasury) {
      toast.error("Treasury address not configured");
      return;
    }
    setBusy(true);
    try {
      const txHash = await sendUSDC(treasury, VOTE_UNIT_USDC);
      const res = await fetch(`/api/duels/${duel.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          sideContentId: side,
          amountUsdc: VOTE_UNIT_USDC,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vote failed");
      setVoted(true);
      setVotedSide(side);
      const nextA = data.scoreA ?? localA;
      const nextB = data.scoreB ?? localB;
      setLocalA(nextA);
      setLocalB(nextB);
      toast.success("Vote cast!");
      await refreshProfile();
      onVoted?.({ scoreA: nextA, scoreB: nextB });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setBusy(false);
    }
  };

  if (duel.status !== "active" || expired) return null;

  return (
    <div className="rounded-xl border border-penny-mint/30 bg-penny-mint/5 p-4">
      <p className="text-sm font-semibold">Tap a post to pick your side</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        ${formatUsdc(VOTE_UNIT_USDC)} per vote · {formatDuelDurationLabel()} voting window · winners
        split the loser&apos;s entry pool
      </p>

      <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2">
        <BattleSideCard
          side={{ content: contentA ?? null, label: labelA, score: localA }}
          selectable={!voted}
          selected={side === duel.contentAId}
          voted={votedSide === duel.contentAId}
          fullPreview
          onSelect={() => !voted && setSide(duel.contentAId)}
        />
        <BattleSideCard
          side={{ content: contentB ?? null, label: labelB, score: localB }}
          selectable={!voted}
          selected={side === duel.contentBId}
          voted={votedSide === duel.contentBId}
          fullPreview
          onSelect={() => !voted && setSide(duel.contentBId)}
        />
      </div>

      {voted ? (
        <p className="mt-3 text-xs text-penny-mint">
          You voted for {votedSide === duel.contentAId ? labelA : labelB}
        </p>
      ) : (
        <button
          type="button"
          className="btn-primary mt-3 w-full"
          disabled={busy}
          onClick={vote}
        >
          Vote for {side === duel.contentAId ? labelA : labelB} · ${formatUsdc(VOTE_UNIT_USDC)}
        </button>
      )}
    </div>
  );
}
