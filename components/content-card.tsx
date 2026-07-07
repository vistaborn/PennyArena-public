"use client";

import Link from "next/link";
import { Swords, Clock, BadgeCheck, Trash2 } from "lucide-react";
import type { ContentItem } from "@/lib/content-store";
import type { Duel } from "@/lib/duel-store";
import { TopicLabel } from "@/components/topic-label";
import { formatUsdc, contentEarningsUsdc } from "@/lib/pricing";
import { displayCreatedAt, timeAgo } from "@/lib/utils";
import { isOfficialAddress, isOfficialUsername, OFFICIAL_WALLET_ADDRESS } from "@/lib/official-account";
import { TipButton } from "@/components/tip-button";
import { LikeButton } from "@/components/like-button";
import { ShareMenu } from "@/components/share-menu";
import { SavePostButton } from "@/components/save-post-button";
import { RepostPreview } from "@/components/repost-preview";
import { LinkPreview } from "@/components/link-preview";
import { VotePanel } from "@/components/vote-panel";
import { FeedComments } from "@/components/feed-comments";
import { UsdcIcon } from "@/components/brand-icons";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { useWeb3 } from "@/components/web3-provider";
import { useToast } from "@/components/toast-provider";
import { removeCachedPost } from "@/lib/post-cache";

export function ContentCard({
  item,
  duel,
  duelContentA,
  duelContentB,
  duelScoreA,
  duelScoreB,
  compact,
  onDeleted,
  onVote,
}: {
  item: ContentItem;
  duel?: Duel | null;
  duelContentA?: ContentItem | null;
  duelContentB?: ContentItem | null;
  duelScoreA?: number;
  duelScoreB?: number;
  compact?: boolean;
  onDeleted?: (contentId: string) => void;
  onVote?: (scores: { scoreA: number; scoreB: number }) => void;
}) {
  const { account } = useWeb3();
  const toast = useToast();
  const official = isOfficialAddress(item.authorAddress) || isOfficialUsername(item.authorUsername);
  const followTargetAddress = official ? OFFICIAL_WALLET_ADDRESS : item.authorAddress;
  const postHref = `/post/${item.id}`;
  const isOwn =
    Boolean(
      account.address &&
        item.authorAddress &&
        account.address.toLowerCase() === item.authorAddress.toLowerCase(),
    );
  const inOpenBattle =
    duel && (duel.status === "pending" || duel.status === "active");

  const deletePost = async () => {
    if (!account.address) return;
    if (!confirm("Delete this post permanently?")) return;
    try {
      const res = await fetch(`/api/content/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      removeCachedPost(account.address, item.id);
      toast.success("Post deleted");
      onDeleted?.(item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <article className="card relative min-w-0 space-y-3">
      <div className="flex items-start gap-3">
        <Link href={`/u/${item.authorUsername}`} className="shrink-0">
          <UserAvatar username={item.authorUsername} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <Link href={`/u/${item.authorUsername}`} className="font-semibold hover:underline">
              @{item.authorUsername}
            </Link>
            {official && (
              <BadgeCheck size={14} className="-mt-px shrink-0 text-penny-gold" aria-label="Official" />
            )}
            <span className="text-[var(--muted)]">
              · {timeAgo(displayCreatedAt(item))}
            </span>
          </div>
          <Link
            href={`/topic/${item.topicSlug}`}
            className="mt-0.5 inline-block text-xs text-penny-mint"
          >
            <TopicLabel slug={item.topicSlug} iconSize={13} />
          </Link>
          {!isOwn && followTargetAddress && (
            <div className="mt-1.5">
              <FollowButton
                targetAddress={followTargetAddress}
                targetUsername={item.authorUsername}
                compact
              />
            </div>
          )}
        </div>
        <TipButton
          contentId={item.id}
          authorAddress={item.authorAddress}
          compact
        />
      </div>

      {!item.repostOfId && (
        <Link href={postHref} className="block min-w-0 hover:opacity-95">
          {item.title && <h3 className="break-words font-semibold">{item.title}</h3>}
          {item.body && (
            <p
              className={`mt-1 break-words whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] ${compact ? "line-clamp-4" : ""}`}
            >
              {item.body}
            </p>
          )}
        </Link>
      )}

      {item.repostOfId && (
        <p className="text-xs font-medium text-[var(--muted)]">Reposted to profile</p>
      )}

      {item.linkUrl && !item.linkUrl.startsWith("/post/") && (
        <LinkPreview
          url={item.linkUrl}
          title={item.title || undefined}
          image={item.linkPreviewImage}
        />
      )}

      {item.repostOfId && (
        <RepostPreview originalId={item.repostOfId} />
      )}

      {!item.repostOfId && item.mediaUrl && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          {item.type === "video" ? (
            <video src={item.mediaUrl} controls className="max-h-80 w-full" />
          ) : item.type === "audio" ? (
            <audio src={item.mediaUrl} controls className="w-full p-3" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.mediaUrl} alt="" className="max-h-96 w-full object-cover" />
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-penny-mint">
        <UsdcIcon size={16} />
        <span className="font-medium">{formatUsdc(contentEarningsUsdc(item))}</span>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
        <LikeButton
          contentId={item.id}
          authorAddress={item.authorAddress}
          initialCount={item.likeCount}
        />
        <ShareMenu contentId={item.id} title={item.title || item.body.slice(0, 80)} />
        {!item.repostOfId && <SavePostButton contentId={item.id} />}
        <Link href={postHref} className="btn-action px-3 py-1.5 text-sm">
          Comment
        </Link>
        {isOwn && !official && !inOpenBattle && !item.repostOfId && (
          <Link
            href={`/battle?post=${item.id}`}
            className="btn-action flex items-center gap-1 px-3 py-1.5 text-sm text-penny-gold"
          >
            <Swords size={14} />
            Battle
          </Link>
        )}
        {duel && duel.status === "active" && (
          <Link
            href={`/battle/${duel.id}`}
            className="flex items-center gap-1 text-xs text-penny-gold hover:underline"
          >
            <Clock size={12} /> Battle live
          </Link>
        )}
        {duel && duel.status === "settled" && (
          <Link
            href={`/battle/${duel.id}`}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:underline"
          >
            <Swords size={12} /> Battle ended
          </Link>
        )}
        {isOwn && !official && !inOpenBattle && (
          <button
            type="button"
            className="btn-action ml-auto border-penny-coral/30 px-2.5 py-1.5 text-sm text-penny-coral hover:border-penny-coral/50 hover:bg-penny-coral/10"
            onClick={deletePost}
            title="Delete post"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <FeedComments contentId={item.id} />

      {duel &&
        duel.status === "active" &&
        (duel.contentAId === item.id || duel.contentBId === item.id) && (
          <VotePanel
            duel={duel}
            contentA={duelContentA}
            contentB={duelContentB}
            scoreA={duelScoreA}
            scoreB={duelScoreB}
            highlightContentId={item.id}
            onVoted={onVote}
          />
        )}
    </article>
  );
}

export function FeedSkeleton() {
  return (
    <div className="card animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="h-20 rounded bg-white/10" />
    </div>
  );
}
