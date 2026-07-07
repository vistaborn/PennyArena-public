"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { timeAgo } from "@/lib/utils";
import type { Comment } from "@/lib/comment-store";

const PREVIEW = 2;

export function FeedComments({ contentId }: { contentId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/content/${contentId}/comments`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]));
  }, [contentId]);

  if (comments.length === 0) return null;

  const visible = expanded ? comments : comments.slice(0, PREVIEW);

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      {visible.map((c) => (
        <div key={c.id} className="flex gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
          <UserAvatar username={c.authorUsername} size={24} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Link
                href={`/u/${c.authorUsername}`}
                className="font-semibold text-penny-gold hover:underline"
              >
                @{c.authorUsername}
              </Link>
              <span>· {timeAgo(c.createdAt)}</span>
            </div>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap">{c.body}</p>
          </div>
        </div>
      ))}
      {comments.length > PREVIEW && !expanded && (
        <button
          type="button"
          className="text-xs font-medium text-penny-mint hover:underline"
          onClick={() => setExpanded(true)}
        >
          Show more ({comments.length - PREVIEW} more)
        </button>
      )}
      <Link
        href={`/post/${contentId}`}
        className="inline-block text-xs text-[var(--muted)] hover:text-penny-mint"
      >
        View all comments →
      </Link>
    </div>
  );
}
