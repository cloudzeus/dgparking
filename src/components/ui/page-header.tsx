"use client";

interface PageHeaderProps {
  title: string;
  highlight?: string; // The part of the title that should be highlighted with gradient
  subtitle?: string;
  className?: string;
}

export function PageHeader({ title, highlight, subtitle, className }: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {highlight ? (
          <>
            {title.replace(highlight, "")}
            <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              {highlight}
            </span>
          </>
        ) : (
          title
        )}
      </h1>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}



