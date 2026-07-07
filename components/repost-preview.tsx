"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContentItem } from "@/lib/content-store";
import { UserAvatar } from "@/components/user-avatar";
import { TopicLabel } from "@/components/topic-label";

export function RepostPreview({ originalId }: { originalId: string }) {
  const [original, setOriginal] = useState<ContentItem | null>(null);

  useEffect(() => {
    fetch(`/api/content/${originalId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOriginal(d?.item ?? null))
      .catch(() => setOriginal(null));
  }, [originalId]);

  if (!original) {
    return (
      <Link
        href={`/post/${originalId}`}
        className="block rounded-xl border border-[var(--border)] bg-white/5 p-3 text-sm text-penny-mint hover:border-penny-gold/30"
      >
        View original post →
      </Link>
    );
  }

  return (
    <Link
      href={`/post/${original.id}`}
      className="block rounded-xl border border-[var(--border)] bg-white/5 p-3 transition hover:border-penny-gold/30"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <UserAvatar username={original.authorUsername} size={22} />
        <span className="font-semibold text-penny-gold">@{original.authorUsername}</span>
        <TopicLabel slug={original.topicSlug} iconSize={12} />
      </div>
      {original.title && <p className="mt-1 text-sm font-medium line-clamp-1">{original.title}</p>}
      <p className="mt-0.5 line-clamp-3 break-words text-sm text-[var(--muted)] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {original.body}
      </p>
      {original.mediaUrl && original.type !== "audio" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={original.mediaUrl}
          alt=""
          className="mt-2 max-h-32 w-full rounded-lg object-cover"
        />
      )}
    </Link>
  );
}
