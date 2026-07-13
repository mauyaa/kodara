"use client";

import { useEffect, useRef, useState } from "react";
import { formatKES } from "@/lib/utils";

const FORMATTERS: Record<string, (n: number) => string> = {
  kes: formatKES,
  count: (n) => `${n}`,
  percent: (n) => `${n}%`,
  tickets: (n) => `${n} Ticket${n === 1 ? "" : "s"}`,
};

/**
 * Counts up to `value` on mount and whenever it changes — the small
 * "alive" detail that makes a hero figure feel computed live rather than
 * printed (Mercury/Ramp both do this on their balance headlines).
 *
 * `formatType` is a string, not a function prop, because Server Component
 * pages render this from RSC — functions can't cross that boundary. The
 * actual formatter is resolved and called entirely inside this client
 * component.
 *
 * Occasional, not keyboard-repeated, so animating it is earned per Emil
 * Kowalski's frequency test. Respects prefers-reduced-motion by jumping
 * straight to the final value.
 */
export function AnimatedNumber({
  value,
  formatType = "count",
  durationMs = 700,
  fontClassName = "font-mono",
}: {
  value: number;
  formatType?: keyof typeof FORMATTERS;
  durationMs?: number;
  fontClassName?: string;
}) {
  const format = FORMATTERS[formatType] ?? FORMATTERS.count;

  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [display, setDisplay] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const rafRef = useRef<number | null>(null);

  // Adjusting state when a prop changes (React-endorsed pattern): for
  // reduced-motion users, sync immediately during render rather than via
  // an effect, so there is no animation frame to skip in the first place.
  if (value !== prevValue) {
    setPrevValue(value);
    if (reduceMotion) setDisplay(value);
  }

  useEffect(() => {
    if (reduceMotion || display === value) return;

    const from = display;
    const to = value;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      setDisplay(Math.round(from + (to - from) * easeOut(progress)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={`tabular-nums ${fontClassName}`}>{format(display)}</span>;
}
