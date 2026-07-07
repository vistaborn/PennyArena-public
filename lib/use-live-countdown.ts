"use client";

import { useEffect, useState } from "react";

export function useLiveCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const endsIn = endsAt ? Math.max(0, new Date(endsAt).getTime() - now) : 0;
  const hours = Math.floor(endsIn / 3_600_000);
  const mins = Math.floor((endsIn % 3_600_000) / 60_000);
  const secs = Math.floor((endsIn % 60_000) / 1000);

  return {
    endsIn,
    hours,
    mins,
    secs,
    expired: endsIn <= 0,
  };
}
