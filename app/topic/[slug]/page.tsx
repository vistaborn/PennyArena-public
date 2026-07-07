import { getTopic } from "@/lib/topics";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicFeed } from "@/components/topic-feed";
import { TopicLabel } from "@/components/topic-label";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  return (
    <div className="space-y-4">
      <div className="card">
        <Link href="/" className="text-sm text-penny-mint hover:underline">
          ← Back to feed
        </Link>
        <h1 className="mt-2 text-xl font-bold">
          <TopicLabel slug={slug} iconSize={22} />
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Posts in this topic — vote, tip, comment, and open duels.
        </p>
        <Link href="/compose" className="btn-primary mt-3 inline-block text-sm">
          Post in {topic.title}
        </Link>
      </div>

      <TopicFeed topicSlug={slug} />
    </div>
  );
}
