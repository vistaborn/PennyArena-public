"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Copy,
  Pencil,
  Swords,
  ThumbsUp,
  Wallet,
} from "lucide-react";
import { ContentCard } from "@/components/content-card";
import { useApp } from "@/components/app-provider";
import { useWeb3 } from "@/components/web3-provider";
import type { ContentItem } from "@/lib/content-store";
import type { Comment } from "@/lib/comment-store";
import type { UserProfile } from "@/lib/profile-store";
import { contentEarningsUsdc, formatUsdc } from "@/lib/pricing";
import { UsdcIcon } from "@/components/brand-icons";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { timeAgo } from "@/lib/utils";
import {
  getCachedUserPosts,
  mergePosts,
  syncCachedPostsToServer,
} from "@/lib/post-cache";

type Tab = "posts" | "comments" | "saved";

type BookmarkRow = { bookmarkedAt: string; item: ContentItem };

type CommentRow = Comment & {
  postTitle: string;
  postAuthor?: string;
};

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ProfileView({ username }: { username: string }) {
  const searchParams = useSearchParams();
  const { profile: myProfile, refreshProfile } = useApp();
  const { account, isConnected } = useWeb3();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [tab, setTab] = useState<Tab>("posts");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    const res = await fetch(`/api/profile/by-username?u=${encodeURIComponent(username)}`, {
      credentials: "include",
    });

    let p: UserProfile | null = null;
    if (res.ok) {
      const d = await res.json();
      p = d.profile as UserProfile;
      setProfile(p);
    } else if (myProfile?.username === username) {
      p = myProfile;
      setProfile(myProfile);
    } else {
      setNotFound(true);
      setProfile(null);
    }

    if (p?.walletAddress) {
      const cached =
        account.address?.toLowerCase() === p.walletAddress.toLowerCase()
          ? getCachedUserPosts(account.address)
          : [];
      if (cached.length > 0 && account.address) {
        await syncCachedPostsToServer(account.address, cached);
      }
      const contentRes = await fetch(
        `/api/content?author=${encodeURIComponent(p.walletAddress)}`,
      );
      const c = await contentRes.json();
      setItems(mergePosts(c.items ?? [], cached));
    } else {
      setItems([]);
    }

    setLoading(false);
  }, [username, myProfile?.username, account.address]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const onPostsChanged = () => {
      loadProfile();
    };
    window.addEventListener("penny:profile-posts-changed", onPostsChanged);
    return () => window.removeEventListener("penny:profile-posts-changed", onPostsChanged);
  }, [loadProfile]);

  useEffect(() => {
    if (myProfile?.username === username) {
      setProfile(myProfile);
    }
  }, [myProfile?.username, myProfile?.points, myProfile?.stats, username, myProfile]);

  useEffect(() => {
    if (!account.address || myProfile?.username !== username) return;
    refreshProfile(account.address);
    const onFocus = () => refreshProfile(account.address!);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [account.address, username, myProfile?.username, refreshProfile]);

  const isOwn =
    Boolean(
      profile?.walletAddress &&
        account.address &&
        profile.walletAddress.toLowerCase() === account.address.toLowerCase(),
    ) || myProfile?.username === username;

  useEffect(() => {
    if (!isOwn || !profile?.walletAddress) return;
    fetch(`/api/comments/by-author?author=${encodeURIComponent(profile.walletAddress)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []));
    if (account.address) {
      fetch(`/api/bookmarks?address=${encodeURIComponent(account.address)}`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setBookmarks(d.items ?? []))
        .catch(() => setBookmarks([]));
    }
  }, [isOwn, profile?.walletAddress, account.address]);

  useEffect(() => {
    if (!isOwn || tab !== "saved" || !account.address) return;
    const loadSaved = () => {
      fetch(`/api/bookmarks?address=${encodeURIComponent(account.address!)}`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setBookmarks(d.items ?? []))
        .catch(() => setBookmarks([]));
    };
    loadSaved();
    window.addEventListener("penny:bookmarks-changed", loadSaved);
    return () => window.removeEventListener("penny:bookmarks-changed", loadSaved);
  }, [isOwn, tab, account.address]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "saved" || t === "comments" || t === "posts") {
      setTab(t);
    }
  }, [searchParams]);

  const profilePosts = useMemo(
    () =>
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const stats = useMemo(() => {
    const votesReceived = items.reduce((s, i) => s + i.likeCount, 0);
    const commentsOnPosts = items.reduce((s, i) => s + i.commentCount, 0);
    const earnedUsdc =
      items.reduce((s, i) => s + contentEarningsUsdc(i), 0) +
      (profile?.stats.duelEarningsUsdc ?? 0);
    return { votesReceived, commentsOnPosts, earnedUsdc };
  }, [items, profile?.stats.duelEarningsUsdc]);

  const copyWallet = async () => {
    if (!profile?.walletAddress) return;
    await navigator.clipboard.writeText(profile.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabs: { key: Tab; label: string; count: number; ownOnly?: boolean }[] = [
    { key: "posts", label: "Posts", count: profilePosts.length },
    ...(isOwn
      ? [
          { key: "comments" as Tab, label: "Comments", count: comments.length, ownOnly: true },
          { key: "saved" as Tab, label: "Saved posts", count: bookmarks.length, ownOnly: true },
        ]
      : []),
  ];

  if (loading && !profile) {
    return <div className="card">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="card text-center">
        <p className="text-[var(--muted)]">
          {notFound ? "Profile not found." : "Could not load profile."}
        </p>
        <Link href="/" className="btn-secondary mt-3 inline-block text-sm">
          Back to feed
        </Link>
      </div>
    );
  }

  const joined = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card flex flex-col items-center text-center">
          <UserAvatar
            username={profile.username}
            avatarDataUrl={profile.avatarDataUrl}
            size={112}
            className="rounded-2xl"
          />

          {isOwn && (
            <Link href={`/u/${profile.username}/edit`} className="btn-secondary mt-4 w-full text-sm">
              <span className="flex items-center justify-center gap-1.5">
                <Pencil size={14} /> Edit profile
              </span>
            </Link>
          )}
          {isOwn && (
            <Link href="/connections" className="btn-secondary mt-2 w-full text-sm">
              Connections
            </Link>
          )}
        </div>

        <div className="card space-y-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Earned from votes + tips
          </p>
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-penny-mint">
            <UsdcIcon size={20} />
            {formatUsdc(stats.earnedUsdc)}
          </p>
          {isConnected && isOwn && (
            <Link href="/rewards" className="btn-secondary flex w-full items-center justify-center gap-1.5 text-sm">
              <Wallet size={14} /> Wallet
            </Link>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-penny-mint">
            Arena
          </Link>
          {" / "}
          <span>Users</span>
          {" / "}
          <span className="text-[var(--fg)]">@{profile.username}</span>
        </p>

        <div className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="flex flex-wrap items-center gap-1 text-2xl font-bold">
                  @{profile.username}
                  {profile.isOfficial && (
                    <>
                      <BadgeCheck size={18} className="-mt-px shrink-0 text-penny-gold" />
                      <span className="rounded-full bg-penny-gold/15 px-2 py-0.5 text-xs font-medium text-penny-gold">
                        Official
                      </span>
                    </>
                  )}
                </h1>
                {!isOwn && (
                  <FollowButton
                    targetAddress={profile.walletAddress}
                    targetUsername={profile.username}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {profile.bio || "No bio yet"}
              </p>
            </div>
            <span className="text-xs text-[var(--muted)]">
              Active {timeAgo(profile.updatedAt ?? profile.createdAt)}
            </span>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-[var(--muted)]">Joined</dt>
              <dd>{joined}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-[var(--muted)]">Wallet</dt>
              <dd className="font-mono text-xs">{shortAddress(profile.walletAddress)}</dd>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-penny-mint"
                onClick={copyWallet}
                title="Copy address"
              >
                <Copy size={14} />
              </button>
              {copied && <span className="text-xs text-penny-mint">Copied</span>}
            </div>
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <div className="profile-stat">
            <span className="profile-stat-value">{stats.votesReceived}</span>
            <span className="profile-stat-label">Votes received</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">
              {formatUsdc(profile.stats.tipsSentUsdc)}
            </span>
            <span className="profile-stat-label">Tips sent</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.stats.posts}</span>
            <span className="profile-stat-label">Posts</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.stats.duelWins}</span>
            <span className="profile-stat-label">Duel wins</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.stats.duelLosses}</span>
            <span className="profile-stat-label">Duel losses</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{stats.commentsOnPosts}</span>
            <span className="profile-stat-label">Comments</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.points}</span>
            <span className="profile-stat-label">PENNY</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={`profile-tab ${tab === key ? "profile-tab-active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label} {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          ))}
        </div>

        {isOwn && tab === "posts" && (
          <Link href="/compose" className="compose-prompt">
            Write something…
          </Link>
        )}

        <div className="space-y-4">
          {tab === "posts" && (
            profilePosts.length === 0 ? (
              <div className="card text-center text-sm text-[var(--muted)]">
                No posts yet.
              </div>
            ) : (
              profilePosts.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onDeleted={(id) => {
                    setItems((prev) => prev.filter((p) => p.id !== id));
                    if (account.address) refreshProfile(account.address);
                  }}
                />
              ))
            )
          )}

          {tab === "comments" && isOwn && (
            comments.length === 0 ? (
              <div className="card text-center text-sm text-[var(--muted)]">
                No comments yet.
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="card space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  <Link
                    href={`/post/${c.contentId}`}
                    className="text-xs text-penny-mint hover:underline"
                  >
                    on “{c.postTitle}”
                    {c.postAuthor ? ` · @${c.postAuthor}` : ""} · {timeAgo(c.createdAt)}
                  </Link>
                </div>
              ))
            )
          )}

          {tab === "saved" && isOwn && (
            bookmarks.length === 0 ? (
              <div className="card text-center text-sm text-[var(--muted)]">
                No saved posts yet.
              </div>
            ) : (
              bookmarks.map((b) => (
                <ContentCard key={b.item.id} item={b.item} />
              ))
            )
          )}
        </div>

        {profile.stats.duelWins + profile.stats.duelLosses > 0 && (
          <div className="card flex items-center gap-2 text-sm text-[var(--muted)]">
            <Swords size={16} className="text-penny-gold" />
            {profile.stats.duelWins}W / {profile.stats.duelLosses}L in duels
            <ThumbsUp size={14} className="ml-2" />
            {profile.stats.votesCast} votes cast
          </div>
        )}
      </div>
    </div>
  );
}
