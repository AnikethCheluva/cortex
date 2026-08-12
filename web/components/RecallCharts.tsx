"use client";

// Thin wrappers around the bklit chart kit (components/charts/*) for the recall
// dashboard. Kept in their own module so RecallDashboard can lazy-load them —
// the kit pulls in visx + motion, which we don't want in the initial bundle.
// Every color comes from the notebook palette via the chart CSS vars.

import { AreaChart, Area } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Gauge } from "@/components/charts/gauge";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

// The stats layer emits ISO day strings ("2026-07-30"); the kit wants Dates.
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

const MARGIN = { top: 14, right: 14, bottom: 26, left: 14 };
const ASPECT = "5 / 2";

// True-retention trend — 7-day rolling, plotted as a percentage area.
export function RetentionTrendChart({
  points,
}: {
  points: { day: string; retention: number; n: number }[];
}) {
  const data = points.map((p) => ({
    date: toDate(p.day),
    retention: Math.round(p.retention * 100),
  }));
  return (
    <AreaChart data={data} aspectRatio={ASPECT} margin={MARGIN}>
      <Grid horizontal />
      <Area
        dataKey="retention"
        fill="var(--chart-1)"
        stroke="var(--chart-1)"
        fillOpacity={0.28}
      />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}

// Reviews per day — total volume with the passing share filled green on top,
// so the red remainder above it reads as misses (Area has no stackId, so we
// draw the taller `reviews` area first and the shorter `passed` area over it).
export function ReviewsVolumeChart({
  days,
}: {
  days: { date: string; pass: number; fail: number }[];
}) {
  const data = days.map((d) => ({
    date: toDate(d.date),
    reviews: d.pass + d.fail,
    passed: d.pass,
  }));
  return (
    <AreaChart data={data} aspectRatio={ASPECT} margin={MARGIN}>
      <Grid horizontal />
      <Area
        dataKey="reviews"
        fill="var(--err)"
        stroke="var(--err)"
        fillOpacity={0.22}
      />
      <Area
        dataKey="passed"
        fill="var(--ok)"
        stroke="var(--ok)"
        fillOpacity={0.4}
      />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}

// Single-value radial gauge — true retention vs the 90% target. Brass arc
// (activeFill defaults to chart-1), notch track, centered percentage label.
export function RetentionGauge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <div className="muted" style={{ textAlign: "center", padding: "34px 0" }}>
        not enough graduated reviews yet
      </div>
    );
  }
  return (
    <div className="gauge-wrap">
      <Gauge
        value={Math.round(value * 100)}
        centerValue={value}
        defaultLabel="true retention"
        formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
      />
    </div>
  );
}

// Generic categorical bar chart — used for due forecast, memory-stability
// histogram, and calibration reliability bars. `items` carry string labels.
export function BarsChart({
  items,
  color = "var(--chart-1)",
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  return (
    <BarChart data={items} xDataKey="label" aspectRatio={ASPECT} margin={MARGIN}>
      <Grid horizontal />
      <Bar dataKey="value" fill={color} />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
