"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Entrance choreography per Emil Kowalski's framework: enter from near
 * (y: 10, opacity 0 — never from nothing), strong ease-out curve
 * cubic-bezier(0.23, 1, 0.32, 1), under 300ms, 40ms stagger between
 * siblings. Purely decorative on first paint, so reduced-motion disables it.
 */
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered list entrance: each child cascades in 40ms after the previous.
 * Wrap siblings in <RevealGroup> and each item in <RevealItem>.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.04 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: EASE_OUT },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
