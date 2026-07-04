import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Stripe-like diagonal background element */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[50%] bg-background transform -skew-y-6 shadow-sm border-b border-border/40 z-0" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md">
        
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
        </div>

        {/* The Form Card */}
        <div className="premium-card p-8 sm:p-10">
          {children}
        </div>

      </div>
    </div>
  );
}
