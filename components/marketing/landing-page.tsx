import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  MessageCircle,
  Receipt,
  Wrench,
  Smartphone,
  Repeat,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Automatic M-Pesa reconciliation",
    body: "STK push payments match to the right tenant and unit the moment they land. Anything that doesn't match gets queued for a one-click resolve — nothing silently falls through.",
  },
  {
    icon: Repeat,
    title: "A live portfolio dashboard",
    body: "Collections, arrears, and unit status update in real time as payments arrive. No refreshing, no end-of-day reconciliation spreadsheet.",
  },
  {
    icon: MessageCircle,
    title: "Tenant-landlord messaging",
    body: "Tenants and landlords talk inside the app instead of scattered SMS threads that get lost.",
  },
  {
    icon: Receipt,
    title: "eTIMS-ready invoicing",
    body: "Connect KRA credentials once and rent payments can issue compliant e-invoices automatically — ahead of the 2026 eTIMS mandate, not scrambling to catch up.",
  },
  {
    icon: Wrench,
    title: "Maintenance tracking",
    body: "Tenants submit requests with photos. Landlords track every request from submitted to resolved.",
  },
  {
    icon: Smartphone,
    title: "A mobile app for both sides",
    body: "Landlords manage their portfolio on the go. Tenants pay rent and message their landlord from a dedicated Kodara app.",
  },
];

const steps = [
  {
    n: "01",
    title: "Add your properties",
    body: "Set up properties, units, and tenants in minutes with a guided setup — no spreadsheet migration required.",
  },
  {
    n: "02",
    title: "Tenants pay via M-Pesa",
    body: "Tenants get an STK push when rent is due and pay in one tap. No paybill numbers to remember or instructions to send.",
  },
  {
    n: "03",
    title: "Everything reconciles itself",
    body: "Payments match to the right tenancy, your dashboard updates live, and eTIMS invoices go out without extra work on your end.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    blurb: "For a first property.",
    limits: "1 property · up to 5 units",
    features: ["Tenant-landlord messaging", "eTIMS-ready invoicing", "Real-time dashboard"],
  },
  {
    name: "Growth",
    price: "KES 1,500",
    period: "/month",
    blurb: "Recommended for a growing portfolio.",
    limits: "5 properties · up to 50 units",
    features: ["Everything in Starter", "Room for a growing portfolio"],
    highlighted: true,
  },
  {
    name: "Portfolio",
    price: "KES 4,000",
    period: "/month",
    blurb: "For property managers at scale.",
    limits: "Unlimited properties & units",
    features: ["Everything in Growth", "No property or unit ceiling"],
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-40 glass-panel">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-foreground">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 sm:flex">
          <a href="#how-it-works" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#pricing" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="h-10 px-4 text-[13px]"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Sign in
          </Button>
          <Button
            size="lg"
            className="h-10 px-4 text-[13px] shadow-subtle"
            render={<Link href="/signup" />}
            nativeButton={false}
          >
            Get started
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-25%] h-[60%] bg-[radial-gradient(55%_65%_at_50%_35%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_70%)]"
      />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
            Rent collection for Kenya
          </p>
          <h1 className="mt-4 text-balance font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[52px]">
            Rent that reconciles itself, not a chase you run every month.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Kodara matches every M-Pesa payment to the right tenant automatically, keeps your
            portfolio dashboard live, and keeps rent invoices compliant with KRA eTIMS — one calm
            system built for Kenyan landlords.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-11 px-6 text-[14px] shadow-float"
              render={<Link href="/signup" />}
            nativeButton={false}
            >
              Get started free
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-6 text-[14px]"
              render={<a href="#how-it-works" />}
            nativeButton={false}
            >
              See how it works
            </Button>
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground/70">
            Payments secured by M-Pesa · Data protected with row-level security ·{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">
              Privacy policy
            </Link>
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="overflow-visible rounded-[28px] bg-lime p-1 shadow-[var(--shadow-hero)]">
            <div className="rounded-[24px] p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-lime-ink/70">
                Collected this month
              </p>
              <div className="mt-3 font-display text-[48px] font-extrabold leading-[0.9] tracking-[-0.02em] text-lime-ink tabular-nums">
                KES •••,•••
              </div>
              <p className="mt-3 text-[13px] font-semibold text-lime-ink/70">
                Reconciled automatically, in real time
              </p>
            </div>
          </div>
          <div className="premium-card mt-4 flex items-center justify-between p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Unmatched
              </p>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-foreground">0</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Occupancy
              </p>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-foreground">100%</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                eTIMS
              </p>
              <p className="mt-1 text-[13px] font-bold text-primary">Ready</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: ShieldCheck, label: "Row-level security on every table" },
    { icon: Zap, label: "M-Pesa STK push, reconciled automatically" },
    { icon: Receipt, label: "eTIMS-ready invoicing" },
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="size-4 shrink-0 text-primary" />
            <span className="text-[13px] font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
          Everything included
        </p>
        <h2 className="mt-3 text-balance text-[30px] font-bold tracking-[-0.02em] text-foreground sm:text-[36px]">
          Everything rent collection needs, nothing it doesn&apos;t.
        </h2>
      </div>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-3 bg-card p-6">
            <Icon className="size-5 text-primary" />
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-[30px] font-bold tracking-[-0.02em] text-foreground sm:text-[36px]">
            Three steps, then it runs itself.
          </h2>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n}>
              <span className="font-display text-[15px] font-bold text-primary">{step.n}</span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em] text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
          Pricing
        </p>
        <h2 className="mt-3 text-balance text-[30px] font-bold tracking-[-0.02em] text-foreground sm:text-[36px]">
          Start free. Grow into a plan that fits your portfolio.
        </h2>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlighted
                ? "premium-card relative flex flex-col gap-6 border-primary/30 p-7 shadow-elevated"
                : "premium-card flex flex-col gap-6 p-7"
            }
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
                Recommended
              </span>
            )}
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{plan.blurb}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[32px] font-bold tracking-[-0.02em] text-foreground tabular-nums">
                {plan.price}
              </span>
              {plan.period && (
                <span className="text-[13px] font-medium text-muted-foreground">{plan.period}</span>
              )}
            </div>
            <p className="text-[13px] font-medium text-foreground">{plan.limits}</p>
            <ul className="flex flex-1 flex-col gap-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={plan.highlighted ? "default" : "outline"}
              size="lg"
              className="h-10 w-full text-[13px]"
              render={<Link href="/signup" />}
            nativeButton={false}
            >
              Get started
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
        <h2 className="text-balance text-[30px] font-bold tracking-[-0.02em] text-foreground sm:text-[36px]">
          Ready to stop chasing rent?
        </h2>
        <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
          Set up your first property in minutes. The Starter plan is free for as long as you need
          it.
        </p>
        <Button
          size="lg"
          className="h-11 px-6 text-[14px] shadow-float"
          render={<Link href="/signup" />}
            nativeButton={false}
        >
          Get started free
          <ArrowRight className="ml-1.5 size-4" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
          <LogoMark className="h-6 w-6" />
          <span className="text-[14px] font-bold tracking-tight">Kodara</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy policy
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Sign in
          </Link>
          <a href="mailto:privacy@kodara.app" className="hover:text-foreground transition-colors">
            Contact
          </a>
        </div>
        <p className="text-[12px] text-muted-foreground/70">© 2026 Kodara. Built for Kenya.</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Pricing />
        <ClosingCTA />
      </main>
      <Footer />
    </div>
  );
}
