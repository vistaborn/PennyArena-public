import { NextRequest, NextResponse } from "next/server";
import {
  isFollowing,
  listFollowers,
  listFollowing,
  toggleFollow,
} from "@/lib/follow-store";
import { getProfile, getProfileByUsername, listProfiles } from "@/lib/profile-store";
import { listContent } from "@/lib/content-store";
import { requireWalletAuth } from "@/lib/security/api-auth";
import { getSessionFromRequest } from "@/lib/security/session";
import { parseAddress } from "@/lib/security/validation";
import {
  isOfficialAddress,
  OFFICIAL_AVATAR_URL,
  OFFICIAL_BIO,
  OFFICIAL_USERNAME,
} from "@/lib/official-account";

export type FollowUser = {
  walletAddress: string;
  username: string;
  bio: string;
  avatarDataUrl: string | null;
};

function toFollowUser(
  walletAddress: string,
  username: string,
  bio = "",
  avatarDataUrl: string | null = null,
): FollowUser {
  return {
    walletAddress: walletAddress.toLowerCase(),
    username,
    bio,
    avatarDataUrl,
  };
}

async function resolveFollowUser(walletAddress: string): Promise<FollowUser | null> {
  const key = walletAddress.toLowerCase();
  if (isOfficialAddress(key)) {
    return toFollowUser(key, OFFICIAL_USERNAME, OFFICIAL_BIO, OFFICIAL_AVATAR_URL);
  }

  const profile = await getProfile(key);
  if (profile?.username) {
    return toFollowUser(profile.walletAddress, profile.username, profile.bio ?? "", profile.avatarDataUrl);
  }

  const posts = await listContent({ authorAddress: key, limit: 1 });
  const fromPost = posts[0]?.authorUsername;
  if (fromPost) {
    const byName = await getProfileByUsername(fromPost);
    if (byName?.username) {
      return toFollowUser(byName.walletAddress, byName.username, byName.bio ?? "", byName.avatarDataUrl);
    }
    return toFollowUser(key, fromPost);
  }

  const allProfiles = await listProfiles();
  const byAddress = allProfiles.find((p) => p.walletAddress.toLowerCase() === key);
  if (byAddress?.username) {
    return toFollowUser(byAddress.walletAddress, byAddress.username, byAddress.bio ?? "", byAddress.avatarDataUrl);
  }

  return null;
}

async function enrichAddresses(addresses: string[]): Promise<FollowUser[]> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const rows = await Promise.all(unique.map((addr) => resolveFollowUser(addr)));
  return rows.map((user, i) => {
    if (user) return user;
    const addr = unique[i]!;
    return toFollowUser(addr, `${addr.slice(0, 6)}…${addr.slice(-4)}`);
  });
}

export async function GET(req: NextRequest) {
  const address = parseAddress(req.nextUrl.searchParams.get("address") ?? "");
  const list = req.nextUrl.searchParams.get("list");
  const target = parseAddress(req.nextUrl.searchParams.get("target") ?? "");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  if (target) {
    const following = await isFollowing(address, target);
    return NextResponse.json({ following });
  }

  const session = getSessionFromRequest(req);
  if (!session || session.address !== address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (list === "following") {
    const rows = await listFollowing(address);
    const users = await enrichAddresses(rows.map((r) => r.followingAddress));
    return NextResponse.json({ users });
  }

  if (list === "followers") {
    const rows = await listFollowers(address);
    const users = await enrichAddresses(rows.map((r) => r.followerAddress));
    return NextResponse.json({ users });
  }

  const [followingRows, followerRows] = await Promise.all([
    listFollowing(address),
    listFollowers(address),
  ]);
  const [following, followers] = await Promise.all([
    enrichAddresses(followingRows.map((r) => r.followingAddress)),
    enrichAddresses(followerRows.map((r) => r.followerAddress)),
  ]);

  return NextResponse.json({ following, followers });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = parseAddress(body.address);
  const targetAddress = parseAddress(body.targetAddress);

  if (!address || !targetAddress) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const authErr = await requireWalletAuth(req, address);
  if (authErr) return authErr;

  const targetProfile = await resolveFollowUser(targetAddress);
  if (!targetProfile?.username) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await toggleFollow(address, targetProfile.walletAddress);
  return NextResponse.json({ ...result, user: targetProfile });
}
