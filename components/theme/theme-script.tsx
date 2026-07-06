import Script from "next/script";

/**
 * Blocking script that runs before hydration, so the correct theme class
 * is on <html> before first paint — no flash of the wrong theme.
 * Reads a persisted user choice first, then falls back to OS preference.
 *
 * next/script with beforeInteractive is the App Router's supported
 * mechanism for this; a plain <script> element rendered by a component
 * trips React's "scripts inside components aren't executed" dev warning.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("kodara-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// Only ever rendered once, from the root app/layout.tsx <head> — the
// App Router's documented place for beforeInteractive scripts. The
// no-before-interactive-script-outside-document lint rule predates the
// App Router and doesn't know that, so it's suppressed here specifically.
export function ThemeScript() {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="kodara-theme-script" strategy="beforeInteractive">
      {THEME_SCRIPT}
    </Script>
  );
}
