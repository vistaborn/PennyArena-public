"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy } from "lucide-react";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";
import { PasskeySignIn } from "@/components/passkey-sign-in";
import { completePasskeyRegistration } from "@/lib/complete-registration";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupError = searchParams.get("error");
  const { account, isConnected } = useWeb3();
  const { profile, refreshProfile, applyProfile, logout } = useApp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const referralLink =
    typeof window !== "undefined" && profile?.referralCode
      ? `${window.location.origin}/?ref=${profile.referralCode}`
      : null;

  const copyReferral = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const sendEmailCode = async () => {
    if (!account.address) return;
    await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address: account.address, email }),
    });
    setMsg("Verification code sent");
  };

  const verifyEmail = async () => {
    if (!account.address) return;
    const res = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address: account.address, action: "verify", code }),
    });
    setMsg(res.ok ? "Email verified" : "Invalid code");
    if (res.ok) await refreshProfile();
  };

  const deleteAccount = async () => {
    if (!account.address) return;
    if (!confirm("Delete your PennyArena profile permanently? Your on-chain wallet is not removed.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: account.address }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      await logout();
      router.push("/");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      {setupError && (
        <p className="rounded-xl border border-penny-coral/40 bg-penny-coral/10 p-3 text-sm">
          {setupError}
        </p>
      )}

      {!isConnected ? (
        <div className="card">
          <PasskeySignIn
            onSuccess={async (address, meta) => {
              if (meta?.registeredUsername) {
                const { profile: p, error } = await completePasskeyRegistration(
                  address,
                  meta.registeredUsername,
                  refreshProfile,
                  applyProfile,
                );
                if (p?.username) router.push(`/u/${p.username}`);
                else if (error) setMsg(error);
                return;
              }
              const p = await refreshProfile(address);
              if (p?.username) router.push(`/u/${p.username}`);
              else router.push("/settings");
            }}
          />
        </div>
      ) : (
        <>
          {profile?.username && (
            <div className="card">
              <p className="text-sm text-[var(--muted)]">Signed in as</p>
              <p className="mt-1 font-semibold">@{profile.username}</p>
              <Link
                href={`/u/${profile.username}/edit`}
                className="mt-3 inline-block text-sm text-penny-mint hover:underline"
              >
                Edit profile →
              </Link>
            </div>
          )}

          <div className="card space-y-3">
            <h2 className="font-semibold">Email verification</h2>
            <p className="text-sm text-[var(--muted)]">
              Optional email verification for account recovery (not yet wired to a mail provider).
            </p>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="button" className="btn-secondary w-full" onClick={sendEmailCode}>
              Send code
            </button>
            <input
              className="input"
              placeholder="6-char code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="button" className="btn-secondary w-full" onClick={verifyEmail}>
              Verify
            </button>
            {profile?.emailVerified && (
              <p className="text-sm text-penny-mint">Verified: {profile.email}</p>
            )}
          </div>

          <div className="card space-y-3 border-penny-gold/25 bg-penny-gold/5">
            <div>
              <h2 className="font-semibold text-penny-gold">Invite friends</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Share your link — you earn PENNY when someone joins.
              </p>
            </div>
            {referralLink ? (
              <div className="flex gap-2">
                <p className="input flex-1 break-all font-mono text-xs leading-relaxed">
                  {referralLink}
                </p>
                <button
                  type="button"
                  className="btn-primary flex shrink-0 items-center gap-1.5 px-4"
                  onClick={copyReferral}
                >
                  <Copy size={16} />
                  {referralCopied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">—</p>
            )}
          </div>

          <div className="card space-y-3 border-penny-coral/20">
            <button type="button" className="btn-secondary w-full" onClick={logout}>
              Log out
            </button>
            <div>
              <button
                type="button"
                className="w-full rounded-xl border border-penny-coral/40 px-4 py-2 text-sm font-medium text-penny-coral transition hover:bg-penny-coral/10"
                disabled={deleting}
                onClick={deleteAccount}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </button>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Permanently removes your PennyArena profile, sessions, and points. Your passkey
                wallet on Arc is not deleted on-chain.
              </p>
            </div>
          </div>
        </>
      )}

      {msg && <p className="text-sm text-penny-mint">{msg}</p>}
    </div>
  );
}
