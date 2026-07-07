"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContentCard, FeedSkeleton } from "@/components/content-card";
import type { ContentItem } from "@/lib/content-store";
import type { Duel } from "@/lib/duel-store";

export function TopicFeed({ topicSlug }: { topicSlug: string }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [contentRes, duelsRes] = await Promise.all([
        fetch(`/api/content?topic=${encodeURIComponent(topicSlug)}`),
        fetch("/api/duels"),
      ]);
      if (cancelled) return;
      const contentData = await contentRes.json();
      const duelsData = await duelsRes.json();
      setItems(contentData.items ?? []);
      setDuels(duelsData.active ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [topicSlug]);

  const duelForContent = (id: string) =>
    duels.find((d) => d.contentAId === id || d.contentBId === id) ?? null;

  if (loading) {
    return (
      <>
        <FeedSkeleton />
        <FeedSkeleton />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-[var(--muted)]">No posts in this topic yet.</p>
        <Link href="/compose" className="btn-primary mt-3 inline-block">
          Be the first to post
        </Link>
      </div>
    );
  }

  return (
    <>
      {items.map((item) => (
        <ContentCard key={item.id} item={item} duel={duelForContent(item.id)} />
      ))}
    </>
  );
}
