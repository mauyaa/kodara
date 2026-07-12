import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Quiet emerald aurora — one soft light source, no hard geometry */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-20%] h-[55%] bg-[radial-gradient(55%_65%_at_50%_35%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_70%)]"
      />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Brand Header */}
          <div className="mb-8 flex flex-col items-center justify-center text-center">
            <Link
              href="/"
              className="group inline-flex flex-col items-center gap-3 text-foreground"
            >
              <LogoMark className="h-12 w-12 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1" />
              <span className="text-2xl font-bold tracking-tight leading-none">
                Kodara
              </span>
            </Link>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Rent collection for Kenya
            </p>
          </div>

          {/* The Form Card */}
          <div className="premium-card p-8 sm:p-10">{children}</div>

          <p className="mt-8 text-center text-[12px] text-muted-foreground/70">
            Payments secured by M-Pesa · Data protected with row-level security ·{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">
              Privacy policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
