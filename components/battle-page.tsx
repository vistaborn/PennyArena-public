"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Swords, Shield, Zap } from "lucide-react";
import { isOfficialAddress } from "@/lib/official-account";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { BattleCard, BattlePostPicker, OutgoingChallengeCard } from "@/components/battle-card";
import { BattleResultModal, type BattleNotification } from "@/components/battle-result-modal";
import type { ContentItem } from "@/lib/content-store";
import type { Duel, DuelVote } from "@/lib/duel-store";
import {
  DUEL_ENTRY_FEE_USDC,
  formatUsdc,
  formatDuelDurationLabel,
  formatDuelDurationShort,
  getTreasuryAddress,
  VOTE_UNIT_USDC,
} from "@/lib/pricing";
import {
  getCachedUserPosts,
  mergePosts,
  syncCachedPostsToServer,
  cacheUserPost,
} from "@/lib/post-cache";
import { readResponseJson } from "@/lib/utils";

type ActiveDuelRow = {
  duel: Duel;
  contentA: ContentItem | null;
  contentB: ContentItem | null;
  scoreA: number;
  scoreB: number;
};

type PendingPayload = {
  incoming: Duel[];
  outgoing: Duel[];
};

type DuelPreview = {
  contentA: ContentItem | null;
  contentB: ContentItem | null;
};

