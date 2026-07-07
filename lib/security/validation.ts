const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const AVATAR_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_CHARS = 500_000;
const MAX_BIO = 280;

export function parseAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !ADDRESS_RE.test(value)) return null;
  return value.toLowerCase() as `0x${string}`;
}

export function parseTxHash(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !TX_HASH_RE.test(value)) return null;
  return value as `0x${string}`;
}

export function parsePositiveAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value > 1_000_000) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function validateEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function validateUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!USERNAME_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Map passkey display name → site @username (lowercase, underscores). */
export function normalizeUsernameFromPasskey(value: string): string | null {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  if (slug.length < 3) return null;
  return validateUsername(slug);
}

export function validateBio(value: unknown): string | null {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return null;
  return value.trim().slice(0, MAX_BIO);
}

export function validateAvatarDataUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  if (value.length > MAX_AVATAR_CHARS) return null;
  if (!AVATAR_RE.test(value)) return null;
  return value;
}

export type ContentType = "post" | "image" | "video" | "audio" | "meme";

export function validateContentType(value: unknown): ContentType | null {
  if (typeof value !== "string") return null;
  const types: ContentType[] = ["post", "image", "video", "audio", "meme"];
  return types.includes(value as ContentType) ? (value as ContentType) : null;
}

export function validateText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max);
}

export function validateHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Allowed media sources for user posts. */
export function validateMediaUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 8_000_000) return null;
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (/^data:(image|video|audio)\/[a-z0-9+.-]+;base64,/i.test(trimmed)) return trimmed;
  const http = validateHttpUrl(trimmed);
  return http;
}
