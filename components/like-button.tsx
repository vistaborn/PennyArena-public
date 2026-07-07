"use client";

import { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { formatUsdc, LIKE_FEE_USDC } from "@/lib/pricing";

export function LikeButton({
  contentId,
  authorAddress,
  initialCount,
  compact,
}: {
  contentId: string;
  authorAddress: string;
  initialCount: number;
  compact?: boolean;
}) {
  const { isConnected, sendUSDC, account } = useWeb3();
  const { refreshProfile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  useEffect(() => {
    if (!account.address) return;
    fetch(
      `/api/content/${contentId}/like?address=${encodeURIComponent(account.address)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((d) => setVoted(Boolean(d.liked)))
      .catch(() => undefined);
  }, [contentId, account.address]);

  const vote = async () => {
    if (!isConnected) {
      showLogin();
      return;
    }
    if (!account.address || voted) return;
    setBusy(true);
    try {
      const txHash = await sendUSDC(authorAddress as `0x${string}`, LIKE_FEE_USDC);
      const res = await fetch(`/api/content/${contentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vote failed");
      setCount((c) => c + 1);
      setVoted(true);
      setJustVoted(true);
      setTimeout(() => setJustVoted(false), 500);
      toast.success(`Vote sent · ${formatUsdc(LIKE_FEE_USDC)} USDC`);
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setBusy(false);
    }
  };

  const label = count > 0 ? String(count) : "Vote";

  if (compact) {
    return (
      <button
        type="button"
        className={`btn-action px-2.5 py-1 text-xs uppercase tracking-wide ${
          voted ? "btn-action-active" : ""
        } ${justVoted ? "btn-action-success" : ""}`}
        disabled={busy || voted}
        onClick={vote}
        title={`Vote · $${formatUsdc(LIKE_FEE_USDC)} USDC to author`}
      >
        <ThumbsUp size={12} fill={voted ? "currentColor" : "none"} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn-action ${voted ? "btn-action-active" : ""} ${justVoted ? "btn-action-success" : ""}`}
      disabled={busy || voted}
      onClick={vote}
      title={`Vote · $${formatUsdc(LIKE_FEE_USDC)} USDC to author`}
    >
      <ThumbsUp size={14} fill={voted ? "currentColor" : "none"} />
      {label}
    </button>
  );
}
