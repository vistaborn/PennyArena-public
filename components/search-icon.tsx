/** Shared magnifier icon for nav + Search page. */
export function SearchIcon({
  size = 16,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="6.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <line
        x1="15.5"
        y1="15.5"
        x2="21"
        y2="21"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
