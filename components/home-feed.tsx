"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContentCard, FeedSkeleton } from "@/components/content-card";
import { BattleCard } from "@/components/battle-card";
import { HeroSection } from "@/components/hero-section";
import { useApp } from "@/components/app-provider";
import { useWeb3 } from "@/components/web3-provider";
import { getCachedUserPosts, syncCachedPostsToServer } from "@/lib/post-cache";
import { useLoginModal } from "@/components/login-modal-context";
import type { ContentItem } from "@/lib/content-store";
import type { Duel } from "@/lib/duel-store";

type EnrichedDuel = {
  duel: Duel;
  contentA: ContentItem | null;
  contentB: ContentItem | null;
  scoreA: number;
  scoreB: number;
};

export function HomeFeed() {
  const { profile } = useApp();
  const { isConnected, account } = useWeb3();
  const { showLogin } = useLoginModal();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeDuels, setActiveDuels] = useState<EnrichedDuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadFeed = async (off = 0, append = false) => {
    const res = await fetch(`/api/feed?offset=${off}&limit=10`);
    const data = await res.json();
    if (append) {
      setItems((prev) => [...prev, ...(data.items ?? [])]);
    } else {
      setItems(data.items ?? []);
      setActiveDuels(data.activeDuels ?? []);
    }
  };

  useEffect(() => {
    loadFeed(0).finally(() => setLoading(false));
    fetch("/api/duels/settle", { method: "POST" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isConnected || !account.address) return;
    const cached = getCachedUserPosts(account.address);
    if (cached.length > 0) {
      syncCachedPostsToServer(account.address, cached).catch(() => undefined);
    }
  }, [isConnected, account.address]);

  const loadMore = async () => {
    const next = offset + 10;
    await loadFeed(next, true);
    setOffset(next);
  };

  const duelForContent = (id: string) => {
    const hit = activeDuels.find(
      (d) => d.duel.contentAId === id || d.duel.contentBId === id,
    );
    return hit ?? null;
  };

  return (
    <div className="space-y-6">
      <HeroSection />

      {!isConnected ? (
        <div className="card hidden border-penny-gold/30 bg-penny-gold/5 md:block">
          <p className="font-medium">Get started</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Log in with passkey → pick @username → fund wallet → publish.
          </p>
          <button type="button" className="btn-primary mt-3" onClick={showLogin}>
            Log in / Register
          </button>
        </div>
      ) : null}

      {activeDuels.length > 0 && (
        <div className="space-y-3">
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
              onVote={({ scoreA: a, scoreB: b }) => {
                setActiveDuels((prev) =>
                  prev.map((row) =>
                    row.duel.id === duel.id ? { ...row, scoreA: a, scoreB: b } : row,
                  ),
                );
              }}
            />
          ))}
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-display text-2xl font-bold leading-tight text-[var(--heading)] sm:text-3xl">
          Arena Feed
        </h2>
        <p className="text-section-title text-[var(--muted)]">Latest posts</p>
      </div>

      {loading ? (
        <>
          <FeedSkeleton />
          <FeedSkeleton />
        </>
      ) : items.length === 0 ? (
        <div className="card text-center">
          <p className="text-[var(--muted)]">No posts yet — be the first on a topic.</p>
          {profile?.username && (
            <Link href="/compose" className="btn-primary mt-3 inline-block">
              Create first post
            </Link>
          )}
        </div>
      ) : (
        items.map((item) => {
          const d = duelForContent(item.id);
          return (
            <ContentCard
              key={item.id}
              item={item}
              duel={d?.duel}
              duelContentA={d?.contentA}
              duelContentB={d?.contentB}
              duelScoreA={d?.scoreA}
              duelScoreB={d?.scoreB}
              onVote={({ scoreA, scoreB }) => {
                if (!d) return;
                setActiveDuels((prev) =>
                  prev.map((row) =>
                    row.duel.id === d.duel.id ? { ...row, scoreA, scoreB } : row,
                  ),
                );
              }}
            />
          );
        })
      )}

      {!loading && items.length >= 10 && (
        <button type="button" className="btn-secondary w-full" onClick={loadMore}>
          Load more
        </button>
      )}
    </div>
  );
}
