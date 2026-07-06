"use client";

import { useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeNoop = () => () => {};

export function ThemeToggle() {
  // Same client-only-render idiom used in Sidebar's MobileNav: read the
  // real client snapshot without an effect, falling back to a stable
  // server snapshot so hydration never mismatches.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [isDark, setIsDark] = useState(false);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("kodara-theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable (private browsing); theme just won't persist.
    }
  };

  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden="true" />;
  }

  const currentlyDark = document.documentElement.classList.contains("dark");
  if (currentlyDark !== isDark) setIsDark(currentlyDark);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="text-muted-foreground hover:bg-secondary/50"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
