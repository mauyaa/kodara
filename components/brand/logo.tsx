import { cn } from "@/lib/utils";

/**
 * Kodara house mark, traced from the brand artwork.
 * Renders in `currentColor` so it adapts to any surface:
 * dark ink on light backgrounds, white on dark backgrounds.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* Roof */}
      <path
        d="M66 259 L256 53 L446 259"
        fill="none"
        stroke="currentColor"
        strokeWidth="72"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Upper arch window */}
      <path fill="currentColor" d="M209 312 V239 A47 47 0 0 1 303 239 V312 Z" />
      {/* Door */}
      <path fill="currentColor" d="M211 495 V397 A45 45 0 0 1 301 397 V495 Z" />
      {/* Left wing */}
      <path
        fill="currentColor"
        d="M104 495 A85 85 0 0 1 104 325 H165 A24 24 0 0 1 189 349 V455 A40 40 0 0 1 149 495 H104 Z"
      />
      {/* Right wing */}
      <path
        fill="currentColor"
        d="M408 325 A85 85 0 0 1 408 495 H363 A40 40 0 0 1 323 455 V349 A24 24 0 0 1 347 325 H408 Z"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. Inherits text color.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-7 w-7", markClassName)} />
      <span
        className={cn(
          "text-lg font-bold tracking-tight leading-none",
          wordmarkClassName
        )}
      >
        Kodara
      </span>
    </span>
  );
}
