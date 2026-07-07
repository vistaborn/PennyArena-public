"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { ContentCard } from "@/components/content-card";
import type { ContentItem } from "@/lib/content-store";

type BookmarkRow = { bookmarkedAt: string; item: ContentItem };

export default function BookmarksPage() {
  const { isConnected, account } = useWeb3();
  const { profile } = useApp();
  const [items, setItems] = useState<BookmarkRow[]>([]);

  useEffect(() => {
    if (!isConnected || !account.address) return;
    fetch(`/api/bookmarks?address=${encodeURIComponent(account.address)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [isConnected, account.address]);

  if (!isConnected) {
    return (
      <div className="card">
        <p>Log in to view bookmarks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold">Bookmarks</h1>
        <p className="text-sm text-[var(--muted)]">
          Saved posts for @{profile?.username ?? "you"}
        </p>
        {profile && (
          <Link href={`/u/${profile.username}`} className="mt-2 inline-block text-sm text-penny-mint hover:underline">
            ← Back to profile
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="card text-sm text-[var(--muted)]">No bookmarks yet.</div>
      ) : (
        items.map((row) => (
          <ContentCard key={row.item.id} item={row.item} compact />
        ))
      )}
    </div>
  );
}
