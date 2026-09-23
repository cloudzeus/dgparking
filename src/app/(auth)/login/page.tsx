import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import Image from "next/image";

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/dashboard";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link href="/" aria-label="MEGA Parking">
            <Image
              src="/images/MEGAParkingLogoWide.svg"
              alt="MEGA Parking"
              width={200}
              height={48}
              priority
              className="h-10 w-auto"
            />
          </Link>
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
