import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import {
  hasSharedStore,
  readSharedProfiles,
  readSharedUsernames,
  writeSharedProfiles,
  writeSharedUsernames,
} from "@/lib/shared-store";
import { pointsForAction, PENNY_LAUNCH_THRESHOLD, PENNY_LAUNCH_USDC, type PointAction } from "@/lib/rewards-config";
import {
  validateAvatarDataUrl,
  validateBio,
  validateEmail,
  validateUsername,
} from "@/lib/security/validation";

export type UserSession = {
  id: string;
  userAgent: string;
  label: string;
  createdAt: string;
  lastSeenAt: string;
};

export type UserProfile = {
  walletAddress: string;
  username: string;
  bio: string;
  avatarDataUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  isOfficial?: boolean;
  referralCode: string;
  referredBy: string | null;
  points: number;
  pendingWinningsUsdc: number;
  pennyLaunchClaimed?: boolean;
  stats: {
    posts: number;
    duelWins: number;
    duelLosses: number;
    tipsReceivedUsdc: number;
    tipsSentUsdc: number;
    votesCast: number;
    referrals: number;
    duelEarningsUsdc: number;
  };
  sessions: UserSession[];
  pendingEmailCode: string | null;
  pendingEmailExpires: string | null;
  createdAt: string;
  updatedAt: string;
};

const MEMORY_KEY = "__penny_profiles__";
const USERNAME_INDEX_KEY = "__penny_usernames__";
const MAX_SESSIONS = 10;

function memoryProfiles(): Record<string, UserProfile> {
  const g = globalThis as { [MEMORY_KEY]?: Record<string, UserProfile> };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = {};
  return g[MEMORY_KEY]!;
}

function memoryUsernames(): Record<string, string> {
  const g = globalThis as { [USERNAME_INDEX_KEY]?: Record<string, string> };
  if (!g[USERNAME_INDEX_KEY]) g[USERNAME_INDEX_KEY] = {};
  return g[USERNAME_INDEX_KEY]!;
}

function profilesFile() {
  return path.join(getDataDir(), "profiles.json");
}

function usernamesFile() {
  return path.join(getDataDir(), "usernames.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function newReferralCode(): string {
  return randomBytes(4).toString("hex");
}

function emptyProfile(key: string, now: string): UserProfile {
  return {
    walletAddress: key,
    username: "",
    bio: "",
    avatarDataUrl: null,
    email: null,
    emailVerified: false,
    referralCode: newReferralCode(),
    referredBy: null,
    points: 0,
    pendingWinningsUsdc: 0,
    pennyLaunchClaimed: false,
    stats: {
      posts: 0,
      duelWins: 0,
      duelLosses: 0,
      tipsReceivedUsdc: 0,
      tipsSentUsdc: 0,
      votesCast: 0,
      referrals: 0,
      duelEarningsUsdc: 0,
    },
    sessions: [],
    pendingEmailCode: null,
    pendingEmailExpires: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function readUsernames(): Promise<Record<string, string>> {
  const mem = memoryUsernames();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedUsernames();
    if (shared && Object.keys(shared).length > 0) {
      Object.assign(mem, shared);
      return { ...shared };
    }
  }

  if (isVercelServerless() && Object.keys(mem).length > 0) return { ...mem };

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(usernamesFile(), "utf-8");
    const data = JSON.parse(raw) as Record<string, string>;
    if (isVercelServerless()) {
      Object.assign(memoryUsernames(), data);
      if (Object.keys(data).length > 0 && hasSharedStore()) {
        await writeSharedUsernames(data);
      }
    }
    return data;
  } catch {
    return {};
  }
}

async function writeUsernames(data: Record<string, string>) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(usernamesFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    Object.assign(memoryUsernames(), data);
    if (hasSharedStore()) await writeSharedUsernames(data);
  }
}

async function readAll(): Promise<Record<string, UserProfile>> {
  const mem = memoryProfiles();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedProfiles<UserProfile>();
    if (shared && Object.keys(shared).length > 0) {
      Object.assign(mem, shared);
      return { ...shared };
    }
  }

  if (isVercelServerless() && Object.keys(mem).length > 0) return { ...mem };

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(profilesFile(), "utf-8");
    const data = JSON.parse(raw) as Record<string, UserProfile>;
    if (isVercelServerless()) {
      Object.assign(memoryProfiles(), data);
      if (Object.keys(data).length > 0 && hasSharedStore()) {
        await writeSharedProfiles(data);
      }
    }
    return data;
  } catch {
    return {};
  }
}

