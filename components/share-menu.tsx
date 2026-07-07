"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Copy,
  Mail,
  Repeat2,
  Share2,
} from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { useToast } from "@/components/toast-provider";
import { cacheUserPost } from "@/lib/post-cache";
import {
  ShareMenuIcon,
  TelegramIcon,
  TwitterIcon,
  WhatsAppIcon,
} from "@/components/brand-icons";

export function ShareMenu({
  contentId,
  title,
}: {
  contentId: string;
  title: string;
}) {
  const { isConnected, account } = useWeb3();
  const { profile } = useApp();
  const { showLogin } = useLoginModal();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account.address) {
      setBookmarked(false);
      return;
    }
    fetch(
      `/api/bookmarks?address=${encodeURIComponent(account.address)}&contentId=${encodeURIComponent(contentId)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((d) => setBookmarked(Boolean(d.bookmarked)))
      .catch(() => setBookmarked(false));
  }, [contentId, account.address]);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/post/${contentId}`
      : `/post/${contentId}`;

  const shareText = title ? `${title} — PennyArena` : "Check this on PennyArena";

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setOpen(false);
  };

  const openShare = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const toggleBookmark = async () => {
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
        body: JSON.stringify({ address: account.address, contentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bookmark failed");
      setBookmarked(data.bookmarked);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bookmark failed");
    } finally {
      setBusy(false);
    }
  };

  const repost = async () => {
    if (!isConnected || !account.address) {
      showLogin();
      return;
    }
    if (!profile?.username) {
      toast.error("Complete your profile before reposting");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/content/${contentId}/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Repost failed");
      if (data.item && account.address) {
        cacheUserPost(account.address, data.item);
      }
      setOpen(false);
      toast.success("Reposted to your profile");
      router.refresh();
      window.dispatchEvent(new CustomEvent("penny:profile-posts-changed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Repost failed");
    } finally {
      setBusy(false);
    }
  };

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5";

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-action flex items-center gap-1 px-3 py-1.5 text-sm"
        onClick={() => setOpen(!open)}
        disabled={busy}
      >
        <Share2 size={14} /> Share
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
          <button type="button" className={itemClass} onClick={copyLink}>
            <ShareMenuIcon>
              <Copy size={14} />
            </ShareMenuIcon>
            Copy link
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() =>
              openShare(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
              )
            }
          >
            <ShareMenuIcon>
              <TwitterIcon size={15} />
            </ShareMenuIcon>
            Twitter
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() =>
              openShare(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`)
            }
          >
            <ShareMenuIcon>
              <WhatsAppIcon size={16} />
            </ShareMenuIcon>
            WhatsApp
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() =>
              openShare(
                `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
              )
            }
          >
            <ShareMenuIcon>
              <TelegramIcon size={16} />
            </ShareMenuIcon>
            Telegram
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() =>
              openShare(
                `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(url)}`,
              )
            }
          >
            <ShareMenuIcon>
              <Mail size={14} />
            </ShareMenuIcon>
            Email
          </button>
          <hr className="my-1 border-[var(--border)]" />
          <button type="button" className={itemClass} onClick={repost}>
            <ShareMenuIcon>
              <Repeat2 size={14} />
            </ShareMenuIcon>
            Repost to profile
          </button>
          <button
            type="button"
            className={`${itemClass} ${bookmarked ? "text-penny-gold" : ""}`}
            onClick={toggleBookmark}
          >
            <ShareMenuIcon>
              <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
            </ShareMenuIcon>
            {bookmarked ? "Saved" : "Save bookmark"}
          </button>
        </div>
      )}
    </div>
  );
}
