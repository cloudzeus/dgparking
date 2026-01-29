"use client";

import { useEffect, useRef, useActionState } from "react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Database, Key } from "lucide-react";
import { authenticateSoftOne, type SoftOneLoginState } from "@/lib/actions/softone";
import { toast } from "sonner";
import { formFieldStyles } from "@/lib/form-styles";

export function SoftOneAuthForm() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<SoftOneLoginState | undefined, FormData>(
    authenticateSoftOne,
    undefined
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
    if (state?.success) {
      toast.success("SoftOne ERP authentication successful!");
    }
  }, [state]);

  return (
    <div ref={cardRef} className="space-y-4 opacity-0">
      <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <CardHeader className="relative p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                <Database className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">SOFTONE ERP AUTHENTICATION</CardTitle>
                <p className="text-[9px] text-muted-foreground mt-1">
                  Connect to SoftOne ERP system using MCP server
                </p>
              </div>
            </div>
            {state?.success && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[8px] font-bold">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                AUTHENTICATED
              </Badge>
            )}
            {state?.error && (
              <Badge variant="destructive" className="text-[8px] font-bold">
                <XCircle className="h-3 w-3 mr-1" />
                ERROR
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative p-4">
          <form action={formAction} className="space-y-3">
            <div className="space-y-2">
              <h3 className={formFieldStyles.sectionHeader}>
                AUTHENTICATION CREDENTIALS
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="appId" className={formFieldStyles.label}>
                    APP ID *
                  </Label>
                  <Input
                    id="appId"
                    name="appId"
                    type="text"
                    defaultValue="1001"
                    placeholder="1001"
                    required
                    disabled={isPending}
                    className={formFieldStyles.input}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company" className={formFieldStyles.label}>
                    COMPANY *
                  </Label>
                  <Input
                    id="company"
                    name="company"
                    type="text"
                    defaultValue="1002"
                    placeholder="1002"
                    required
                    disabled={isPending}
                    className={formFieldStyles.input}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="username" className={formFieldStyles.label}>
                  USERNAME *
                </Label>
                <Input
                  id="username"
                  name="username"
                  defaultValue="cronusweb"
                  placeholder="cronusweb"
                  required
                  disabled={isPending}
                  className={formFieldStyles.input}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className={formFieldStyles.label}>
                  PASSWORD *
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  required
                  disabled={isPending}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="submit"
                disabled={isPending}
                className={formFieldStyles.button}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    <Key className="h-3 w-3" />
                    AUTHENTICATE
                  </>
                )}
              </Button>
            </div>
          </form>

          {state?.session && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                  SESSION INFORMATION
                </h4>
                <div className="space-y-1 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client ID:</span>
                    <span className="font-mono text-[8px] break-all">{state.session.clientID.substring(0, 40)}...</span>
                  </div>
                  {state.session.s1u !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">S1U:</span>
                      <span className="font-medium">{state.session.s1u}</span>
                    </div>
                  )}
                  {state.session.companyinfo && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground mb-1">Company Info:</span>
                      <span className="font-medium text-[8px]">{state.session.companyinfo}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[8px] font-bold">
                      AUTHENTICATED
                    </Badge>
                  </div>
                </div>
              </div>

              {state.response && (
                <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                    FULL AUTHENTICATION RESPONSE
                  </h4>
                  <p className="text-[8px] text-muted-foreground mb-2">
                    Check browser console for detailed logs
                  </p>
                  <pre className="p-3 rounded-lg bg-background border border-muted-foreground/20 overflow-x-auto text-[8px] font-mono max-h-64 overflow-y-auto">
                    {JSON.stringify(state.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {state?.error && state?.response && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <h4 className="text-[10px] font-bold uppercase text-destructive mb-2">
                ERROR RESPONSE
              </h4>
              <p className="text-[9px] text-destructive mb-2">{state.error}</p>
              <pre className="p-3 rounded-lg bg-background border border-destructive/20 overflow-x-auto text-[8px] font-mono max-h-64 overflow-y-auto">
                {JSON.stringify(state.response, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

