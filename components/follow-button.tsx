"use client";

import { useEffect, useState } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";

export function FollowButton({
  targetAddress,
  targetUsername,
  compact,
  onChange,
}: {
  targetAddress: string;
  targetUsername: string;
  compact?: boolean;
  onChange?: () => void;
}) {
  const { isConnected, account } = useWeb3();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isSelf =
    account.address?.toLowerCase() === targetAddress.toLowerCase();

  useEffect(() => {
    if (!isConnected || !account.address || isSelf) {
      setLoaded(true);
      return;
    }
    const load = () => {
      fetch(
        `/api/follows?address=${encodeURIComponent(account.address!)}&target=${encodeURIComponent(targetAddress)}`,
        { cache: "no-store" },
      )
        .then((r) => (r.ok ? r.json() : { following: false }))
        .then((d) => {
          setFollowing(Boolean(d.following));
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isConnected, account.address, targetAddress, isSelf]);

  if (isSelf) return null;

  const toggle = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          targetAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Follow failed");
      setFollowing(data.following);
      toast.success(
        data.following ? `Following @${targetUsername}` : `Unfollowed @${targetUsername}`,
      );
      window.dispatchEvent(new CustomEvent("penny:follows-changed"));
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow failed");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    const sizeClass = compact ? "btn-secondary px-3 py-1 text-xs" : "btn-secondary text-sm";
    return (
      <button type="button" className={`${sizeClass} opacity-70`} disabled>
        Follow
      </button>
    );
  }

  const sizeClass = compact ? "btn-secondary px-3 py-1 text-xs" : "btn-secondary text-sm";
  const followingClass = following
    ? "border-penny-mint/40 text-penny-mint hover:border-penny-coral/40 hover:text-penny-coral"
    : "";

  return (
    <button
      type="button"
      className={`group ${sizeClass} ${followingClass}`}
      onClick={toggle}
      disabled={busy}
    >
      {busy ? (
        "…"
      ) : following ? (
        <>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}
