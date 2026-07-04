import Link from "next/link";
import { signup } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";

export default async function SignupPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start managing your property portfolio efficiently.
        </p>
      </div>

      {searchParams?.error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 p-4 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 font-medium">{searchParams.error}</div>
        </div>
      )}

      <form action={signup} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-foreground font-medium">Full Name</Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            placeholder="Jane Wanjiru"
            required
            minLength={2}
            className="h-11 bg-secondary/30 border-border/50 focus:bg-background focus-visible:ring-primary transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@company.com"
            required
            className="h-11 bg-secondary/30 border-border/50 focus:bg-background focus-visible:ring-primary transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            placeholder="••••••••"
            required 
            className="h-11 bg-secondary/30 border-border/50 focus:bg-background focus-visible:ring-primary transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password" className="text-foreground font-medium">Confirm Password</Label>
          <Input 
            id="confirm_password" 
            name="confirm_password" 
            type="password" 
            placeholder="••••••••"
            required 
            className="h-11 bg-secondary/30 border-border/50 focus:bg-background focus-visible:ring-primary transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-lg"
          />
        </div>

        <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-float group transition-all rounded-lg text-[15px] font-semibold active:scale-[0.98] ease-[var(--ease-out)]">
          Create account
          <ArrowRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}
