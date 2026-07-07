import type { ContentItem } from "@/lib/content-store";
import type { Duel, DuelVote } from "@/lib/duel-store";
import {
  AUTHOR_WIN_SHARE,
  DUEL_ENTRY_FEE_USDC,
  VOTER_WIN_SHARE,
  formatUsdc,
} from "@/lib/pricing";

export type DuelPayoutMath = {
  isTie: boolean;
  winnerContentId: string | null;
  loserContentId: string | null;
  winnerAuthor: string | null;
  loserAuthor: string | null;
  scoreA: number;
  scoreB: number;
  authorWinUsdc: number;
  voterPoolUsdc: number;
  perVoterUsdc: number;
  winningVoteCount: number;
};

function voteCounts(duel: Duel, votes: DuelVote[]) {
  return {
    scoreA: votes.filter((v) => v.sideContentId === duel.contentAId).length,
    scoreB: votes.filter((v) => v.sideContentId === duel.contentBId).length,
  };
}

export function computeDuelPayouts(duel: Duel, votes: DuelVote[]): DuelPayoutMath {
  const { scoreA, scoreB } = voteCounts(duel, votes);

  if (duel.status === "settled" && !duel.winnerContentId) {
    return {
      isTie: true,
      winnerContentId: null,
      loserContentId: null,
      winnerAuthor: null,
      loserAuthor: null,
      scoreA,
      scoreB,
      authorWinUsdc: 0,
      voterPoolUsdc: 0,
      perVoterUsdc: 0,
      winningVoteCount: 0,
    };
  }

  const winnerContentId =
    duel.winnerContentId ??
    (scoreA > scoreB ? duel.contentAId : scoreB > scoreA ? duel.contentBId : null);

  if (!winnerContentId || scoreA === scoreB) {
    return {
      isTie: true,
      winnerContentId: null,
      loserContentId: null,
      winnerAuthor: null,
      loserAuthor: null,
      scoreA,
      scoreB,
      authorWinUsdc: 0,
      voterPoolUsdc: 0,
      perVoterUsdc: 0,
      winningVoteCount: 0,
    };
  }

  const loserContentId = winnerContentId === duel.contentAId ? duel.contentBId : duel.contentAId;
  const winnerAuthor = winnerContentId === duel.contentAId ? duel.authorA : duel.authorB;
  const loserAuthor = winnerContentId === duel.contentAId ? duel.authorB : duel.authorA;

  const loserEntry = DUEL_ENTRY_FEE_USDC;
  const authorWinUsdc =
    Math.round(loserEntry * AUTHOR_WIN_SHARE * 1_000_000) / 1_000_000;
  const voterPoolUsdc =
    Math.round(loserEntry * VOTER_WIN_SHARE * 1_000_000) / 1_000_000;
  const winningVotes = votes.filter((v) => v.sideContentId === winnerContentId);
  const perVoterUsdc =
    winningVotes.length > 0
      ? Math.round((voterPoolUsdc / winningVotes.length) * 1_000_000) / 1_000_000
      : 0;

  return {
    isTie: false,
    winnerContentId,
    loserContentId,
    winnerAuthor,
    loserAuthor,
    scoreA,
    scoreB,
    authorWinUsdc,
    voterPoolUsdc,
    perVoterUsdc,
    winningVoteCount: winningVotes.length,
  };
}

export type UserDuelOutcome = {
  role:
    | "winner_author"
    | "loser_author"
    | "winning_voter"
    | "losing_voter"
    | "tie_author"
    | "tie_voter"
    | "spectator";
  headline: string;
  earnedUsdc: number;
  lines: string[];
  canClaim: boolean;
};

