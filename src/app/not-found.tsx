import Link from "next/link";

/**
 * Minimal 404 page: no shadcn/Radix so prerender does not hit useContext.
 * Root layout already has dynamic = "force-dynamic" to avoid static prerender.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold uppercase">PAGE NOT FOUND</h2>
          <p className="text-muted-foreground max-w-md">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          GO HOME
        </Link>
      </div>
    </div>
  );
}











