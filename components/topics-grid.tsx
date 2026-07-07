import Link from "next/link";
import { TOPICS } from "@/lib/topics";
import { TopicLabel } from "@/components/topic-label";
import { cn } from "@/lib/utils";

type TopicsGridProps = {
  variant?: "card" | "hero-strip" | "hero-inline";
};

export function TopicsGrid({ variant = "card" }: TopicsGridProps) {
  const isStrip = variant === "hero-strip";
  const isInline = variant === "hero-inline";

  return (
    <section className={cn(!isStrip && !isInline && "card")}>
      {!isInline && (
        <div className={cn("flex flex-wrap items-end justify-between gap-2", isStrip && "mb-2")}>
          <h2 className={cn("font-semibold", isStrip ? "text-xs uppercase tracking-wider text-[var(--muted)]" : "")}>
            Topics
          </h2>
          {!isStrip && (
            <p className="mt-1 w-full text-sm text-[var(--muted)]">
              Pick a topic when you post — duels open when 2+ authors cover the same one.
            </p>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex flex-wrap gap-2",
          !isInline && "mt-4",
          isStrip && "mt-1.5",
        )}
      >
        {TOPICS.map((t) => (
          <Link
            key={t.slug}
            href={`/topic/${t.slug}`}
            className={cn(
              "shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition hover:border-penny-gold/50 hover:bg-penny-gold/10",
              isStrip && "bg-[var(--bg)]/50",
              isInline && "bg-[var(--bg)]/50",
            )}
          >
            <TopicLabel slug={t.slug} iconSize={14} />
          </Link>
        ))}
      </div>
    </section>
  );
}
