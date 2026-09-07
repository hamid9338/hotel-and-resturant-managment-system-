"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={26} />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          An unexpected error occurred. You can try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/")}>
          Go to Dashboard
        </Button>
        <Button variant="primary" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