export function getUserDuelOutcome(
  address: string | null | undefined,
  duel: Duel,
  votes: DuelVote[],
  contentA: ContentItem | null,
  contentB: ContentItem | null,
): UserDuelOutcome | null {
  if (!address || duel.status !== "settled") return null;

  const viewer = address.toLowerCase();
  const math = computeDuelPayouts(duel, votes);
  const myVote = votes.find((v) => v.voterAddress === viewer) ?? null;
  const label = (id: string) => {
    if (id === duel.contentAId) return contentA ? `@${contentA.authorUsername}` : "Side A";
    return contentB ? `@${contentB.authorUsername}` : "Side B";
  };

  if (math.isTie) {
    if (viewer === duel.authorA || viewer === duel.authorB) {
      return {
        role: "tie_author",
        headline: "Draw — your stake is returned",
        earnedUsdc: DUEL_ENTRY_FEE_USDC,
        canClaim: true,
        lines: [
          `Votes tied ${math.scoreA} : ${math.scoreB}`,
          `Entry fee returned: $${formatUsdc(DUEL_ENTRY_FEE_USDC)}`,
          "No winner this round — better luck next battle",
        ],
      };
    }
    if (myVote) {
      return {
        role: "tie_voter",
        headline: "Draw — vote stake returned",
        earnedUsdc: myVote.amountUsdc,
        canClaim: true,
        lines: [
          `Votes tied ${math.scoreA} : ${math.scoreB}`,
          `Your vote stake returned: $${formatUsdc(myVote.amountUsdc)}`,
        ],
      };
    }
    return {
      role: "spectator",
      headline: "Battle ended in a draw",
      earnedUsdc: 0,
      canClaim: false,
      lines: [`Votes tied ${math.scoreA} : ${math.scoreB}`, "All stakes returned to participants"],
    };
  }

  if (!math.winnerContentId) return null;

  if (viewer === math.winnerAuthor) {
    let earned = math.authorWinUsdc + DUEL_ENTRY_FEE_USDC;
    const lines = [
      `Your post won vs ${label(math.loserContentId!)}`,
      `Prize from opponent entry: $${formatUsdc(math.authorWinUsdc)}`,
      `Your entry returned: $${formatUsdc(DUEL_ENTRY_FEE_USDC)}`,
    ];
    if (math.winningVoteCount === 0) {
      earned += math.voterPoolUsdc;
      lines.push(`No winning voters — voter pool to you: $${formatUsdc(math.voterPoolUsdc)}`);
    } else {
      lines.push(
        `Voter pool ($${formatUsdc(math.voterPoolUsdc)}) split among ${math.winningVoteCount} voters`,
      );
    }
    return {
      role: "winner_author",
      headline: "Congratulations — you won!",
      earnedUsdc: earned,
      canClaim: true,
      lines,
    };
  }

  if (viewer === math.loserAuthor) {
    return {
      role: "loser_author",
      headline: "Sorry — you lost this battle",
      earnedUsdc: 0,
      canClaim: false,
      lines: [
        `Winner: ${label(math.winnerContentId)}`,
        `Your $${formatUsdc(DUEL_ENTRY_FEE_USDC)} entry went to the winner's pool`,
        `Final votes: ${math.scoreA} vs ${math.scoreB}`,
        "Better luck in the next one!",
      ],
    };
  }

  if (myVote) {
    if (myVote.sideContentId === math.winnerContentId) {
      const earned =
        Math.round((math.perVoterUsdc + myVote.amountUsdc) * 1_000_000) / 1_000_000;
      return {
        role: "winning_voter",
        headline: "You picked the winner!",
        earnedUsdc: earned,
        canClaim: true,
        lines: [
          `You backed ${label(myVote.sideContentId)}`,
          `Vote refund: $${formatUsdc(myVote.amountUsdc)}`,
          `Winner share: $${formatUsdc(math.perVoterUsdc)}`,
          `Total payout: $${formatUsdc(earned)}`,
        ],
      };
    }
    return {
      role: "losing_voter",
      headline: "Sorry — your pick lost",
      earnedUsdc: 0,
      canClaim: false,
      lines: [
        `You backed ${label(myVote.sideContentId)}`,
        `Winner was ${label(math.winnerContentId)}`,
        `Your $${formatUsdc(myVote.amountUsdc)} vote fee is not refunded`,
      ],
    };
  }

  return {
    role: "spectator",
    headline: "Battle settled",
    earnedUsdc: 0,
    canClaim: false,
    lines: [
      `Winner: ${label(math.winnerContentId)}`,
      `Final votes: ${math.scoreA} vs ${math.scoreB}`,
    ],
  };
}
