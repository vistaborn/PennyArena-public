"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PasskeySignIn } from "@/components/passkey-sign-in";
import { useApp } from "@/components/app-provider";
import { completePasskeyRegistration } from "@/lib/complete-registration";

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { refreshProfile, applyProfile } = useApp();
  if (!open) return null;

  const handleSuccess = async (
    address: string,
    meta?: { registeredUsername?: string },
  ) => {
    if (meta?.registeredUsername) {
      const { profile, error } = await completePasskeyRegistration(
        address,
        meta.registeredUsername,
        refreshProfile,
        applyProfile,
      );
      onClose();
      if (profile?.username) {
        router.push(`/u/${profile.username}`);
        return;
      }
      if (error) {
        router.push(`/settings?error=${encodeURIComponent(error)}`);
      }
      return;
    }

    const profile = await refreshProfile(address);
    onClose();
    if (profile?.username) {
      router.push(`/u/${profile.username}`);
    } else {
      router.push("/settings");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card relative w-full max-w-md">
        <button
          type="button"
          className="absolute right-4 top-4 text-[var(--muted)]"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold">Join PennyArena</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pick your @username once — it becomes your passkey and public profile.
        </p>
        <div className="mt-4">
          <PasskeySignIn onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
