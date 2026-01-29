"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FormCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({ title, subtitle, children, className }: FormCardProps) {
  return (
    <Card className={`group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="pb-4 relative">
        <div>
          <CardTitle className="text-sm uppercase text-muted-foreground font-bold">
            {title}
          </CardTitle>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative">
        {children}
      </CardContent>
    </Card>
  );
}










