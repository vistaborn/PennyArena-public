"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ProfileView } from "@/components/profile-view";

function ProfilePageInner() {
  const params = useParams();
  const username = params.username as string;
  return <ProfileView username={username} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
