import type { UserProfile } from "@/lib/profile-store";
import { normalizeUsernameFromPasskey } from "@/lib/security/validation";
import { cacheUsername } from "@/lib/username-cache";

export async function completePasskeyRegistration(
  address: string,
  passkeyUsername: string,
  refreshProfile: (addressOverride?: string) => Promise<UserProfile | null>,
  applyProfile?: (profile: UserProfile | null) => void,
): Promise<{ profile: UserProfile | null; error?: string }> {
  const username = normalizeUsernameFromPasskey(passkeyUsername);
  if (!username) {
    return {
      profile: null,
      error: "Username must be 3–24 characters: letters, numbers, underscore only",
    };
  }

  await refreshProfile(address);

  const res = await fetch("/api/profile/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address, username }),
  });
  const data = await res.json();

  if (!res.ok) {
    const profile = await refreshProfile(address);
    return { profile, error: (data.error as string) ?? "Username not available" };
  }

  const profile = (data.profile as UserProfile) ?? (await refreshProfile(address));
  if (profile?.username) {
    cacheUsername(address, profile.username);
    applyProfile?.(profile);
  }
  return { profile };
}
