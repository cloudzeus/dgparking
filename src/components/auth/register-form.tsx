"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Lock, User, UserPlus } from "lucide-react";
import { register, type RegisterState } from "@/lib/actions/auth";
import { toast } from "sonner";

export function RegisterForm() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<RegisterState | undefined, FormData>(
    register,
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
    if (state?.errors) {
      Object.values(state.errors).forEach((errors) => {
        errors.forEach((error) => toast.error(error));
      });
    }
    if (state?.success) {
      toast.success("Account created successfully! Please sign in.");
      router.push("/login");
    }
  }, [state, router]);

  return (
    <Card ref={cardRef} className="border-0 shadow-xl opacity-0">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-xs font-medium uppercase">
                FIRST NAME
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  required
                  className="h-11 pl-10"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-xs font-medium uppercase">
                LAST NAME
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  required
                  className="h-11 pl-10"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

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
            <Label htmlFor="password" className="text-xs font-medium uppercase">
              PASSWORD
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                required
                minLength={8}
                className="h-11 pl-10"
                disabled={isPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-medium uppercase">
              CONFIRM PASSWORD
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
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
                CREATING ACCOUNT...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                CREATE ACCOUNT
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}











