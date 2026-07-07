import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  SEED_POSTS,
  OFFICIAL_ADDRESS,
  OFFICIAL_USERNAME,
} from "./seed-posts-data.mjs";
import { ENRICHED_BODIES } from "./enriched-bodies.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}

async function main() {
  await mkdir(dataDir, { recursive: true });

  const now = new Date().toISOString();
  const profiles = await readJson(path.join(dataDir, "profiles.json"), {});
  const usernames = await readJson(path.join(dataDir, "usernames.json"), {});

  profiles[OFFICIAL_ADDRESS] = {
    walletAddress: OFFICIAL_ADDRESS,
    username: OFFICIAL_USERNAME,
    bio: "Official PennyArena account — micropayment content arena on Arc testnet. Vote on posts for $0.001 USDC.",
    avatarDataUrl: null,
    email: null,
    emailVerified: false,
    isOfficial: true,
    referralCode: "pennyofficial",
    referredBy: null,
    points: 1000,
    pendingWinningsUsdc: 0,
    stats: {
      posts: SEED_POSTS.length,
      duelWins: 0,
      duelLosses: 0,
      tipsReceivedUsdc: 0,
      tipsSentUsdc: 0,
      votesCast: 0,
      referrals: 0,
    },
    sessions: [],
    pendingEmailCode: null,
    pendingEmailExpires: null,
    createdAt: profiles[OFFICIAL_ADDRESS]?.createdAt ?? now,
    updatedAt: now,
  };

  usernames[OFFICIAL_USERNAME] = OFFICIAL_ADDRESS;

  const content = SEED_POSTS.map((p) => ({
    id: p.id,
    authorAddress: OFFICIAL_ADDRESS,
    authorUsername: OFFICIAL_USERNAME,
    topicSlug: p.topicSlug,
    type: p.type,
    title: p.title,
    body: ENRICHED_BODIES[p.id] ?? p.body,
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

  const existing = await readJson(path.join(dataDir, "content.json"), []);
  const existingIds = new Set(existing.map((c) => c.id));
  const merged = [
    ...content.filter((c) => !existingIds.has(c.id)),
    ...existing.filter((c) => c.authorAddress !== OFFICIAL_ADDRESS),
    ...content,
  ];
  const byId = new Map();
  for (const item of merged) {
    byId.set(item.id, item);
  }
  const finalContent = [...byId.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  await writeFile(
    path.join(dataDir, "profiles.json"),
    JSON.stringify(profiles, null, 2),
  );
  await writeFile(
    path.join(dataDir, "usernames.json"),
    JSON.stringify(usernames, null, 2),
  );
  await writeFile(
    path.join(dataDir, "content.json"),
    JSON.stringify(finalContent, null, 2),
  );

  console.log(`Seeded @${OFFICIAL_USERNAME} with ${SEED_POSTS.length} posts.`);
  console.log(`Total content items: ${finalContent.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
