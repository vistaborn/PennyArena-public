import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import { hasSharedStore, readSharedDuels, readSharedVotes, writeSharedDuels, writeSharedVotes } from "@/lib/shared-store";
import {
  AUTHOR_WIN_SHARE,
  DUEL_DURATION_MS,
  DUEL_ENTRY_FEE_USDC,
  VOTER_WIN_SHARE,
  VOTE_UNIT_USDC,
} from "@/lib/pricing";
import { addPendingWinnings, addPoints, incrementStat } from "@/lib/profile-store";
import { bumpVoteScore } from "@/lib/content-store";
import { isOfficialAddress } from "@/lib/official-account";

export type DuelStatus = "pending" | "active" | "settled" | "refunded";

export type DuelVote = {
  id: string;
  duelId: string;
  voterAddress: string;
  sideContentId: string;
  amountUsdc: number;
  weight: number;
  txHash: string;
  createdAt: string;
};

export type Duel = {
  id: string;
  topicSlug: string;
  contentAId: string;
  contentBId: string;
  authorA: string;
  authorB: string;
  entryTxA: string;
  entryTxB: string | null;
  status: DuelStatus;
  winnerContentId: string | null;
  totalVotePoolUsdc: number;
  startsAt: string;
  endsAt: string;
  settledAt: string | null;
  createdAt: string;
};

const MEMORY_KEY = "__penny_duels__";
const VOTES_KEY = "__penny_votes__";

function memoryDuels(): Duel[] {
  const g = globalThis as { [MEMORY_KEY]?: Duel[] };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY]!;
}

function memoryVotes(): DuelVote[] {
  const g = globalThis as { [VOTES_KEY]?: DuelVote[] };
  if (!g[VOTES_KEY]) g[VOTES_KEY] = [];
  return g[VOTES_KEY]!;
}

function duelsFile() {
  return path.join(getDataDir(), "duels.json");
}

function votesFile() {
  return path.join(getDataDir(), "votes.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

async function readDuels(): Promise<Duel[]> {
  const mem = memoryDuels();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedDuels<Duel>();
    if (shared && shared.length > 0) {
      mem.length = 0;
      mem.push(...shared);
      return [...shared];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(duelsFile(), "utf-8");
    const data = JSON.parse(raw) as Duel[];
    if (isVercelServerless()) {
      mem.length = 0;
      mem.push(...data);
      if (data.length > 0 && hasSharedStore()) await writeSharedDuels(data);
    }
    return data;
  } catch {
    return [];
  }
}

async function writeDuels(data: Duel[]) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(duelsFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    const mem = memoryDuels();
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore()) await writeSharedDuels(data);
  }
}

async function readVotes(): Promise<DuelVote[]> {
  const mem = memoryVotes();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedVotes<DuelVote>();
    if (shared) {
      mem.length = 0;
      mem.push(...shared);
      return [...shared];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(votesFile(), "utf-8");
    const data = JSON.parse(raw) as DuelVote[];
    if (isVercelServerless()) {
      mem.length = 0;
      mem.push(...data);
      if (hasSharedStore()) await writeSharedVotes(data);
    }
    return data;
  } catch {
    return [];
  }
}

async function writeVotes(data: DuelVote[]) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(votesFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    const mem = memoryVotes();
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore()) await writeSharedVotes(data);
  }
}

export async function listAllDuels(): Promise<Duel[]> {
  return readDuels();
}

export async function getDuel(id: string): Promise<Duel | null> {
  const all = await readDuels();
  return all.find((d) => d.id === id) ?? null;
}

export async function getActiveDuels(): Promise<Duel[]> {
  const all = await readDuels();
  const now = Date.now();
  return all.filter((d) => d.status === "active" && new Date(d.endsAt).getTime() > now);
}

