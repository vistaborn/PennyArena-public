"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";

type PreviewPayload = {
  title: string | null;
  description: string | null;
  imageProxy: string | null;
  favicon: string;
  hostname: string;
};

export function LinkPreview({
  url,
  title,
  image,
  embedded,
}: {
  url: string;
  title?: string;
  image?: string | null;
  /** Render as a static card (e.g. compose preview) instead of a link */
  embedded?: boolean;
}) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const safeHref = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  }, [url]);

  const immediateFavicon = useMemo(
    () => `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
    [hostname],
  );

  useEffect(() => {
    let cancelled = false;
    setImgError(false);
    setLoading(true);
    setPreview(null);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PreviewPayload | null) => {
        if (!cancelled && data) setPreview(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const displayTitle = title || preview?.title || hostname;
  const displayDescription = preview?.description;
  const thumbSrc = !imgError
    ? preview?.imageProxy ??
      (image && !preview
        ? `/api/link-preview/image?url=${encodeURIComponent(image)}`
        : null)
    : null;
  const fallbackIcon = preview?.favicon ?? immediateFavicon;

  const cardClass =
    "mt-3 flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02] transition hover:border-penny-gold/40";

  const thumbColumn = (
    <div className="relative w-28 shrink-0 self-stretch overflow-hidden bg-white/5">
      {loading && !thumbSrc ? (
        <div className="flex h-full min-h-24 items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-white/10" />
        </div>
      ) : thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full min-h-24 items-center justify-center">
          {fallbackIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fallbackIcon} alt="" className="h-10 w-10 rounded-lg" />
          ) : (
            <Link2 className="text-[var(--muted)]" size={28} />
          )}
        </div>
      )}
    </div>
  );

  const inner = (
    <>
      {thumbColumn}
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
        {loading && !preview ? (
          <>
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-white/10" />
          </>
        ) : (
          <>
            <p className="line-clamp-2 text-sm font-medium">{displayTitle}</p>
            {displayDescription && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                {displayDescription}
              </p>
            )}
          </>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-penny-mint">
          {preview?.hostname ?? hostname}
          {!embedded && <ExternalLink size={12} />}
        </p>
      </div>
    </>
  );

  if (embedded || !safeHref) {
    return <div className={cardClass}>{inner}</div>;
  }

  return (
    <Link
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClass}
    >
      {inner}
    </Link>
  );
}
