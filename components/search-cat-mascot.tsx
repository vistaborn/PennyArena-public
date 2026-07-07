import { SearchIcon } from "@/components/search-icon";

export function SearchCatMascot() {
  return (
    <div className="search-cat-stage" aria-hidden>
      <div className="search-cat-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mascot-cat.png"
          alt=""
          className="search-cat-sprite h-[8.5rem] w-auto object-contain sm:h-[10rem]"
          draggable={false}
        />
        <div className="search-cat-glass">
          <SearchIcon size={26} strokeWidth={2} className="text-penny-gold" />
        </div>
      </div>
    </div>
  );
}
