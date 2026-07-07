"use client";

import { useEffect, useState } from "react";
import { isOfficialUsername, OFFICIAL_AVATAR_URL } from "@/lib/official-account";

export function UserAvatar({
  username,
  avatarDataUrl,
  size = 40,
  className = "",
}: {
  username: string;
  avatarDataUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const official = isOfficialUsername(username);
  const initialUrl = official ? OFFICIAL_AVATAR_URL : (avatarDataUrl ?? null);
  const [url, setUrl] = useState<string | null>(initialUrl);

  useEffect(() => {
    if (official) {
      setUrl(OFFICIAL_AVATAR_URL);
      return;
    }
    if (avatarDataUrl) {
      setUrl(avatarDataUrl);
      return;
    }
    if (!username) return;
    fetch(`/api/profile/avatar?u=${encodeURIComponent(username)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUrl(d?.avatarDataUrl ?? null))
      .catch(() => setUrl(null));
  }, [username, avatarDataUrl, official]);

  const style = { width: size, height: size };

  const radius = className.includes("rounded-") ? "" : "rounded-full";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`shrink-0 object-cover ${radius} ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-penny-gold/20 font-bold text-penny-gold ${radius} ${className}`}
      style={{ ...style, fontSize: Math.max(10, size * 0.35) }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}
