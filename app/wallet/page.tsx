"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WalletPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/rewards");
  }, [router]);

  return <div className="card">Opening wallet…</div>;
}
