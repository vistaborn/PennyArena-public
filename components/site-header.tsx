"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Home, Trophy, Gift, Settings, Plus, Swords, LogOut, Users } from "lucide-react";
import { SearchIcon } from "@/components/search-icon";
import { useApp } from "@/components/app-provider";
import { useWeb3 } from "@/components/web3-provider";
import { useLoginModal } from "@/components/login-modal-context";
import { getCachedUsername } from "@/lib/username-cache";
import { PennyLogo } from "@/components/penny-logo";
import { UserAvatar } from "@/components/user-avatar";
import { cn, readResponseJson } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { profile, logout } = useApp();
  const { isConnected, account } = useWeb3();
  const { showLogin } = useLoginModal();
  const [incomingBattles, setIncomingBattles] = useState(0);
  const [resultNotifications, setResultNotifications] = useState(0);

  const battleBadge = incomingBattles + resultNotifications;

  type NavIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

  const nav: {
    href: string;
    icon: NavIcon;
    label: string;
    shortLabel?: string;
    iconSize?: number;
  }[] = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/leaderboard", icon: Trophy, label: "Leaders" },
    { href: "/rewards", icon: Gift, label: "Rewards & Wallet", shortLabel: "Rewards" },
    { href: "/connections", icon: Users, label: "Connections", shortLabel: "Connect" },
    { href: "/search", icon: SearchIcon, label: "Search", iconSize: 16 },
  ];

  const username = profile?.username || getCachedUsername(account.address);
  const profileHref = username ? `/u/${username}` : "/me";

  useEffect(() => {
    if (!isConnected || !account.address) {
      setIncomingBattles(0);
      setResultNotifications(0);
      return;
    }
    const load = () => {
      fetch(`/api/duels/pending?address=${encodeURIComponent(account.address!)}`, {
        cache: "no-store",
        credentials: "include",
      })
        .then(async (r) => {
          const d = await readResponseJson<{ incoming?: unknown[] }>(r);
          if (r.ok && d) setIncomingBattles((d.incoming ?? []).length);
          else setIncomingBattles(0);
        })
        .catch(() => setIncomingBattles(0));
      fetch(`/api/duels/notifications?address=${encodeURIComponent(account.address!)}`, {
        cache: "no-store",
        credentials: "include",
      })
        .then(async (r) => {
          const d = await readResponseJson<{ pending?: unknown[] }>(r);
          if (r.ok && d) setResultNotifications((d.pending ?? []).length);
          else setResultNotifications(0);
        })
        .catch(() => setResultNotifications(0));
    };
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [isConnected, account.address]);

  return (
    <>
      <header className="site-header-bar sticky top-0 z-40 border-b border-[var(--border)]">
        <div className="mx-auto w-full max-w-[min(100%,88rem)] px-[clamp(1rem,3vw,2rem)] py-2.5 md:py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4 lg:gap-8">
              <PennyLogo />
              <nav className="hidden items-center gap-5 text-sm md:flex">
                {nav.map(({ href, icon: Icon, label, iconSize }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap transition hover:text-penny-gold",
                      pathname === href ? "text-penny-gold" : "text-[var(--muted)]",
                    )}
                  >
                    {href === "/search" ? (
                      <SearchIcon size={iconSize ?? 16} strokeWidth={2} />
                    ) : (
                      <Icon size={iconSize ?? 16} />
                    )}
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="hidden shrink-0 items-center gap-2 sm:gap-3 md:flex">
              {isConnected ? (
                <>
                  <Link
                    href="/battle"
                    className={cn(
                      "btn-secondary btn-header relative gap-1.5 px-3",
                      pathname.startsWith("/battle") && "border-penny-gold/40 text-penny-gold",
                    )}
                  >
                    <Swords size={16} className="shrink-0 self-center" />
                    <span className="btn-header-label">Battle</span>
                    {battleBadge > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-penny-coral px-1 text-[10px] font-bold text-white">
                        {battleBadge > 9 ? "9+" : battleBadge}
                      </span>
                    )}
                  </Link>
                  <Link
                    href={profileHref}
                    className="btn-secondary btn-header max-w-[8.5rem] gap-1.5 truncate px-3 sm:max-w-none"
                  >
                    <UserAvatar
                      username={username ?? "me"}
                      avatarDataUrl={profile?.avatarDataUrl}
                      size={20}
                      className="shrink-0 self-center rounded-full"
                    />
                    <span className="btn-header-label truncate">
                      {username ? `@${username}` : "Profile"}
                    </span>
                  </Link>
                  <Link href="/compose" className="btn-primary btn-header gap-1.5 px-3">
                    <Plus size={16} className="shrink-0 self-center" />
                    <span className="btn-header-label">Post</span>
                  </Link>
                </>
              ) : (
                <button type="button" className="btn-primary btn-header min-w-[5.75rem] px-5" onClick={showLogin}>
                  Log in / Register
                </button>
              )}
              {isConnected && (
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-penny-coral"
                  title="Log out"
                  onClick={() => logout()}
                >
                  <LogOut size={18} />
                </button>
              )}
              <Link
                href="/settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/5"
                title="Settings"
              >
                <Settings size={18} />
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1 md:hidden">
              {isConnected && (
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-penny-coral"
                  title="Log out"
                  onClick={() => logout()}
                >
                  <LogOut size={18} />
                </button>
              )}
              <Link
                href="/settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/5"
                title="Settings"
              >
                <Settings size={18} />
              </Link>
            </div>
          </div>

          {isConnected ? (
            <div className="mt-2 flex w-full items-center gap-2 md:hidden">
              <Link
                href="/battle"
                className={cn(
                  "btn-secondary btn-header relative shrink-0 gap-1.5 px-3",
                  pathname.startsWith("/battle") && "border-penny-gold/40 text-penny-gold",
                )}
              >
                <Swords size={16} className="shrink-0 self-center" />
                <span className="btn-header-label">Battle</span>
                {battleBadge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-penny-coral px-1 text-[10px] font-bold text-white">
                    {battleBadge > 9 ? "9+" : battleBadge}
                  </span>
                )}
              </Link>
              <Link
                href={profileHref}
                className="btn-secondary btn-header max-w-[9.5rem] shrink-0 gap-1.5 truncate px-3"
              >
                <UserAvatar
                  username={username ?? "me"}
                  avatarDataUrl={profile?.avatarDataUrl}
                  size={20}
                  className="shrink-0 self-center rounded-full"
                />
                <span className="btn-header-label truncate">
                  {username ? `@${username}` : "Profile"}
                </span>
              </Link>
              <Link href="/compose" className="btn-primary btn-header min-w-0 flex-1 gap-1.5 px-3">
                <Plus size={16} className="shrink-0 self-center" />
                <span className="btn-header-label">Post</span>
              </Link>
            </div>
          ) : (
            <div className="mt-2 flex justify-end md:hidden">
              <button type="button" className="btn-primary btn-header px-5" onClick={showLogin}>
                Log in / Register
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className="site-mobile-nav fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] md:hidden">
        <div className="site-mobile-nav-inner">
          {nav.map(({ href, icon: Icon, label, shortLabel }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "mobile-nav-link",
                pathname === href ? "text-penny-gold" : "text-[var(--muted)]",
              )}
            >
              <span className="mobile-nav-icon">
                {href === "/search" ? (
                  <SearchIcon size={20} strokeWidth={2} />
                ) : (
                  <Icon size={20} strokeWidth={2} />
                )}
              </span>
              <span className="mobile-nav-label">{shortLabel ?? label}</span>
            </Link>
          ))}
          {isConnected && (
            <Link
              href={profileHref}
              className={cn(
                "mobile-nav-link",
                pathname.startsWith("/u/") || pathname === "/me"
                  ? "text-penny-gold"
                  : "text-[var(--muted)]",
              )}
            >
              <span className="mobile-nav-icon">
                <UserAvatar
                  username={username ?? "me"}
                  avatarDataUrl={profile?.avatarDataUrl}
                  size={20}
                  className="rounded-full"
                />
              </span>
              <span className="mobile-nav-label">Profile</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
