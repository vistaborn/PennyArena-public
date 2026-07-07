"use client";

import { useState } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { DUEL_ENTRY_FEE_USDC, formatDuelDurationLabel, formatUsdc, getTreasuryAddress } from "@/lib/pricing";
import type { ContentItem } from "@/lib/content-store";

export function DuelActions({
  item,
  siblings,
}: {
  item: ContentItem;
  siblings: ContentItem[];
}) {
  const { account, isConnected, sendUSDC } = useWeb3();
  const { profile, refreshProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const rivals = siblings.filter(
    (s) => s.topicSlug === item.topicSlug && s.authorAddress !== item.authorAddress,
  );

  if (!profile || profile.walletAddress !== item.authorAddress) return null;
  if (rivals.length === 0) return null;

  const challenge = async (opponentId: string) => {
    const treasury = getTreasuryAddress();
    if (!treasury || !account.address) return;
    setBusy(true);
    try {
      const txHash = await sendUSDC(treasury, DUEL_ENTRY_FEE_USDC);
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          contentAId: item.id,
          contentBId: opponentId,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Challenge failed");
      alert(`Duel challenged! ID: ${data.duel.id}. Opponent must accept & pay $${formatUsdc(DUEL_ENTRY_FEE_USDC)}`);
      await refreshProfile();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const accept = async (duelId: string) => {
    const treasury = getTreasuryAddress();
    if (!treasury || !account.address) return;
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
      alert(`Duel is live! Voting is open for ${formatDuelDurationLabel()}.`);
      await refreshProfile();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-dashed border-[var(--border)] p-3">
      <p className="text-xs font-semibold text-penny-gold">Duel on this topic · ${formatUsdc(DUEL_ENTRY_FEE_USDC)} entry</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rivals.map((r) => (
          <button
            key={r.id}
            type="button"
            className="btn-secondary text-xs"
            disabled={busy || !isConnected}
            onClick={() => challenge(r.id)}
          >
            Challenge @{r.authorUsername}
          </button>
        ))}
      </div>
      <AcceptDuelPrompt onAccept={accept} busy={busy} />
    </div>
  );
}

function AcceptDuelPrompt({
  onAccept,
  busy,
}: {
  onAccept: (id: string) => void;
  busy: boolean;
}) {
  const [duelId, setDuelId] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <input
        className="input flex-1 text-xs"
        placeholder="Paste duel ID to accept (as opponent)"
        value={duelId}
        onChange={(e) => setDuelId(e.target.value)}
      />
      <button type="button" className="btn-primary text-xs" disabled={busy || !duelId} onClick={() => onAccept(duelId)}>
        Accept
      </button>
    </div>
  );
}
