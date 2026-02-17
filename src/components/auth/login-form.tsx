"use client";

import { useEffect, useRef, useActionState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Lock, LogIn } from "lucide-react";
import { login, type LoginState } from "@/lib/actions/auth";
import { toast } from "sonner";

export function LoginForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: 30, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }
        );
      });
      return () => ctx.revert();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card ref={cardRef} className="border-0 shadow-xl" style={{ opacity: 0 }}>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium uppercase">
              EMAIL ADDRESS
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                required
                className="h-11 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-medium uppercase">
                PASSWORD
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                FORGOT PASSWORD?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                className="h-11 pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full gap-2"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                SIGNING IN...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                SIGN IN
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


