import Link from "next/link";
import { Russo_One } from "next/font/google";
import { cn } from "@/lib/utils";

const logoFont = Russo_One({ weight: "400", subsets: ["latin"] });

type PennyLogoProps = {
  className?: string;
};

export function PennyLogo({ className }: PennyLogoProps) {
  return (
    <Link
      href="/"
      className={cn("group flex shrink-0 items-center gap-2 transition hover:opacity-90", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/pixel_coin.svg"
        alt=""
        width={20}
        height={20}
        className="h-[1.28em] w-[1.28em] shrink-0 transition group-hover:scale-105"
        style={{ imageRendering: "pixelated" }}
      />
      <span
        className={cn(logoFont.className, "text-xl tracking-wide sm:text-[1.35rem]")}
        style={{ color: "#f79d28" }}
      >
        PennyArena
      </span>
    </Link>
  );
}