export async function getPopularDuels(limit = 10): Promise<Duel[]> {
  const all = await readDuels();
  return [...all]
    .filter((d) => d.status === "active" || d.status === "settled")
    .sort((a, b) => b.totalVotePoolUsdc - a.totalVotePoolUsdc)
    .slice(0, limit);
}

export async function findActiveDuelForContent(contentId: string): Promise<Duel | null> {
  const all = await readDuels();
  return (
    all.find(
      (d) =>
        d.status === "active" &&
        (d.contentAId === contentId || d.contentBId === contentId),
    ) ?? null
  );
}

export async function findOpenDuelForContent(contentId: string): Promise<Duel | null> {
  const all = await readDuels();
  return (
    all.find(
      (d) =>
        (d.status === "pending" || d.status === "active") &&
        (d.contentAId === contentId || d.contentBId === contentId),
    ) ?? null
  );
}

export async function getPendingDuelsForAuthor(authorAddress: string): Promise<Duel[]> {
  const addr = authorAddress.toLowerCase();
  const all = await readDuels();
  return all.filter((d) => d.status === "pending" && d.authorB === addr);
}

export async function getChallengesByAuthor(authorAddress: string): Promise<Duel[]> {
  const addr = authorAddress.toLowerCase();
  const all = await readDuels();
  return all.filter((d) => d.status === "pending" && d.authorA === addr);
}

export async function createDuelChallenge(input: {
  topicSlug: string;
  contentAId: string;
  contentBId: string;
  challengerAddress: string;
  entryTxA: string;
}): Promise<Duel> {
  return withWriteLock(async () => {
    const all = await readDuels();
    const contentModule = await import("@/lib/content-store");
    const a = await contentModule.getContent(input.contentAId);
    const b = await contentModule.getContent(input.contentBId);
    if (!a || !b) throw new Error("Content not found");
    if (a.topicSlug !== b.topicSlug) throw new Error("Topics must match");
    if (a.authorAddress === b.authorAddress) throw new Error("Need different authors");
    if (isOfficialAddress(a.authorAddress) || isOfficialAddress(b.authorAddress)) {
      throw new Error("Cannot battle official posts");
    }

    const openA = await findOpenDuelForContent(input.contentAId);
    const openB = await findOpenDuelForContent(input.contentBId);
    if (openA || openB) throw new Error("Post already in a battle");

    const now = new Date();
    const duel: Duel = {
      id: randomUUID(),
      topicSlug: input.topicSlug,
      contentAId: input.contentAId,
      contentBId: input.contentBId,
      authorA: a.authorAddress,
      authorB: b.authorAddress,
      entryTxA: input.entryTxA,
      entryTxB: null,
      status: "pending",
      winnerContentId: null,
      totalVotePoolUsdc: DUEL_ENTRY_FEE_USDC,
      startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + DUEL_DURATION_MS).toISOString(),
      settledAt: null,
      createdAt: now.toISOString(),
    };
    all.unshift(duel);
    await writeDuels(all);
    return duel;
  });
}

export async function declineDuel(input: {
  duelId: string;
  actorAddress: string;
}): Promise<Duel | null> {
  return withWriteLock(async () => {
    const all = await readDuels();
    const idx = all.findIndex((d) => d.id === input.duelId);
    if (idx < 0) return null;
    const duel = all[idx];
    if (duel.status !== "pending") return null;

    const actor = input.actorAddress.toLowerCase();
    if (actor !== duel.authorA && actor !== duel.authorB) return null;

    await addPendingWinnings(duel.authorA, DUEL_ENTRY_FEE_USDC);
    duel.status = "refunded";
    duel.settledAt = new Date().toISOString();
    all[idx] = duel;
    await writeDuels(all);
    return duel;
  });
}

