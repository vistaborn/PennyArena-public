"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWeb3 } from "@/components/web3-provider";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";

type FollowUser = {
  walletAddress: string;
  username: string;
  bio: string;
  avatarDataUrl: string | null;
};

export default function ConnectionsPage() {
  const { account, isConnected } = useWeb3();
  const [tab, setTab] = useState<"following" | "followers">("following");
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!account.address) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/follows?address=${encodeURIComponent(account.address)}&list=following`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { users: [] })),
      fetch(`/api/follows?address=${encodeURIComponent(account.address)}&list=followers`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { users: [] })),
    ])
      .then(([fData, rData]) => {
        setFollowing(fData.users ?? []);
        setFollowers(rData.users ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isConnected || !account.address) {
      setLoading(false);
      return;
    }
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const onFollowsChanged = () => load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("penny:follows-changed", onFollowsChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("penny:follows-changed", onFollowsChanged);
    };
  }, [isConnected, account.address]);

  if (!isConnected) {
    return (
      <div className="card">
        <p>Log in to view your connections.</p>
      </div>
    );
  }

  const list = tab === "following" ? following : followers;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Connections</h1>

      <div className="flex gap-2">
        <button
          type="button"
          className={`profile-tab ${tab === "following" ? "profile-tab-active" : ""}`}
          onClick={() => setTab("following")}
        >
          Following {following.length > 0 && <span className="opacity-70">({following.length})</span>}
        </button>
        <button
          type="button"
          className={`profile-tab ${tab === "followers" ? "profile-tab-active" : ""}`}
          onClick={() => setTab("followers")}
        >
          Followers {followers.length > 0 && <span className="opacity-70">({followers.length})</span>}
        </button>
      </div>

      {loading ? (
        <div className="card text-sm text-[var(--muted)]">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card text-center text-sm text-[var(--muted)]">
              {tab === "following" ? (
                <>
                  You are not following anyone yet. Visit a profile and tap{" "}
                  <span className="text-[var(--fg)]">Follow</span> to add them here.
                </>
              ) : (
                "No followers yet."
              )}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((user) => (
            <div key={user.walletAddress} className="card flex items-center gap-3">
              <Link href={`/u/${user.username}`} className="shrink-0">
                <UserAvatar
                  username={user.username}
                  avatarDataUrl={user.avatarDataUrl}
                  size={44}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${user.username}`} className="font-semibold hover:underline">
                  @{user.username}
                </Link>
                {user.bio && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted)]">{user.bio}</p>
                )}
              </div>
              {tab === "following" && (
                <FollowButton
                  targetAddress={user.walletAddress}
                  targetUsername={user.username}
                  compact
                  onChange={load}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
