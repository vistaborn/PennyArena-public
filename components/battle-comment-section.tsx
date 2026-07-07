"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { UserAvatar } from "@/components/user-avatar";
import { timeAgo } from "@/lib/utils";
import { formatDuelDurationLabel } from "@/lib/pricing";

type DuelComment = {
  id: string;
  body: string;
  authorUsername: string;
  authorAvatar?: string | null;
  createdAt: string;
};

export function BattleCommentSection({
  duelId,
  duelStatus,
}: {
  duelId: string;
  duelStatus?: string;
}) {
  const { isConnected, account } = useWeb3();
  const { profile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [comments, setComments] = useState<DuelComment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`/api/duels/${duelId}/comments`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]));
  };

  useEffect(() => {
    load();
  }, [duelId]);

  const submit = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/duels/${duelId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Comment failed");
      setBody("");
      setComments((c) => [...c, data.comment]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setBusy(false);
    }
  };

  const closed = duelStatus === "settled" || duelStatus === "refunded";

  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold">Battle comments ({comments.length})</p>
      {closed ? (
        <p className="text-xs text-[var(--muted)]">Battle ended — comments are closed.</p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Comments stay open while voting runs ({formatDuelDurationLabel()} per battle).
        </p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="rounded-xl bg-white/5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <UserAvatar
              username={c.authorUsername}
              avatarDataUrl={c.authorAvatar}
              size={28}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Link
                  href={`/u/${c.authorUsername}`}
                  className="font-semibold text-[var(--fg)] hover:underline"
                >
                  @{c.authorUsername}
                </Link>
                <span>· {timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        </div>
      ))}
      {!closed && (
        <>
      <textarea
        className="input min-h-[72px] text-sm"
        placeholder={profile?.username ? "Comment on this battle…" : "Log in to comment"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={!body.trim()}
          onClick={() => setBody("")}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn-primary flex-1 text-sm"
          disabled={busy || !body.trim()}
          onClick={submit}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
