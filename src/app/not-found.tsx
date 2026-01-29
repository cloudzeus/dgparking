import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <Search className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold uppercase">PAGE NOT FOUND</h2>
          <p className="text-muted-foreground max-w-md">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            GO HOME
          </Link>
        </Button>
      </div>
    </div>
  );
}











