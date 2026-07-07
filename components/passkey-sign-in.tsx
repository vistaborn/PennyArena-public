"use client";

import { useState } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { getWebAuthnBlock } from "@/lib/webauthn";

type Props = {
  onSuccess?: (
    walletAddress: string,
    meta?: { registeredUsername?: string },
  ) => void | Promise<void>;
  compact?: boolean;
};

export function PasskeySignIn({ onSuccess, compact }: Props) {
  const { registerPasskey, loginWithPasskey } = useWeb3();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = getWebAuthnBlock();

  const run = async (fn: () => Promise<string>, meta?: { registeredUsername?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const address = await fn();
      await onSuccess?.(address, meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey action failed");
    } finally {
      setBusy(false);
    }
  };

  const register = () => {
    const raw = username.trim();
    if (raw.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    run(() => registerPasskey(raw), { registeredUsername: raw });
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {blocked && (
        <p className="rounded-xl border border-penny-coral/40 bg-penny-coral/10 p-3 text-sm">
          Passkeys need HTTPS (or localhost) and a supported mobile browser such as Safari or
          Chrome.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</p>
      )}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={busy || !!blocked}
        onClick={() => run(loginWithPasskey)}
      >
        Log in with passkey
      </button>
      <div className="text-center text-xs text-[var(--muted)]">or register</div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">@username</span>
        <input
          className="input mt-1"
          placeholder="penny_arena"
          value={username}
          onChange={(e) =>
            setUsername(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "")
                .slice(0, 24),
            )
          }
        />
      </label>
      <p className="text-xs text-[var(--muted)]">
        Same name for passkey and your public profile (3–24 chars, a-z, 0-9, _)
      </p>
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={busy || username.length < 3 || !!blocked}
        onClick={register}
      >
        Register
      </button>
    </div>
  );
}