async function writeAll(data: Record<string, UserProfile>) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(profilesFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    Object.assign(memoryProfiles(), data);
    if (hasSharedStore()) await writeSharedProfiles(data);
  }
}

export async function syncUsernameIndexFromContent(): Promise<void> {
  const { listContent } = await import("@/lib/content-store");
  const posts = await listContent({ limit: 500 });
  const index = await readUsernames();
  let changed = false;
  for (const p of posts) {
    if (!p.authorUsername) continue;
    const un = p.authorUsername.toLowerCase();
    const addr = p.authorAddress.toLowerCase();
    if (!index[un]) {
      index[un] = addr;
      changed = true;
    }
  }
  if (changed) await writeUsernames(index);
}

export async function getProfile(address: string): Promise<UserProfile | null> {
  const key = normalizeAddress(address);
  const all = await readAll();
  return all[key] ?? null;
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const un = username.toLowerCase();
  const index = await readUsernames();
  const addr = index[un];
  if (addr) {
    const profile = await getProfile(addr);
    if (profile?.username) return profile;
  }
  const all = await readAll();
  const found = Object.values(all).find((p) => p.username.toLowerCase() === un);
  if (found) return found;

  const { listContent } = await import("@/lib/content-store");
  const posts = await listContent({ limit: 300 });
  const match = posts.find((p) => p.authorUsername.toLowerCase() === un);
  if (!match) return null;

  const existing = await getProfile(match.authorAddress);
  if (existing?.username) return existing;

  const result = await setUsername(match.authorAddress, un);
  return result.ok ? result.profile : existing;
}

export async function listProfiles(): Promise<UserProfile[]> {
  const all = await readAll();
  return Object.values(all).filter((p) => p.username);
}

export function profileHasSession(profile: UserProfile, sessionId: string) {
  return profile.sessions.some((s) => s.id === sessionId);
}

export async function touchSession(
  address: string,
  sessionId: string,
  userAgent: string,
  referralCode?: string,
): Promise<UserProfile> {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const now = new Date().toISOString();
    let profile = all[key] ?? emptyProfile(key, now);

    if (referralCode && !profile.referredBy) {
      const referrer = Object.values(all).find((p) => p.referralCode === referralCode);
      if (referrer && referrer.walletAddress !== key) {
        profile.referredBy = referrer.walletAddress;
        referrer.points += pointsForAction("referral");
        referrer.stats.referrals += 1;
        referrer.updatedAt = now;
        all[referrer.walletAddress] = referrer;
      }
    }

    const label = userAgent.includes("Mobile") ? "Mobile" : "Browser";
    const existing = profile.sessions.find((s) => s.id === sessionId);
    if (existing) {
      existing.lastSeenAt = now;
    } else {
      profile.sessions.unshift({
        id: sessionId,
        userAgent: userAgent.slice(0, 200),
        label,
        createdAt: now,
        lastSeenAt: now,
      });
      profile.sessions = profile.sessions.slice(0, MAX_SESSIONS);
    }

    profile.updatedAt = now;
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function setUsername(
  address: string,
  username: string,
): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  const valid = validateUsername(username);
  if (!valid) return { ok: false, error: "Username must be 3–24 chars (letters, numbers, underscore)" };

  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const index = await readUsernames();
    const profile = all[key] ?? emptyProfile(key, new Date().toISOString());

    if (index[valid] && index[valid] !== key) {
      return { ok: false, error: "Username already taken" };
    }

    if (profile.username && profile.username !== valid) {
      delete index[profile.username];
    }

    profile.username = valid;
    profile.updatedAt = new Date().toISOString();
    index[valid] = key;
    all[key] = profile;
    await writeAll(all);
    await writeUsernames(index);
    return { ok: true, profile };
  });
}

