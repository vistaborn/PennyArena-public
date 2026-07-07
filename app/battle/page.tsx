import { Suspense } from "react";
import { BattlePageClient } from "@/components/battle-page";

export default function BattlePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <BattlePageClient />
    </Suspense>
  );
}
