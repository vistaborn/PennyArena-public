"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { generateClientId } from "@/lib/utils";
import { clearCachedUsername, cacheUsername, getCachedUsername } from "@/lib/username-cache";
import type { UserProfile } from "@/lib/profile-store";

const SESSION_KEY = "penny_session_id";
const REF_KEY = "penny_pending_ref";

type AppContextType = {
  profile: UserProfile | null;
  sessionId: string | null;
  refreshProfile: (addressOverride?: string) => Promise<UserProfile | null>;
  applyProfile: (profile: UserProfile | null) => void;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateClientId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { account, isConnected, clearSession, isInitialized } = useWeb3();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem(REF_KEY, ref);
  }, []);

  const applyProfile = useCallback((p: UserProfile | null) => {
    setProfile(p);
  }, []);

  const refreshProfile = useCallback(
    async (addressOverride?: string): Promise<UserProfile | null> => {
      const address = addressOverride ?? account.address;
      if (!address) {
        setProfile(null);
        return null;
      }
      const sid = getOrCreateSessionId();
      setSessionId(sid);
      const pendingRef = localStorage.getItem(REF_KEY);
      const res = await fetch("/api/profile/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address,
          sessionId: sid,
          userAgent: navigator.userAgent,
          referralCode: pendingRef ?? undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.profile?.username) cacheUsername(address, data.profile.username);
        if (pendingRef) localStorage.removeItem(REF_KEY);
        return data.profile as UserProfile;
      }

      const fallback = await fetch(`/api/profile?address=${encodeURIComponent(address)}`, {
        credentials: "include",
      });
      if (fallback.ok) {
        const data = await fallback.json();
        setProfile(data.profile);
        if (data.profile?.username) cacheUsername(address, data.profile.username);
        return data.profile as UserProfile;
      }
      return null;
    },
    [account.address],
  );

  useEffect(() => {
    if (!isInitialized) return;
    if (isConnected && account.address) {
      refreshProfile();
      return;
    }
    if (!isConnected) setProfile(null);
  }, [isConnected, account.address, refreshProfile, isInitialized]);

  const logout = useCallback(async () => {
    clearCachedUsername(account.address);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSession();
    setProfile(null);
  }, [clearSession, account.address]);

  return (
    <AppContext.Provider value={{ profile, sessionId, refreshProfile, applyProfile, logout }}>
      {children}
    </AppContext.Provider>
  );
}
