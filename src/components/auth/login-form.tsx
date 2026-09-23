"use client";

import { useEffect, useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "@/lib/actions/auth";
import { toast } from "sonner";

export function LoginForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined
  );

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Διεύθυνση email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ο λογαριασμός σας"
              required
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Κωδικός</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Ξεχάσατε τον κωδικό;
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="ο κωδικός σας"
              required
              disabled={isPending}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Γίνεται σύνδεση…
              </>
            ) : (
              <>
                <LogIn aria-hidden />
                Σύνδεση
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
