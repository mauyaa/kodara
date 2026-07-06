import { cn } from "@/lib/utils";

/**
 * Pulsing placeholder block. `animate-pulse` is neutralized for
 * prefers-reduced-motion users by the global animation-duration override
 * in globals.css, so this needs no extra guard here.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
    />
  );
}
