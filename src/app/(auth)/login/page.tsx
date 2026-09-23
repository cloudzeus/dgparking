import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { Car } from "lucide-react";

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/dashboard";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary">
            <Car className="size-5 text-primary-foreground" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Καλώς ήρθατε</h1>
          <p className="text-sm text-muted-foreground">Συνδεθείτε στον λογαριασμό σας για να συνεχίσετε.</p>
        </div>

        <LoginForm callbackUrl={callbackUrl} />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Δεν έχετε λογαριασμό;{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Εγγραφή
          </Link>
        </p>
      </div>
    </div>
  );
}
