import { getTopic, type TopicSlug } from "@/lib/topics";
import { UsdcIcon } from "@/components/brand-icons";

export function TopicLabel({
  slug,
  iconSize = 14,
  className,
}: {
  slug: string;
  iconSize?: number;
  className?: string;
}) {
  const topic = getTopic(slug);
  if (!topic) {
    return <span className={className}>{slug}</span>;
  }

  if (slug === "usdc-nanopayments") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
        <UsdcIcon size={iconSize} />
        {topic.title}
      </span>
    );
  }

  return (
    <span className={className}>
      {topic.emoji} {topic.title}
    </span>
  );
}

export function topicSelectLabel(slug: TopicSlug): string {
  const topic = getTopic(slug);
  if (!topic) return slug;
  if (slug === "usdc-nanopayments") return `USDC ${topic.title.replace(/^USDC /, "")}`;
  return `${topic.emoji} ${topic.title}`;
}
