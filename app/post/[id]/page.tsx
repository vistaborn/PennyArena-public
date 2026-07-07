"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContentCard } from "@/components/content-card";
import { CommentSection } from "@/components/comment-section";
import type { ContentItem } from "@/lib/content-store";

export default function PostPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    fetch(`/api/content/${id}`)
      .then((r) => r.json())
      .then((d) => setItem(d.item ?? null));
  }, [id]);

  if (!item) {
    return <div className="card">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <ContentCard item={item} />
      <div className="card">
        <CommentSection contentId={item.id} />
      </div>
    </div>
  );
}
