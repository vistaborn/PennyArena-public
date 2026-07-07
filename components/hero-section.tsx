import { HeroMascots } from "@/components/hero-mascots";
import { TopicsGrid } from "@/components/topics-grid";

export function HeroSection() {
  return (
    <section className="relative -mx-[clamp(1rem,3vw,2rem)] flex min-h-0 flex-col pb-3 sm:min-h-[calc(100dvh-3.5rem)] sm:pb-5">
      <div className="grid flex-1 gap-2 px-[clamp(1rem,3vw,2rem)] pt-1 sm:gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-start md:gap-5 md:pt-2">
        <div className="flex flex-col justify-start pt-3 md:pt-5">
          <h1 className="max-w-[16rem] text-[clamp(2.05rem,10.5vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-[var(--heading)] sm:max-w-none md:max-w-none md:whitespace-nowrap md:text-[clamp(1.35rem,4.2vw,3.75rem)] md:leading-none">
            Create. Compete.
            <br className="md:hidden" />
            <span className="md:inline"> Get Paid.</span>
          </h1>
          <div className="mt-4 max-w-2xl md:mt-5">
            <p className="text-base leading-relaxed text-[var(--fg)] sm:text-lg">
              <span className="hidden md:inline">
                PennyArena is where creators post on topics, battle
                <br />
                head-to-head for prizes, and earn from every win.
                <br />
                Or publish great work and collect tips from creators and users.
              </span>
              <span className="md:hidden">
                PennyArena is where creators post on topics, battle head-to-head for prizes, and earn
                from every win. Or publish great work and collect tips from creators and users.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-end justify-center overflow-visible pb-1 pt-2 md:justify-end md:pb-0 md:pt-14 lg:pt-16">
          <HeroMascots />
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--border)] bg-[var(--card)]/40 px-[clamp(1rem,3vw,2rem)] py-2 backdrop-blur-sm sm:mt-auto sm:mb-3 sm:-translate-y-[15px] sm:py-2.5">
        <TopicsGrid variant="hero-strip" />
      </div>
    </section>
  );
}