export function BattlePageClient() {
  const searchParams = useSearchParams();
  const preselectPost = searchParams.get("post");

  const { account, isConnected, sendUSDC } = useWeb3();
  const { profile, refreshProfile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();

  const [myPosts, setMyPosts] = useState<ContentItem[]>([]);
  const [topicPosts, setTopicPosts] = useState<ContentItem[]>([]);
  const [activeDuels, setActiveDuels] = useState<ActiveDuelRow[]>([]);
  const [pending, setPending] = useState<PendingPayload>({ incoming: [], outgoing: [] });
  const [outgoingPreview, setOutgoingPreview] = useState<Record<string, DuelPreview>>({});
  const [myPostId, setMyPostId] = useState<string | null>(preselectPost);
  const [rivalPostId, setRivalPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BattleNotification[]>([]);
  const [pendingResult, setPendingResult] = useState<BattleNotification | null>(null);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  const load = useCallback(async () => {
    const tasks: Promise<void>[] = [
      (async () => {
        const r = await fetch("/api/duels");
        const d = await readResponseJson<{ active?: ActiveDuelRow[] }>(r);
        if (r.ok && d) setActiveDuels(d.active ?? []);
      })(),
    ];

    if (account.address) {
      const cached = getCachedUserPosts(account.address);
      tasks.push(
        (async () => {
          await syncCachedPostsToServer(account.address!, cached);
          const res = await fetch(
            `/api/content?author=${encodeURIComponent(account.address!)}&limit=50`,
          );
          const d = await readResponseJson<{ items?: ContentItem[] }>(res);
          if (res.ok && d) setMyPosts(mergePosts(d.items ?? [], cached));
        })(),
        (async () => {
          const r = await fetch(
            `/api/duels/pending?address=${encodeURIComponent(account.address!)}`,
            { credentials: "include" },
          );
          const d = await readResponseJson<PendingPayload>(r);
          if (!r.ok || !d) return;
          const incoming = d.incoming ?? [];
          const outgoing = d.outgoing ?? [];
          setPending({ incoming, outgoing });
          const previews: Record<string, DuelPreview> = {};
          await Promise.all(
            outgoing.map(async (duel: Duel) => {
              const res = await fetch(`/api/duels/${duel.id}`);
              if (res.ok) {
                const data = await readResponseJson<{
                  contentA?: ContentItem | null;
                  contentB?: ContentItem | null;
                }>(res);
                if (data) {
                  previews[duel.id] = {
                    contentA: data.contentA ?? null,
                    contentB: data.contentB ?? null,
                  };
                }
              }
            }),
          );
          setOutgoingPreview(previews);
        })(),
        (async () => {
          const r = await fetch(
            `/api/duels/notifications?address=${encodeURIComponent(account.address!)}`,
            { cache: "no-store", credentials: "include" },
          );
          const d = await readResponseJson<{
            history?: Array<{
              duel: Duel;
              contentA: ContentItem | null;
              contentB: ContentItem | null;
              outcome: BattleNotification["outcome"];
              votes?: DuelVote[];
              scoreA?: number;
              scoreB?: number;
            }>;
            pending?: Array<{
              duel: Duel;
              contentA: ContentItem | null;
              contentB: ContentItem | null;
              outcome: BattleNotification["outcome"];
              votes?: DuelVote[];
            }>;
          }>(r);
          if (!r.ok || !d) return;
          const hist = (d.history ?? []).map((row) => ({
            duel: row.duel,
            contentA: row.contentA,
            contentB: row.contentB,
            outcome: row.outcome,
            votes: row.votes ?? [],
            scoreA: row.scoreA,
            scoreB: row.scoreB,
          }));
          setHistory(hist);
          const pendingRows = d.pending ?? [];
          setUnclaimedCount(pendingRows.length);
          if (pendingRows.length > 0) {
            const first = pendingRows[0];
            setPendingResult({
              duel: first.duel,
              contentA: first.contentA,
              contentB: first.contentB,
              outcome: first.outcome,
              votes: first.votes ?? [],
            });
          } else {
            setPendingResult(null);
          }
        })(),
      );
    }

    await Promise.all(tasks);
    setLoading(false);
  }, [account.address]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (preselectPost) setMyPostId(preselectPost);
  }, [preselectPost]);

  useEffect(() => {
    if (!preselectPost || !account.address) return;
    fetch(`/api/content/${preselectPost}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const item = d?.item as ContentItem | undefined;
        if (item?.authorAddress?.toLowerCase() === account.address!.toLowerCase()) {
          cacheUserPost(account.address!, item);
          setMyPosts((prev) => mergePosts(prev, [item]));
        }
      })
      .catch(() => undefined);
  }, [preselectPost, account.address]);

  const myPost = useMemo(
    () => myPosts.find((p) => p.id === myPostId) ?? null,
    [myPosts, myPostId],
  );

  useEffect(() => {
    if (!myPost) {
      setTopicPosts([]);
      setRivalPostId(null);
      return;
    }
    Promise.all([
      fetch(`/api/content?topic=${encodeURIComponent(myPost.topicSlug)}&limit=80`),
      fetch(`/api/feed?limit=50`),
    ])
      .then(async ([topicRes, feedRes]) => {
        const topicData = await topicRes.json();
        const feedData = await feedRes.json();
        const topicItems: ContentItem[] = topicData.items ?? [];
        const feedItems: ContentItem[] = (feedData.items ?? []).filter(
          (p: ContentItem) => p.topicSlug === myPost.topicSlug,
        );
        const merged = mergePosts(topicItems, feedItems);
        setTopicPosts(
          merged.filter(
            (p) =>
              p.id !== myPost.id &&
              p.authorAddress.toLowerCase() !== myPost.authorAddress.toLowerCase() &&
              !p.repostOfId &&
              !isOfficialAddress(p.authorAddress),
          ),
        );
      })
      .catch(() => setTopicPosts([]));
    setRivalPostId(null);
  }, [myPost]);

  const availableMyPosts = myPosts.filter(
    (p) => !p.repostOfId && !isOfficialAddress(p.authorAddress),
  );

  const startBattle = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    if (!myPostId || !rivalPostId) {
      toast.error("Select your post and an opponent post");
      return;
    }
    const treasury = getTreasuryAddress();
    if (!treasury) {
      toast.error("Treasury not configured");
      return;
    }

    setBusy(true);
    try {
      const cached = getCachedUserPosts(account.address);
      await syncCachedPostsToServer(account.address, cached);

      const txHash = await sendUSDC(treasury, DUEL_ENTRY_FEE_USDC);
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          contentAId: myPostId,
          contentBId: rivalPostId,
          txHash,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Challenge failed");
      toast.success("Battle sent! Waiting for opponent to accept.");
      setMyPostId(null);
      setRivalPostId(null);
      await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start battle");
    } finally {
      setBusy(false);
    }
  };

  const acceptBattle = async (duelId: string) => {
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
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Accept failed");
      toast.success(`Battle is live for ${formatDuelDurationLabel()}!`);
      await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  };

  const declineBattle = async (duelId: string) => {
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
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Decline failed");
      toast.success("Battle declined — entry fee returned to challenger");
      await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  const acknowledgeResult = async (claimed: boolean) => {
    if (!account.address || !pendingResult) return;
    await fetch("/api/duels/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        address: account.address,
        duelIds: [pendingResult.duel.id],
      }),
    });
    setPendingResult(null);
    if (claimed) await refreshProfile();
    await load();
  };

  const hasLive = activeDuels.length > 0;
  const hasUnclaimed = unclaimedCount > 0;
  const createFirst = !hasLive && !hasUnclaimed;
  const canCreate = isConnected && Boolean(profile?.username);

  const createBattleSection = canCreate ? (
    <section className="card space-y-5">
      <h2 className="text-lg font-semibold">Start a new battle</h2>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading your posts…</p>
      ) : (
        <>
          <BattlePostPicker
            label="Your post"
            posts={availableMyPosts}
            selectedId={myPostId}
            onSelect={setMyPostId}
            emptyText="You have no posts yet. Publish something first."
          />
          {myPost && (
            <BattlePostPicker
              label={`Opponent on ${myPost.topicSlug}`}
              posts={topicPosts}
              selectedId={rivalPostId}
              onSelect={setRivalPostId}
              emptyText="No other authors on this topic yet."
            />
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || !myPostId || !rivalPostId}
            onClick={startBattle}
          >
            Send challenge · ${formatUsdc(DUEL_ENTRY_FEE_USDC)} entry
          </button>
        </>
      )}
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      {pendingResult?.outcome && (
        <BattleResultModal
          notification={pendingResult}
          onClose={() => setPendingResult(null)}
          onAcknowledge={acknowledgeResult}
        />
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Swords className="text-penny-mint" size={28} />
          <h1 className="text-2xl font-bold">Battle Arena</h1>
        </div>
        <div className="space-y-0.5 text-sm leading-snug text-[var(--muted)]">
          <p>
            Pick your post vs someone else&apos;s on the same topic. Each side pays{" "}
            ${formatUsdc(DUEL_ENTRY_FEE_USDC)} to enter.
          </p>
          <p>
            After approval the battle runs {formatDuelDurationLabel()} on the home feed: one vote per
            person (${formatUsdc(VOTE_UNIT_USDC)}).
          </p>
          <p>
            Winner takes the loser&apos;s entry: 50% to author, 50% split among winning voters (+
            vote refunds).
          </p>
        </div>
      </section>

      {activeDuels.length > 0 && (
        <section className="space-y-3">
          {activeDuels.map(({ duel, contentA, contentB, scoreA, scoreB }) => (
            <BattleCard
              key={duel.id}
              duel={duel}
              contentA={contentA}
              contentB={contentB}
              scoreA={scoreA}
              scoreB={scoreB}
              feedMode
              showLink={false}
              viewerAddress={account.address}
              onVote={({ scoreA: a, scoreB: b }) => {
                setActiveDuels((prev) =>
                  prev.map((row) =>
                    row.duel.id === duel.id ? { ...row, scoreA: a, scoreB: b } : row,
                  ),
                );
              }}
            />
          ))}
        </section>
      )}

      {createFirst && createBattleSection}

      {pending.incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-penny-coral">
            Incoming challenges ({pending.incoming.length})
          </h2>
          {pending.incoming.map((d) => (
            <div key={d.id} className="card space-y-3 border-penny-coral/30">
              <p className="text-sm">
                Someone wants to battle your post on{" "}
                <span className="text-penny-gold">{d.topicSlug}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/battle/${d.id}`} className="btn-secondary text-sm">
                  Preview
                </Link>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy}
                  onClick={() => acceptBattle(d.id)}
                >
                  Accept · ${formatUsdc(DUEL_ENTRY_FEE_USDC)}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm text-penny-coral"
                  disabled={busy}
                  onClick={() => declineBattle(d.id)}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {pending.outgoing.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-penny-gold/30 bg-penny-gold/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-penny-gold">
              Waiting for acceptance
            </h2>
            <span className="rounded-full bg-penny-gold/20 px-2.5 py-0.5 text-xs font-bold text-penny-gold">
              {pending.outgoing.length}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Your challenge is sent — opponent must accept and pay entry to start the{" "}
            {formatDuelDurationLabel()} battle.
          </p>
          <div className="space-y-2">
            {pending.outgoing.map((d) => (
              <div key={d.id} className="space-y-2">
                <OutgoingChallengeCard
                  duel={d}
                  contentA={outgoingPreview[d.id]?.contentA}
                  contentB={outgoingPreview[d.id]?.contentB}
                />
                <button
                  type="button"
                  className="btn-secondary w-full text-sm text-penny-coral"
                  disabled={busy}
                  onClick={() => declineBattle(d.id)}
                >
                  Cancel challenge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!createFirst && createBattleSection}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex gap-3 border-penny-gold/20">
          <Zap className="shrink-0 text-penny-mint" size={20} />
          <div>
            <p className="text-sm font-semibold">1. Challenge</p>
            <p className="text-xs text-[var(--muted)]">Pay entry & pick opponent post</p>
          </div>
        </div>
        <div className="card flex gap-3 border-penny-gold/20">
          <Shield className="shrink-0 text-penny-mint" size={20} />
          <div>
            <p className="text-sm font-semibold">2. Accept</p>
            <p className="text-xs text-[var(--muted)]">Opponent pays entry to start</p>
          </div>
        </div>
        <div className="card flex gap-3 border-penny-gold/20">
          <Swords className="shrink-0 text-penny-mint" size={20} />
          <div>
            <p className="text-sm font-semibold">3. Vote</p>
            <p className="text-xs text-[var(--muted)]">
              Community picks winner in {formatDuelDurationShort()}
            </p>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted)]">Battle history</h2>
          {history.slice(0, 8).map((h) => (
            <BattleCard
              key={h.duel.id}
              duel={h.duel}
              contentA={h.contentA}
              contentB={h.contentB}
              scoreA={h.scoreA}
              scoreB={h.scoreB}
              votes={h.votes}
              historyOnly
              showLink={false}
              viewerAddress={account.address}
            />
          ))}
        </section>
      )}

      {!isConnected ? (
        <div className="card text-center">
          <p className="text-sm text-[var(--muted)]">Log in to start or accept a battle.</p>
          <button type="button" className="btn-primary mt-3" onClick={showLogin}>
            Log in
          </button>
        </div>
      ) : !canCreate ? (
        <div className="card text-center">
          <p className="text-sm text-[var(--muted)]">Set up your profile before battling.</p>
          <Link href="/me" className="btn-primary mt-3 inline-block">
            Complete profile
          </Link>
        </div>
      ) : null}
    </div>
  );
}
