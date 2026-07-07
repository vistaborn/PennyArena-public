"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  username: string;
  avatarDataUrl: string | null;
  wins: number;
  losses: number;
  points: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [find, setFind] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const filtered = find
    ? rows.filter((r) => r.username.includes(find.toLowerCase()))
    : rows;

  const rankOf = (username: string) => rows.findIndex((r) => r.username === username) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <button type="button" className="btn-secondary text-sm" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <input
        className="input"
        placeholder="Find yourself by username…"
        value={find}
        onChange={(e) => setFind(e.target.value.toLowerCase())}
      />
      {find && filtered[0] && (
        <p className="text-sm text-penny-gold">
          @{filtered[0].username} — rank #{rankOf(filtered[0].username)} · {filtered[0].wins} wins
        </p>
      )}

      <ol className="space-y-2">
        {filtered.length === 0 ? (
          <li className="card text-center text-sm text-[var(--muted)]">
            {loading ? "Loading…" : "No players yet — win a duel to appear here."}
          </li>
        ) : (
          filtered.map((row) => (
            <li key={row.username} className="card flex items-center gap-3">
              <span className="w-8 text-lg font-bold text-[var(--muted)]">
                {rows.indexOf(row) + 1}
              </span>
              <Link href={`/u/${row.username}`} className="flex flex-1 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-penny-gold/20 text-sm font-bold">
                  {row.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">@{row.username}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.wins}W · {row.losses}L · {row.points} PENNY
                  </p>
                </div>
              </Link>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
