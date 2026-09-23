"use client";

import { useId, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/*
 * Τα γραφήματα του HDCtool — ΕΝΑ σετ για όλη την εφαρμογή.
 *
 * Όλα πάνω στο shadcn `ChartContainer` (Recharts), με το ύφος του
 * ui.shadcn.com/charts: χωρίς κάθετες γραμμές πλέγματος, άξονες χωρίς
 * γραμμές, tooltip με κουκκίδα, διαβάθμιση στις περιοχές. Χρώματα μόνο από
 * τα tokens `--chart-1…5` (DG), αριθμοί και ημερομηνίες στα ελληνικά.
 *
 * Μην γράφεις Recharts απευθείας σε σελίδα: πρόσθεσε εδώ ό,τι λείπει.
 */

export type ChartSeries = {
  /** Κλειδί στα δεδομένα. */
  key: string;
  /** Ελληνική ετικέτα για tooltip και υπόμνημα. */
  label: string;
  /** Προαιρετικό χρώμα· αλλιώς `--chart-N` με τη σειρά. */
  color?: string;
};

type Datum = Record<string, string | number | null | undefined>;

const numberFormat = new Intl.NumberFormat("el-GR");
export const formatChartNumber = (value: unknown) => (typeof value === "number" ? numberFormat.format(value) : String(value ?? ""));
/** Για άξονες: 24.000 → 24k, 1.200.000 → 1,2M, ώστε να χωρά στο πλάτος του άξονα. */
export const formatAxisNumber = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${(v / 1e6).toLocaleString("el-GR", { maximumFractionDigits: 1 })}M`
    : Math.abs(v) >= 1e4
      ? `${Math.round(v / 1000)}k`
      : numberFormat.format(v);

function configFor(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: s.color ?? `var(--chart-${(i % 5) + 1})` }]),
  );
}

type CartesianProps = {
  data: Datum[];
  /** Κλειδί του άξονα Χ (π.χ. ημερομηνία ή ώρα). */
  xKey: string;
  series: ChartSeries[];
  /** Ύψος σε px (προεπιλογή 240). */
  height?: number;
  stacked?: boolean;
  legend?: boolean;
  xFormatter?: (value: string | number) => string;
  yFormatter?: (value: number) => string;
  className?: string;
};

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

/** Γράφημα περιοχής με διαβάθμιση — τάσεις στον χρόνο (όπως το shadcn «Area Chart - Gradient»). */
export function AreaTrendChart({
  data,
  xKey,
  series,
  height = 240,
  stacked = false,
  legend = series.length > 1,
  xFormatter,
  yFormatter = formatAxisNumber,
  className,
}: CartesianProps) {
  const id = useId().replace(/:/g, "");
  return (
    <ChartContainer config={configFor(series)} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.8} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={24} tickFormatter={xFormatter} />
        <YAxis {...axisProps} width={48} tickFormatter={yFormatter} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={xFormatter ? (v) => xFormatter(v as string) : undefined}
            />
          }
        />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            fill={`url(#fill-${id}-${s.key})`}
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            stackId={stacked ? "a" : undefined}
          />
        ))}
        {legend && <ChartLegend content={<ChartLegendContent />} />}
      </AreaChart>
    </ChartContainer>
  );
}

/** Μπάρες — σύγκριση ανά ημέρα/ώρα/κατηγορία. `horizontal` για μακριές ετικέτες. */
export function BarTrendChart({
  data,
  xKey,
  series,
  height = 240,
  stacked = false,
  legend = series.length > 1,
  horizontal = false,
  /** Πλάτος για τις ετικέτες κατηγορίας σε οριζόντιο γράφημα — ονόματα ειδών θέλουν χώρο. */
  categoryWidth = 110,
  xFormatter,
  yFormatter = formatAxisNumber,
  className,
}: CartesianProps & { horizontal?: boolean; categoryWidth?: number }) {
  return (
    <ChartContainer config={configFor(series)} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <BarChart
        accessibilityLayer
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: 4, right: 12, top: 8 }}
      >
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} />
        {/* Recharts 2 βρίσκει τους άξονες μόνο ως άμεσα παιδιά — όχι μέσα σε Fragment. */}
        {horizontal ? (
          <XAxis type="number" {...axisProps} tickFormatter={yFormatter} />
        ) : (
          <XAxis dataKey={xKey} {...axisProps} minTickGap={16} tickFormatter={xFormatter} />
        )}
        {horizontal ? (
          <YAxis type="category" dataKey={xKey} {...axisProps} width={categoryWidth} interval={0} tickFormatter={xFormatter} />
        ) : (
          <YAxis {...axisProps} width={48} tickFormatter={yFormatter} />
        )}
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent indicator="dot" labelFormatter={xFormatter ? (v) => xFormatter(v as string) : undefined} />
          }
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            stackId={stacked ? "a" : undefined}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : 4}
          />
        ))}
        {legend && <ChartLegend content={<ChartLegendContent />} />}
      </BarChart>
    </ChartContainer>
  );
}

/** Γραμμές — μετρήσεις όπως διάρκεια ή χρόνος απόκρισης. */
export function LineTrendChart({
  data,
  xKey,
  series,
  height = 240,
  legend = series.length > 1,
  xFormatter,
  yFormatter = formatAxisNumber,
  className,
}: CartesianProps) {
  return (
    <ChartContainer config={configFor(series)} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} minTickGap={24} tickFormatter={xFormatter} />
        <YAxis {...axisProps} width={48} tickFormatter={yFormatter} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent indicator="line" labelFormatter={xFormatter ? (v) => xFormatter(v as string) : undefined} />
          }
        />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />
        ))}
        {legend && <ChartLegend content={<ChartLegendContent />} />}
      </LineChart>
    </ChartContainer>
  );
}

/** Donut — μερίδια ενός συνόλου (≤5 κομμάτια), με το σύνολο στο κέντρο. */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 220,
  legend = true,
  className,
}: {
  data: Array<{ key: string; label: string; value: number; color?: string }>;
  centerValue?: ReactNode;
  centerLabel?: string;
  height?: number;
  legend?: boolean;
  className?: string;
}) {
  const config = configFor(data.map((d) => ({ key: d.key, label: d.label, color: d.color })));
  const rows = data.map((d) => ({ ...d, fill: `var(--color-${d.key})` }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ChartContainer config={config} className={cn("mx-auto aspect-auto w-full", className)} style={{ height }}>
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie data={rows} dataKey="value" nameKey="key" innerRadius="58%" outerRadius="85%" strokeWidth={2}>
          {rows.map((r) => (
            <Cell key={r.key} fill={r.fill} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-semibold">
                    {typeof centerValue === "string" || typeof centerValue === "number"
                      ? centerValue
                      : numberFormat.format(total)}
                  </tspan>
                  {centerLabel && (
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-muted-foreground text-xs">
                      {centerLabel}
                    </tspan>
                  )}
                </text>
              );
            }}
          />
        </Pie>
        {legend && <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap" />}
      </PieChart>
    </ChartContainer>
  );
}

/** Κάρτα γραφήματος: τίτλος, περιγραφή, ενέργειες (π.χ. επιλογή περιόδου) και το γράφημα. */
export function ChartCard({
  title,
  description,
  action,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className={cn(action && "has-data-[slot=card-action]:grid-cols-[1fr_auto]")}>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <div className="px-4 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}