export async function acceptDuel(input: {
  duelId: string;
  authorAddress: string;
  entryTxB: string;
}): Promise<Duel | null> {
  return withWriteLock(async () => {
    const all = await readDuels();
    const idx = all.findIndex((d) => d.id === input.duelId);
    if (idx < 0) return null;
    const duel = all[idx];
    if (duel.status !== "pending") return null;
    if (duel.authorB !== input.authorAddress.toLowerCase()) return null;

    duel.entryTxB = input.entryTxB;
    duel.status = "active";
    duel.totalVotePoolUsdc = DUEL_ENTRY_FEE_USDC * 2;
    duel.startsAt = new Date().toISOString();
    duel.endsAt = new Date(Date.now() + DUEL_DURATION_MS).toISOString();
    all[idx] = duel;
    await writeDuels(all);
    await addPoints(duel.authorA, "duel_enter");
    await addPoints(duel.authorB, "duel_enter");
    return duel;
  });
}

export async function createDuel(input: {
  topicSlug: string;
  contentAId: string;
  contentBId: string;
  authorA: string;
  authorB: string;
  entryTxA: string;
  entryTxB: string;
}): Promise<Duel> {
  return withWriteLock(async () => {
    const all = await readDuels();
    const now = new Date();
    const duel: Duel = {
      id: randomUUID(),
      topicSlug: input.topicSlug,
      contentAId: input.contentAId,
      contentBId: input.contentBId,
      authorA: input.authorA.toLowerCase(),
      authorB: input.authorB.toLowerCase(),
      entryTxA: input.entryTxA,
      entryTxB: input.entryTxB,
      status: "active",
      winnerContentId: null,
      totalVotePoolUsdc: DUEL_ENTRY_FEE_USDC * 2,
      startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + DUEL_DURATION_MS).toISOString(),
      settledAt: null,
      createdAt: now.toISOString(),
    };
    all.unshift(duel);
    await writeDuels(all);
    await addPoints(input.authorA, "duel_enter");
    await addPoints(input.authorB, "duel_enter");
    return duel;
  });
}

export async function castVote(input: {
  duelId: string;
  voterAddress: string;
  sideContentId: string;
  amountUsdc: number;
  txHash: string;
}): Promise<DuelVote | null> {
  return withWriteLock(async () => {
    const votes = await readVotes();
    if (votes.some((v) => v.txHash === input.txHash)) return null;

    const all = await readDuels();
    const idx = all.findIndex((d) => d.id === input.duelId);
    if (idx < 0) return null;
    const duel = all[idx];
    if (duel.status !== "active") return null;
    if (new Date(duel.endsAt).getTime() < Date.now()) return null;
    if (
      input.sideContentId !== duel.contentAId &&
      input.sideContentId !== duel.contentBId
    ) {
      return null;
    }

    if (input.amountUsdc !== VOTE_UNIT_USDC) return null;

    const duelVotes = votes.filter((v) => v.duelId === input.duelId);
    const voter = input.voterAddress.toLowerCase();
    if (duelVotes.some((v) => v.voterAddress === voter)) return null;

    const weight = 1;

    const vote: DuelVote = {
      id: randomUUID(),
      duelId: input.duelId,
      voterAddress: voter,
      sideContentId: input.sideContentId,
      amountUsdc: input.amountUsdc,
      weight,
      txHash: input.txHash,
      createdAt: new Date().toISOString(),
    };
    votes.unshift(vote);
    duel.totalVotePoolUsdc =
      Math.round((duel.totalVotePoolUsdc + input.amountUsdc) * 1_000_000) / 1_000_000;
    all[idx] = duel;
    await writeVotes(votes);
    await writeDuels(all);
    await bumpVoteScore(input.sideContentId, weight);
    await addPoints(input.voterAddress, "vote");
    await incrementStat(input.voterAddress, "votesCast", weight);
    return vote;
  });
}

export async function getVotesForDuel(duelId: string): Promise<DuelVote[]> {
  const votes = await readVotes();
  return votes.filter((v) => v.duelId === duelId);
}

export async function settleDueDuels(): Promise<number> {
  const all = await readDuels();
  let settled = 0;
  for (const duel of all) {
    if (duel.status !== "active") continue;
    if (new Date(duel.endsAt).getTime() > Date.now()) continue;
    await settleDuel(duel.id);
    settled += 1;
  }
  return settled;
}

