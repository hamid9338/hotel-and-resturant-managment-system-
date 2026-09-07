import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted-2">
        <SearchX size={26} />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-transparent bg-accent px-4 py-2 text-sm font-medium text-[#1a0f00] hover:brightness-110"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
