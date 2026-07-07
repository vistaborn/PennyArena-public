import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isOfficialAddress } from "@/lib/official-account";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function readResponseJson<T = Record<string, unknown>>(
  res: Response,
): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length < 10) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return `${days}d ago`;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Official seed posts get a stable random time within the last 2 weeks. */
export function displayCreatedAt(item: {
  id: string;
  authorAddress: string;
  createdAt: string;
}): string {
  if (!isOfficialAddress(item.authorAddress)) return item.createdAt;
  const hash = hashString(item.id);
  const daysAgo = hash % 14;
  const hoursAgo = (hash >> 4) % 24;
  const minsAgo = (hash >> 8) % 60;
  return new Date(
    Date.now() - daysAgo * 86_400_000 - hoursAgo * 3_600_000 - minsAgo * 60_000,
  ).toISOString();
}
