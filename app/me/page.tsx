"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/components/web3-provider";
import { useApp } from "@/components/app-provider";

export default function MePage() {
  const router = useRouter();
  const { account, isConnected } = useWeb3();
  const { refreshProfile } = useApp();

  useEffect(() => {
    const address = account.address;
    if (!isConnected || !address) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    (async () => {
      const p = await refreshProfile(address);
      if (cancelled) return;
      if (p?.username) {
        router.replace(`/u/${p.username}`);
      } else {
        router.replace("/settings");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, account.address, refreshProfile, router]);

  return <div className="card">Opening your profile…</div>;
}