export async function updateProfile(
  address: string,
  patch: {
    bio?: string;
    avatarDataUrl?: string | null;
    email?: string | null;
  },
): Promise<UserProfile | null> {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return null;

    if (patch.bio !== undefined) {
      const bio = validateBio(patch.bio);
      if (bio === null) throw new Error("Invalid bio");
      profile.bio = bio;
    }
    if (patch.avatarDataUrl !== undefined) {
      profile.avatarDataUrl =
        patch.avatarDataUrl === null
          ? null
          : validateAvatarDataUrl(patch.avatarDataUrl);
    }
    if (patch.email !== undefined) {
      profile.email = patch.email === null ? null : validateEmail(patch.email);
      profile.emailVerified = false;
    }

    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function addPoints(address: string, action: PointAction, times = 1) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return null;
    profile.points += pointsForAction(action) * times;
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function incrementStat(
  address: string,
  stat: keyof UserProfile["stats"],
  amount = 1,
) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return null;
    profile.stats[stat] = Math.max(0, (profile.stats[stat] as number) + amount);
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function addPendingWinnings(address: string, amountUsdc: number) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return null;
    profile.pendingWinningsUsdc =
      Math.round((profile.pendingWinningsUsdc + amountUsdc) * 1_000_000) / 1_000_000;
    profile.stats.duelEarningsUsdc =
      Math.round(((profile.stats.duelEarningsUsdc ?? 0) + amountUsdc) * 1_000_000) / 1_000_000;
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function claimPendingWinnings(
  address: string,
  amountUsdc?: number,
): Promise<number> {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return 0;
    const available = profile.pendingWinningsUsdc;
    const amount =
      amountUsdc !== undefined
        ? Math.min(Math.round(amountUsdc * 1_000_000) / 1_000_000, available)
        : available;
    if (amount <= 0) return 0;
    profile.pendingWinningsUsdc =
      Math.round((available - amount) * 1_000_000) / 1_000_000;
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return amount;
  });
}

export async function claimPennyLaunch(address: string): Promise<number> {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) throw new Error("Profile not found");
    if (profile.pennyLaunchClaimed) throw new Error("Already claimed");
    if (profile.points < PENNY_LAUNCH_THRESHOLD) {
      throw new Error(`Need ${PENNY_LAUNCH_THRESHOLD} PENNY points`);
    }
    profile.points -= PENNY_LAUNCH_THRESHOLD;
    profile.pennyLaunchClaimed = true;
    profile.pendingWinningsUsdc =
      Math.round((profile.pendingWinningsUsdc + PENNY_LAUNCH_USDC) * 1_000_000) / 1_000_000;
    profile.stats.duelEarningsUsdc =
      Math.round(((profile.stats.duelEarningsUsdc ?? 0) + PENNY_LAUNCH_USDC) * 1_000_000) /
      1_000_000;
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return PENNY_LAUNCH_USDC;
  });
}

export async function requestEmailVerification(address: string, email: string) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile) return null;
    const valid = validateEmail(email);
    if (!valid) throw new Error("Invalid email");
    const code = randomBytes(3).toString("hex").toUpperCase();
    profile.email = valid;
    profile.emailVerified = false;
    profile.pendingEmailCode = code;
    profile.pendingEmailExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return { profile };
  });
}

export async function verifyEmailCode(address: string, code: string) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (!profile?.pendingEmailCode) return null;
    if (profile.pendingEmailExpires && profile.pendingEmailExpires < new Date().toISOString()) {
      return null;
    }
    if (profile.pendingEmailCode !== code.trim().toUpperCase()) return null;
    profile.emailVerified = true;
    profile.pendingEmailCode = null;
    profile.pendingEmailExpires = null;
    profile.updatedAt = new Date().toISOString();
    all[key] = profile;
    await writeAll(all);
    return profile;
  });
}

export async function deleteProfile(address: string) {
  return withWriteLock(async () => {
    const key = normalizeAddress(address);
    const all = await readAll();
    const profile = all[key];
    if (profile?.username) {
      const index = await readUsernames();
      delete index[profile.username];
      await writeUsernames(index);
    }
    delete all[key];
    await writeAll(all);
  });
}

export function publicProfile(profile: UserProfile) {
  return {
    walletAddress: profile.walletAddress,
    username: profile.username,
    bio: profile.bio,
    avatarDataUrl: profile.avatarDataUrl,
    isOfficial: profile.isOfficial ?? false,
    points: profile.points,
    pendingWinningsUsdc: profile.pendingWinningsUsdc,
    pennyLaunchClaimed: profile.pennyLaunchClaimed ?? false,
    stats: profile.stats,
    createdAt: profile.createdAt,
  };
}

/** Profile fields safe to return to the signed-in owner. */
export function ownProfile(profile: UserProfile) {
  return {
    ...publicProfile(profile),
    referralCode: profile.referralCode,
    email: profile.email,
    emailVerified: profile.emailVerified,
  };
}
