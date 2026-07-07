import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import {
  OFFICIAL_WALLET_ADDRESS,
  OFFICIAL_USERNAME,
  OFFICIAL_AVATAR_URL,
  OFFICIAL_BIO,
} from "@/lib/official-account";
import type { ContentItem } from "@/lib/content-store";
import { replaceAllContent } from "@/lib/content-store";
import type { UserProfile } from "@/lib/profile-store";
import {
  hasSharedStore,
  writeSharedProfiles,
  writeSharedUsernames,
} from "@/lib/shared-store";

const OFFICIAL_ADDRESS = OFFICIAL_WALLET_ADDRESS;

type SeedPost = {
  id: string;
  topicSlug: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  linkPreviewImage?: string;
  mediaUrl?: string;
  createdAt: string;
};

async function loadBootstrapContent(): Promise<ContentItem[] | null> {
  try {
    const bootstrapPath = path.join(process.cwd(), "seed", "bootstrap-content.json");
    return JSON.parse(await fs.readFile(bootstrapPath, "utf-8")) as ContentItem[];
  } catch {
    return null;
  }
}

async function loadSeedPosts(): Promise<SeedPost[]> {
  const bootstrapPath = path.join(process.cwd(), "seed", "bootstrap-content.json");
  try {
    const items = JSON.parse(
      await fs.readFile(bootstrapPath, "utf-8"),
    ) as ContentItem[];
    return items.map((p) => ({
      id: p.id,
      topicSlug: p.topicSlug,
      type: p.type,
      title: p.title,
      body: p.body,
      linkUrl: p.linkUrl ?? undefined,
      linkPreviewImage: p.linkPreviewImage ?? undefined,
      mediaUrl: p.mediaUrl ?? undefined,
      createdAt: p.createdAt,
    }));
  } catch {
    /* fall through to scripts */
  }

  const seedPath = path.join(process.cwd(), "scripts", "seed-posts-data.mjs");
  const bodiesPath = path.join(process.cwd(), "scripts", "enriched-bodies.mjs");
  const mod = await import(/* webpackIgnore: true */ pathToFileURL(seedPath).href);
  const bodiesMod = await import(/* webpackIgnore: true */ pathToFileURL(bodiesPath).href);
  const enriched = bodiesMod.ENRICHED_BODIES as Record<string, string>;
  return (mod.SEED_POSTS as SeedPost[]).map((p) => ({
    ...p,
    body: enriched[p.id] ?? p.body,
  }));
}

export async function ensureOfficialSeedIfEmpty(): Promise<void> {
  const { listContent } = await import("@/lib/content-store");
  const { syncUsernameIndexFromContent } = await import("@/lib/profile-store");
  const all = await listContent({ limit: 1 });
  if (all.length > 0) {
    await syncUsernameIndexFromContent();
    return;
  }
  await runOfficialSeed();
}

export async function runOfficialSeed(): Promise<{ posts: number }> {
  const bootstrapContent = await loadBootstrapContent();
  const SEED_POSTS = bootstrapContent
    ? null
    : await loadSeedPosts();
  const dataDir = getDataDir();
  await fs.mkdir(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const profilesPath = path.join(dataDir, "profiles.json");
  const usernamesPath = path.join(dataDir, "usernames.json");
  const contentPath = path.join(dataDir, "content.json");

  let profiles: Record<string, UserProfile> = {};
  let usernames: Record<string, string> = {};
  let existing: ContentItem[] = [];

  try {
    profiles = JSON.parse(await fs.readFile(profilesPath, "utf-8"));
  } catch {
    /* empty */
  }
  try {
    usernames = JSON.parse(await fs.readFile(usernamesPath, "utf-8"));
  } catch {
    /* empty */
  }
  try {
    existing = JSON.parse(await fs.readFile(contentPath, "utf-8"));
  } catch {
    /* empty */
  }

  profiles[OFFICIAL_ADDRESS] = {
    walletAddress: OFFICIAL_ADDRESS,
    username: OFFICIAL_USERNAME,
    bio: OFFICIAL_BIO,
    avatarDataUrl: OFFICIAL_AVATAR_URL,
    email: null,
    emailVerified: false,
    isOfficial: true,
    referralCode: "pennyofficial",
    referredBy: null,
    points: 1000,
    pendingWinningsUsdc: 0,
    stats: {
      posts: bootstrapContent?.length ?? SEED_POSTS!.length,
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
    createdAt: profiles[OFFICIAL_ADDRESS]?.createdAt ?? now,
    updatedAt: now,
  };

  usernames[OFFICIAL_USERNAME] = OFFICIAL_ADDRESS;

  const seeded: ContentItem[] = bootstrapContent
    ? bootstrapContent
    : SEED_POSTS!.map((p) => ({
    id: p.id,
    authorAddress: OFFICIAL_ADDRESS,
    authorUsername: OFFICIAL_USERNAME,
    topicSlug: p.topicSlug as ContentItem["topicSlug"],
    type: p.type as ContentItem["type"],
    title: p.title,
    body: p.body,
    mediaUrl: p.mediaUrl ?? null,
    linkUrl: p.linkUrl ?? null,
    linkPreviewImage: p.linkPreviewImage ?? null,
    repostOfId: null,
    publishTxHash: `seed:official:${p.id}`,
    tipsTotalUsdc: 0,
    tipCount: 0,
    likeCount: 0,
    votesTotalUsdc: 0,
    commentCount: 0,
    repostCount: 0,
    voteScore: 0,
    createdAt: p.createdAt,
  }));

  const withoutOfficial = existing.filter(
    (c) => c.authorAddress !== OFFICIAL_ADDRESS,
  );
  const byId = new Map<string, ContentItem>();
  for (const item of [...withoutOfficial, ...seeded]) {
    byId.set(item.id, item);
  }
  const finalContent = [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
  await fs.writeFile(usernamesPath, JSON.stringify(usernames, null, 2));
  await replaceAllContent(finalContent);

  if (isVercelServerless()) {
    const g = globalThis as { __penny_profiles__?: Record<string, UserProfile> };
    if (!g.__penny_profiles__) g.__penny_profiles__ = {};
    Object.assign(g.__penny_profiles__, profiles);
    const u = globalThis as { __penny_usernames__?: Record<string, string> };
    if (!u.__penny_usernames__) u.__penny_usernames__ = {};
    Object.assign(u.__penny_usernames__, usernames);
    if (hasSharedStore()) {
      await writeSharedProfiles(profiles);
      await writeSharedUsernames(usernames);
    }
  }

  return { posts: seeded.length };
}
