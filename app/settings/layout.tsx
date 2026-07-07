import { Suspense } from "react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="card">Loading settings…</div>}>{children}</Suspense>;
}
