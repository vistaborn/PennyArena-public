"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";

export function SavePostButton({ contentId }: { contentId: string }) {
  const { isConnected, account } = useWeb3();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!account.address) {
      setSaved(false);
      return;
    }
    fetch(
      `/api/bookmarks?address=${encodeURIComponent(account.address)}&contentId=${encodeURIComponent(contentId)}`,
      { credentials: "include", cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : { bookmarked: false }))
      .then((d) => setSaved(Boolean(d.bookmarked)))
      .catch(() => setSaved(false));
  }, [contentId, account.address]);

  const save = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          contentId,
          action: saved ? undefined : "add",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(data.bookmarked);
      toast.success(data.bookmarked ? "Saved to your posts" : "Removed from saved");
      if (data.bookmarked) {
        window.dispatchEvent(new CustomEvent("penny:bookmarks-changed"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn-action flex items-center justify-center gap-1 px-3 py-1.5 text-sm ${
        saved ? "border-penny-gold/40 text-penny-gold" : ""
      }`}
      onClick={save}
      disabled={busy}
    >
      <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
      {busy ? "Saving…" : saved ? "Saved" : "Save"}
    </button>
  );
}
