"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-secondary/30 px-4 py-20 text-center ring-1 ring-border/50">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="max-w-sm text-[14px] text-muted-foreground">
          This page hit an unexpected error. Your payments and account are
          safe — try reloading.
        </p>
      </div>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
