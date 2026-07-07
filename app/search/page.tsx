"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/search-icon";
import { SearchCatMascot } from "@/components/search-cat-mascot";
import type { ContentItem } from "@/lib/content-store";
import { TopicLabel } from "@/components/topic-label";
import { timeAgo } from "@/lib/utils";

function resizeSearchField(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
  const paddingY =
    parseFloat(getComputedStyle(el).paddingTop) +
    parseFloat(getComputedStyle(el).paddingBottom);
  const lines = Math.max(1, (el.scrollHeight - paddingY) / lineHeight);
  const expand = Math.min(1, Math.max(0, (lines - 1) / 1.25));
  const radius = 16 + (9999 - 16) * (1 - expand);
  el.style.setProperty("--search-field-radius", `${radius}px`);
  const expanded = lines > 1.05;
  el.classList.toggle("search-bar-field-expanded", expanded);
  el.closest(".search-bar")?.classList.toggle("search-bar-expanded", expanded);
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    resizeSearchField(fieldRef.current);
  }, [q]);

  const search = async () => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setUser(data.user ?? null);
  };

  return (
    <div className="space-y-5">
      <SearchCatMascot />
      <div className="search-bar mx-auto w-full max-w-lg">
        <textarea
          ref={fieldRef}
          rows={1}
          className="search-bar-field"
          placeholder="Search topics, posts, @usernames…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            requestAnimationFrame(() => resizeSearchField(e.target));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              search();
            }
          }}
        />
        <button
          type="button"
          className="search-bar-icon"
          onClick={search}
          aria-label="Search"
        >
          <SearchIcon size={22} strokeWidth={2} />
        </button>
      </div>

      {user && (
        <Link href={`/u/${user.username}`} className="card block hover:border-penny-gold/40">
          Profile match: @{user.username}
        </Link>
      )}

      {items.map((item) => (
        <Link
          key={item.id}
          href={`/post/${item.id}`}
          className="card block transition hover:border-penny-gold/40"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-penny-gold">@{item.authorUsername}</span>
            <span className="text-[var(--muted)]">· {timeAgo(item.createdAt)}</span>
            <TopicLabel slug={item.topicSlug} iconSize={13} />
          </div>
          {item.title && <p className="mt-2 font-medium">{item.title}</p>}
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-3">{item.body}</p>
        </Link>
      ))}
    </div>
  );
}
