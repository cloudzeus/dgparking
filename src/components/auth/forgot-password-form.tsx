"use client";

import { useEffect, useRef, useActionState } from "react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Send, CheckCircle2 } from "lucide-react";
import { forgotPassword, type ForgotPasswordState } from "@/lib/actions/auth";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<ForgotPasswordState | undefined, FormData>(
    forgotPassword,
    undefined
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  if (state?.success) {
    return (
      <Card ref={cardRef} className="border-0 shadow-xl">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">CHECK YOUR EMAIL</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists with that email, we&apos;ve sent password reset
            instructions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef} className="border-0 shadow-xl opacity-0">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
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

          <Button
            type="submit"
            className="h-11 w-full gap-2"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                SENDING...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                SEND RESET LINK
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}











