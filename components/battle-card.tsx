"use client";

import Link from "next/link";
import { Swords, Clock, Trophy, ChevronRight, Hourglass, Send } from "lucide-react";
import type { ContentItem } from "@/lib/content-store";
import type { Duel, DuelVote } from "@/lib/duel-store";
import { formatUsdc, formatDuelCountdown } from "@/lib/pricing";
import { computeDuelPayouts, getUserDuelOutcome } from "@/lib/duel-payouts";
import { TopicLabel } from "@/components/topic-label";
import { VotePanel } from "@/components/vote-panel";
import { LinkPreview } from "@/components/link-preview";
import { useLiveCountdown } from "@/lib/use-live-countdown";
import { UsdcIcon } from "@/components/brand-icons";

type BattleSide = {
  content: ContentItem | null;
  label: string;
  score?: number;
};

function duelVoteScores(duel: Duel, votes: DuelVote[]) {
  return {
    scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
    scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
  };
}

function BattleHistoryCard({
  duel,
  contentA,
  contentB,
  scoreA,
  scoreB,
  outcome,
}: {
  duel: Duel;
  contentA?: ContentItem | null;
  contentB?: ContentItem | null;
  scoreA: number;
  scoreB: number;
  outcome: ReturnType<typeof getUserDuelOutcome>;
}) {
  const labelA = contentA ? `@${contentA.authorUsername}` : "Side A";
  const labelB = contentB ? `@${contentB.authorUsername}` : "Side B";

  let resultLabel = "Draw";
  let resultClass = "border-penny-gold/50 bg-penny-gold/15 text-penny-gold";
  if (duel.winnerContentId === duel.contentAId) {
    resultLabel = `${labelA} won`;
    resultClass = "border-penny-mint/50 bg-penny-mint/15 text-penny-mint";
  } else if (duel.winnerContentId === duel.contentBId) {
    resultLabel = `${labelB} won`;
    resultClass = "border-penny-mint/50 bg-penny-mint/15 text-penny-mint";
  }

  if (outcome) {
    if (outcome.role === "loser_author" || outcome.role === "losing_voter") {
      resultLabel = "You lost";
      resultClass = "border-penny-coral/50 bg-penny-coral/15 text-penny-coral";
    } else if (outcome.role === "winner_author" || outcome.role === "winning_voter") {
      resultLabel = "You won";
      resultClass = "border-penny-mint/50 bg-penny-mint/15 text-penny-mint";
    } else if (outcome.role === "tie_author" || outcome.role === "tie_voter") {
      resultLabel = "Draw — refund";
      resultClass = "border-penny-gold/50 bg-penny-gold/15 text-penny-gold";
    }
  }

  return (
    <div className="card space-y-3 border-[var(--border)] bg-white/[0.02] py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {labelA} <span className="text-[var(--muted)]">vs</span> {labelB}
          </p>
          <p className="text-xs text-[var(--muted)]">
            <TopicLabel slug={duel.topicSlug} iconSize={12} /> · {scoreA}:{scoreB} votes
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${resultClass}`}>
          {resultLabel}
        </span>
      </div>
      <Link href={`/battle/${duel.id}`} className="btn-secondary flex w-full items-center justify-center text-sm">
        View full results
      </Link>
    </div>
  );
}

export function BattleCard({
  duel,
  contentA,
  contentB,
  scoreA = 0,
  scoreB = 0,
  compact,
  historyOnly,
  showLink = true,
  viewerAddress,
  votes = [],
  onVote,
  feedMode,
}: {
  duel: Duel;
  contentA?: ContentItem | null;
  contentB?: ContentItem | null;
  scoreA?: number;
  scoreB?: number;
  compact?: boolean;
  historyOnly?: boolean;
  showLink?: boolean;
  viewerAddress?: string | null;
  votes?: DuelVote[];
  onVote?: (scores: { scoreA: number; scoreB: number }) => void;
  /** Home feed: hide static preview row; voting panel only */
  feedMode?: boolean;
}) {
  const { hours, mins, secs, expired } = useLiveCountdown(
    duel.status === "active" ? duel.endsAt : null,
  );
  const isActive = duel.status === "active" && !expired;
  const isPending = duel.status === "pending";
  const isSettled = duel.status === "settled";
  const outcome =
    historyOnly ? null : getUserDuelOutcome(viewerAddress, duel, votes, contentA ?? null, contentB ?? null);
  const payoutMath = isSettled && !historyOnly ? computeDuelPayouts(duel, votes) : null;
  const resolvedScoreA = votes.length > 0 ? duelVoteScores(duel, votes).scoreA : scoreA;
  const resolvedScoreB = votes.length > 0 ? duelVoteScores(duel, votes).scoreB : scoreB;

  if (historyOnly) {
    return (
      <BattleHistoryCard
        duel={duel}
        contentA={contentA}
        contentB={contentB}
        scoreA={resolvedScoreA}
        scoreB={resolvedScoreB}
        outcome={getUserDuelOutcome(viewerAddress, duel, votes, contentA ?? null, contentB ?? null)}
      />
    );
  }

  const sideA: BattleSide = {
    content: contentA ?? null,
    label: contentA ? `@${contentA.authorUsername}` : "Side A",
    score: scoreA,
  };
  const sideB: BattleSide = {
    content: contentB ?? null,
    label: contentB ? `@${contentB.authorUsername}` : "Side B",
    score: scoreB,
  };

  return (
    <div className="card battle-card space-y-4 border-penny-mint/25 bg-gradient-to-br from-white/[0.07] via-penny-mint/[0.08] to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-penny-gold">
          <Swords size={18} />
          {isPending && "Battle invite"}
          {isActive && "Live battle"}
          {isSettled && "Battle ended"}
          {duel.status === "refunded" && "Battle refunded"}
        </div>
        {isActive && (
          <span className="flex items-center gap-1 rounded-full bg-penny-coral/20 px-2.5 py-0.5 text-xs font-medium text-penny-coral tabular-nums">
            <Clock size={12} />
            {formatDuelCountdown(hours, mins, secs)}
          </span>
        )}
        {isSettled && duel.winnerContentId && (
          <span className="flex items-center gap-1 text-xs text-penny-mint">
            <Trophy size={12} />
            Winner picked
          </span>
        )}
        {isSettled && !duel.winnerContentId && (
          <span className="flex items-center gap-1 text-xs text-penny-gold">
            Draw — stakes returned
          </span>
        )}
      </div>

      {!feedMode && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <BattleSideCard
            side={sideA}
            highlight={duel.winnerContentId === duel.contentAId}
            dimmed={isSettled && duel.winnerContentId !== duel.contentAId}
          />
          <div className="flex items-center justify-center px-2">
            <span className="rounded-full border border-penny-gold/40 bg-penny-gold/10 px-3 py-1 text-xs font-bold text-penny-gold">
              VS
            </span>
          </div>
          <BattleSideCard
            side={sideB}
            highlight={duel.winnerContentId === duel.contentBId}
            dimmed={isSettled && duel.winnerContentId !== duel.contentBId}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <TopicLabel slug={duel.topicSlug} iconSize={13} />
        <span>Pool {formatUsdc(duel.totalVotePoolUsdc)} USDC</span>
      </div>

      {isActive && (feedMode || !compact) && (
        <VotePanel
          duel={duel}
          contentA={contentA}
          contentB={contentB}
          scoreA={scoreA}
          scoreB={scoreB}
          onVoted={onVote}
        />
      )}

      {isSettled && payoutMath && !outcome && (
        <PayoutBreakdown math={payoutMath} />
      )}

      {isSettled && outcome && (
        <BattleOutcomeCard outcome={outcome} />
      )}

      {isSettled && !outcome && (
        <p className="text-xs text-[var(--muted)]">
          Voting closed · {scoreA} vs {scoreB} votes
        </p>
      )}

      {showLink && (
        <Link
          href={`/battle/${duel.id}`}
          className="btn-secondary flex w-full items-center justify-center gap-1 text-sm"
        >
          {isPending ? "View invite" : isActive ? "Open battle" : "View results"}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function PayoutBreakdown({
  math,
}: {
  math: ReturnType<typeof computeDuelPayouts>;
}) {
  if (math.isTie) {
    return (
      <div className="rounded-xl border border-penny-gold/30 bg-penny-gold/5 p-3 text-xs text-[var(--muted)]">
        <p className="font-semibold text-penny-gold">Draw — full refund</p>
        <p className="mt-1">
          Votes tied {math.scoreA} : {math.scoreB}. All entry fees and vote stakes returned to
          participants.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3 text-xs text-[var(--muted)]">
      <p className="font-semibold text-[var(--fg)]">Prize pool breakdown</p>
      <ul className="mt-2 space-y-1">
        <li>Winner author: ${formatUsdc(math.authorWinUsdc)} + entry returned</li>
        <li>
          Winning voters ({math.winningVoteCount}): ${formatUsdc(math.perVoterUsdc)} each + vote
          refund
        </li>
        <li>Final score: {math.scoreA} vs {math.scoreB}</li>
      </ul>
    </div>
  );
}

function BattleOutcomeCard({
  outcome,
}: {
  outcome: NonNullable<ReturnType<typeof getUserDuelOutcome>>;
}) {
  const won = outcome.earnedUsdc > 0;
  return (
    <div
      className={`rounded-xl border p-4 ${
        won
          ? "border-penny-mint/40 bg-penny-mint/10"
          : outcome.role === "loser_author" || outcome.role === "losing_voter"
            ? "border-penny-coral/30 bg-penny-coral/5"
            : "border-[var(--border)] bg-white/[0.03]"
      }`}
    >
      <p className={`text-sm font-semibold ${won ? "text-penny-mint" : "text-[var(--fg)]"}`}>
        {outcome.headline}
      </p>
      {outcome.earnedUsdc > 0 && (
        <p className="mt-2 flex items-center gap-2 text-lg font-bold text-penny-mint">
          <UsdcIcon size={20} />
          +${formatUsdc(outcome.earnedUsdc)}
        </p>
      )}
      <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
        {outcome.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function BattleContentLinkPreview({ item }: { item: ContentItem }) {
  if (!item.linkUrl || item.linkUrl.startsWith("/post/")) return null;
  return (
    <div
      className="mt-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <LinkPreview
        url={item.linkUrl}
        title={item.title || undefined}
        image={item.linkPreviewImage}
      />
    </div>
  );
}

function BattleMediaThumb({ item }: { item: ContentItem }) {
  if (!item.mediaUrl || item.type === "audio") return null;
  if (item.type === "video") {
    return (
      <video
        src={item.mediaUrl}
        className="h-14 w-20 shrink-0 rounded-lg border border-[var(--border)] object-cover"
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.mediaUrl}
      alt=""
      className="h-14 w-20 shrink-0 rounded-lg border border-[var(--border)] object-cover"
    />
  );
}

export function BattleSideCard({
  side,
  highlight,
  dimmed,
  selectable,
  selected,
  voted,
  fullPreview,
  onSelect,
}: {
  side: BattleSide;
  highlight?: boolean;
  dimmed?: boolean;
  selectable?: boolean;
  selected?: boolean;
  voted?: boolean;
  fullPreview?: boolean;
  onSelect?: () => void;
}) {
  const c = side.content;
  const borderClass = voted
    ? "border-penny-mint ring-1 ring-penny-mint"
    : selected
      ? "border-penny-mint bg-penny-mint/15"
      : highlight
        ? "border-penny-mint/50 bg-penny-mint/10"
        : dimmed
          ? "border-[var(--border)] opacity-50"
          : "border-[var(--border)] bg-white/[0.03]";

  const voteBadge =
    typeof side.score === "number" ? (
      <span className="absolute right-0 top-0 rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums">
        {side.score} votes
      </span>
    ) : null;

  const body = fullPreview ? (
    <div className="flex h-full min-h-[11rem] flex-col">
      <div className="relative shrink-0 pr-[4.5rem]">
        {c ? (
          <Link
            href={`/u/${c.authorUsername}`}
            className="text-xs font-semibold text-penny-mint hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{c.authorUsername}
          </Link>
        ) : (
          <span className="text-xs font-semibold text-penny-mint">{side.label}</span>
        )}
        {voteBadge}
      </div>
      {c ? (
        <>
          <div className="mt-2 min-h-0 flex-1 space-y-2">
            {c.title && <p className="text-sm font-medium">{c.title}</p>}
            <p className="text-xs leading-relaxed text-[var(--muted)] whitespace-pre-wrap">
              {c.body}
            </p>
            {c.mediaUrl && (
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                {c.type === "video" ? (
                  <video src={c.mediaUrl} controls className="max-h-48 w-full" />
                ) : c.type === "audio" ? (
                  <audio src={c.mediaUrl} controls className="w-full p-2" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.mediaUrl} alt="" className="max-h-48 w-full object-cover" />
                )}
              </div>
            )}
            <BattleContentLinkPreview item={c} />
          </div>
          <Link
            href={`/post/${c.id}`}
            className="mt-auto inline-flex shrink-0 pt-4 text-xs text-penny-mint hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Go to post →
          </Link>
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Post unavailable</p>
      )}
    </div>
  ) : (
    <>
      <div className="relative pr-[4.5rem]">
        {c ? (
          <Link
            href={`/u/${c.authorUsername}`}
            className="text-xs font-semibold text-penny-mint hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{c.authorUsername}
          </Link>
        ) : (
          <span className="text-xs font-semibold text-penny-mint">{side.label}</span>
        )}
        {voteBadge}
      </div>
      {c ? (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              {c.title && <p className="text-sm font-medium line-clamp-1">{c.title}</p>}
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)] whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
            <BattleMediaThumb item={c} />
          </div>
          <BattleContentLinkPreview item={c} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Post unavailable</p>
      )}
      {!selectable && c && (
        <Link
          href={`/post/${c.id}`}
          className="mt-auto inline-flex pt-3 text-xs text-penny-mint hover:underline"
        >
          View post →
        </Link>
      )}
    </>
  );

  if (selectable && onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-full w-full min-h-[11rem] flex-col rounded-xl border p-3 text-left transition hover:border-penny-mint/50 ${borderClass}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={`flex h-full min-h-[11rem] flex-col rounded-xl border p-3 transition ${borderClass}`}>
      {body}
    </div>
  );
}

export function BattlePostPicker({
  label,
  posts,
  selectedId,
  onSelect,
  emptyText,
}: {
  label: string;
  posts: ContentItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-left text-sm text-[var(--muted)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${
              selectedId === p.id
                ? "border-penny-gold bg-penny-gold/10"
                : "border-[var(--border)] hover:border-penny-gold/30"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <TopicLabel slug={p.topicSlug} iconSize={12} />
                <span>@{p.authorUsername}</span>
              </div>
              {p.title && <p className="mt-1 text-sm font-medium line-clamp-1">{p.title}</p>}
              <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">{p.body}</p>
            </div>
            <BattleMediaThumb item={p} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function OutgoingChallengeCard({
  duel,
  contentA,
  contentB,
}: {
  duel: Duel;
  contentA?: ContentItem | null;
  contentB?: ContentItem | null;
}) {
  return (
    <Link
      href={`/battle/${duel.id}`}
      className="card flex items-start gap-4 border-penny-gold/35 bg-gradient-to-r from-penny-gold/10 to-transparent transition hover:border-penny-gold/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-penny-gold/20 text-penny-gold">
        <Hourglass size={20} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-penny-gold">Awaiting opponent</p>
        <p className="text-sm text-[var(--fg)]">
          Your challenge on{" "}
          <span className="text-penny-mint">
            <TopicLabel slug={duel.topicSlug} iconSize={12} />
          </span>{" "}
          is pending
        </p>
        <p className="text-xs text-[var(--muted)]">
          vs @{contentB?.authorUsername ?? "opponent"}
          {contentA?.title ? ` · “${contentA.title.slice(0, 40)}”` : ""}
        </p>
      </div>
      <Send size={16} className="mt-1 shrink-0 text-[var(--muted)]" />
    </Link>
  );
}
