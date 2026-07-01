import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "teal" | "default";
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  const variants = {
    success: "badge-success",
    warning: "badge-warning",
    error: "badge-error",
    teal: "badge-teal",
    default: "bg-[var(--border)] text-[var(--text-primary)]",
  };

  return (
    <span className={cn("badge", variants[variant], className)}>
      {children}
    </span>
  );
}