export async function settleDuel(duelId: string): Promise<Duel | null> {
  return withWriteLock(async () => {
    const all = await readDuels();
    const idx = all.findIndex((d) => d.id === duelId);
    if (idx < 0) return null;
    const duel = all[idx];
    if (duel.status !== "active") return duel;

    const votes = await readVotes();
    const duelVotes = votes.filter((v) => v.duelId === duelId);

    const scoreA = duelVotes
      .filter((v) => v.sideContentId === duel.contentAId)
      .reduce((s, v) => s + v.weight, 0);
    const scoreB = duelVotes
      .filter((v) => v.sideContentId === duel.contentBId)
      .reduce((s, v) => s + v.weight, 0);

    if (scoreA === scoreB) {
      await addPendingWinnings(duel.authorA, DUEL_ENTRY_FEE_USDC);
      await addPendingWinnings(duel.authorB, DUEL_ENTRY_FEE_USDC);
      for (const v of duelVotes) {
        if (v.amountUsdc > 0) await addPendingWinnings(v.voterAddress, v.amountUsdc);
      }
      duel.status = "settled";
      duel.winnerContentId = null;
      duel.settledAt = new Date().toISOString();
      all[idx] = duel;
      await writeDuels(all);
      return duel;
    }

    const winnerId =
      scoreA > scoreB ? duel.contentAId : duel.contentBId;
    const loserId = winnerId === duel.contentAId ? duel.contentBId : duel.contentAId;
    const winnerAuthor = winnerId === duel.contentAId ? duel.authorA : duel.authorB;
    const loserAuthor = winnerId === duel.contentAId ? duel.authorB : duel.authorA;

    const loserEntry = DUEL_ENTRY_FEE_USDC;
    const authorShare =
      Math.round(loserEntry * AUTHOR_WIN_SHARE * 1_000_000) / 1_000_000;
    const voterSharePool =
      Math.round(loserEntry * VOTER_WIN_SHARE * 1_000_000) / 1_000_000;

    const winningVotes = duelVotes.filter((v) => v.sideContentId === winnerId);
    const perVoterBonus =
      winningVotes.length > 0
        ? Math.round((voterSharePool / winningVotes.length) * 1_000_000) / 1_000_000
        : 0;

    let winnerAuthorPayout = authorShare + DUEL_ENTRY_FEE_USDC;
    if (winningVotes.length === 0) {
      winnerAuthorPayout += voterSharePool;
    }

    await addPendingWinnings(winnerAuthor, winnerAuthorPayout);
    await addPoints(winnerAuthor, "duel_win");
    await incrementStat(winnerAuthor, "duelWins");
    await incrementStat(loserAuthor, "duelLosses");

    for (const v of winningVotes) {
      const payout =
        Math.round((perVoterBonus + v.amountUsdc) * 1_000_000) / 1_000_000;
      if (payout > 0) await addPendingWinnings(v.voterAddress, payout);
    }

    duel.status = "settled";
    duel.winnerContentId = winnerId;
    duel.settledAt = new Date().toISOString();
    all[idx] = duel;
    await writeDuels(all);
    return duel;
  });
}

export async function getLeaderboard() {
  const { listProfiles } = await import("@/lib/profile-store");
  const { isOfficialAddress } = await import("@/lib/official-account");
  const profiles = await listProfiles();
  return profiles
    .filter((p) => !p.isOfficial && !isOfficialAddress(p.walletAddress))
    .map((p) => ({
      username: p.username,
      avatarDataUrl: p.avatarDataUrl,
      wins: p.stats.duelWins,
      losses: p.stats.duelLosses,
      points: p.points,
      walletAddress: p.walletAddress,
    }))
    .sort((a, b) => b.wins - a.wins || b.points - a.points);
}
