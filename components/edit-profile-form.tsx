"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useToast } from "@/components/toast-provider";
import { UserAvatar } from "@/components/user-avatar";
import { cacheUsername } from "@/lib/username-cache";
import { compressAvatarDataUrl, parseJsonResponse } from "@/lib/compress-avatar";
import type { UserProfile } from "@/lib/profile-store";

export function EditProfileForm({ username }: { username: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { account, isConnected } = useWeb3();
  const { profile, refreshProfile, applyProfile } = useApp();
  const toast = useToast();
  const [newUsername, setNewUsername] = useState(username);
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwn =
    profile?.username === username &&
    account.address?.toLowerCase() === profile.walletAddress.toLowerCase();

  useEffect(() => {
    if (!isConnected) return;
    refreshProfile();
  }, [isConnected, refreshProfile]);

  useEffect(() => {
    if (profile?.username === username) {
      setNewUsername(profile.username);
      setBio(profile.bio ?? "");
      setAvatarPreview(profile.avatarDataUrl);
    }
  }, [profile, username]);

  if (!isConnected || !isOwn) {
    return (
      <div className="card">
        <p className="text-sm text-[var(--muted)]">You can only edit your own profile.</p>
        <Link href={`/u/${username}`} className="btn-secondary mt-3 inline-block text-sm">
          Back to profile
        </Link>
      </div>
    );
  }

  const onAvatar = async (file: File | null) => {
    if (!file) return;
    try {
      const compressed = await compressAvatarDataUrl(file);
      setAvatarPreview(compressed);
    } catch {
      toast.error("Could not load that image — try another file");
    }
  };

  const saveAll = async () => {
    if (!account.address) return;
    setBusy(true);
    try {
      let currentUsername = profile?.username ?? username;

      if (newUsername && newUsername !== currentUsername) {
        const usernameRes = await fetch("/api/profile/username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ address: account.address, username: newUsername }),
        });
        const usernameData = await parseJsonResponse<{ error?: string; profile: UserProfile }>(
          usernameRes,
        );
        if (!usernameRes.ok) throw new Error(usernameData.error ?? "Username update failed");
        cacheUsername(account.address, usernameData.profile.username);
        applyProfile(usernameData.profile);
        currentUsername = usernameData.profile.username;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          bio,
          avatarDataUrl: avatarPreview,
        }),
      });
      const data = await parseJsonResponse<{ error?: string; profile: UserProfile }>(res);
      if (!res.ok) throw new Error(data.error ?? "Profile update failed");
      applyProfile(data.profile);
      toast.success("Profile saved");
      router.push(`/u/${currentUsername}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Edit profile</h1>
        <Link href={`/u/${profile?.username ?? username}`} className="btn-ghost text-sm">
          ← Back to profile
        </Link>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Avatar</h2>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar
            username={newUsername || username}
            avatarDataUrl={avatarPreview}
            size={96}
            className="rounded-2xl"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatar(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={14} /> Edit avatar
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Username</h2>
        <p className="text-xs text-[var(--muted)]">Current: @{profile?.username}</p>
        <input
          className="input"
          placeholder="unique_username"
          value={newUsername}
          onChange={(e) =>
            setNewUsername(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "")
                .slice(0, 24),
            )
          }
        />
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Bio</h2>
        <textarea
          className="input min-h-[100px]"
          placeholder="Tell the arena about you…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <button type="button" className="btn-primary w-full" disabled={busy} onClick={saveAll}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
