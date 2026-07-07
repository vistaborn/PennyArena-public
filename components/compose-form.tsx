"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, ImageIcon, Mic, X } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { getCachedUsername } from "@/lib/username-cache";
import { cacheUserPost } from "@/lib/post-cache";
import { TOPICS, type TopicSlug } from "@/lib/topics";
import { topicSelectLabel } from "@/components/topic-label";
import { LinkPreview } from "@/components/link-preview";
import { extractFirstHttpUrl } from "@/lib/extract-url";
import {
  PUBLISH_FEE_USDC,
  getTreasuryAddress,
  formatUsdc,
} from "@/lib/pricing";
import type { ContentType } from "@/lib/security/validation";
import type { ContentItem } from "@/lib/content-store";

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: `Empty server response (${res.status})` };
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) || `Invalid server response (${res.status})` };
  }
}

function detectType(file: File | null): ContentType {
  if (!file) return "post";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "post";
}

export function ComposeForm() {
  const router = useRouter();
  const { isConnected, account, sendUSDC } = useWeb3();
  const { profile, refreshProfile } = useApp();
  const [topicSlug, setTopicSlug] = useState<TopicSlug>(TOPICS[0].slug);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedLink = useMemo(
    () => extractFirstHttpUrl(body, title),
    [body, title],
  );

  const pickMedia = (kind: "audio" | "video" | "image") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      kind === "audio" ? "audio/*" : kind === "video" ? "video/*" : "image/*";
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      setMediaFile(file);
    };
    input.click();
  };

  const submit = async () => {
    if (!isConnected || !account.address) {
      setError("Log in with passkey first");
      return;
    }
    let activeProfile = profile;
    if (!activeProfile?.username) {
      activeProfile = await refreshProfile();
    }
    const username =
      activeProfile?.username ?? getCachedUsername(account.address);
    if (!username) {
      setError("Log out and register again with a username");
      return;
    }
    if (!title.trim() && !body.trim() && !mediaFile) {
      setError("Add text or attach a photo, audio, or video");
      return;
    }
    const treasury = getTreasuryAddress();
    if (!treasury) {
      setError("Treasury not configured in .env.local");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const publishTxHash = await sendUSDC(treasury, PUBLISH_FEE_USDC);

      let mediaUrl: string | null = null;
      if (mediaFile) {
        const fd = new FormData();
        fd.append("file", mediaFile);
        fd.append("address", account.address);
        const up = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const upData = await readJsonResponse(up);
        if (!up.ok) throw new Error(String(upData.error ?? "Upload failed"));
        mediaUrl = typeof upData.url === "string" ? upData.url : null;
        if (!mediaUrl) throw new Error("Upload returned no URL");
      }

      const type = detectType(mediaFile);

      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: account.address,
          topicSlug,
          type,
          title,
          body,
          mediaUrl,
          linkUrl: detectedLink,
          publishTxHash,
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(String(data.error ?? "Publish failed"));
      const item = data.item as ContentItem | undefined;
      if (item) cacheUserPost(account.address, item);
      await refreshProfile();
      router.push(`/u/${username}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h1 className="text-xl font-bold">New post</h1>
      <p className="text-sm text-[var(--muted)]">
        Publishing costs {formatUsdc(PUBLISH_FEE_USDC)} USDC to treasury on Arc testnet.
      </p>

      <label className="block text-sm">
        Topic
        <select
          className="input mt-1"
          value={topicSlug}
          onChange={(e) => setTopicSlug(e.target.value as TopicSlug)}
        >
          {TOPICS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {topicSelectLabel(t.slug)}
            </option>
          ))}
        </select>
      </label>

      <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className="input min-h-[120px]"
        placeholder="Write something…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {detectedLink && <LinkPreview url={detectedLink} embedded />}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm"
          onClick={() => pickMedia("image")}
        >
          <ImageIcon size={16} /> Add photo
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm"
          onClick={() => pickMedia("audio")}
        >
          <Mic size={16} /> Add audio
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm"
          onClick={() => pickMedia("video")}
        >
          <Film size={16} /> Add video
        </button>
        {mediaFile && (
          <span className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
            {mediaFile.name}
            <button
              type="button"
              className="text-[var(--muted)] hover:text-penny-coral"
              onClick={() => setMediaFile(null)}
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-sm text-penny-coral">{error}</p>}

      <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
        {busy ? "Publishing…" : `Publish · $${formatUsdc(PUBLISH_FEE_USDC)}`}
      </button>
    </div>
  );
}
