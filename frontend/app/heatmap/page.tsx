"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWasteHeatmap } from "@/lib/api";
import { useRefresh } from "@/lib/refresh-context";
import type { HeatmapDay } from "@/lib/types";
import { CalendarDays, Flame, Activity, Trophy, Zap } from "lucide-react";

type Metric = "count" | "mass_kg" | "co2_saved_kg";

function getIntensityClass(value: number, max: number): string {
  if (!value || !max) return "bg-muted dark:bg-muted/40";
  const ratio = value / max;
  if (ratio < 0.25) return "bg-green-200 dark:bg-green-900/70";
  if (ratio < 0.5) return "bg-green-400 dark:bg-green-700";
  if (ratio < 0.75) return "bg-green-500 dark:bg-green-600";
  return "bg-green-600 dark:bg-green-500";
}

function calcStreaks(sortedActiveDates: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (!sortedActiveDates.length) return { currentStreak: 0, longestStreak: 0 };

  let longest = 1;
  let temp = 1;

  for (let i = 1; i < sortedActiveDates.length; i++) {
    const prev = new Date(sortedActiveDates[i - 1]).getTime();
    const curr = new Date(sortedActiveDates[i]).getTime();
    const diff = (curr - prev) / 86400000;
    if (diff === 1) {
      temp++;
      if (temp > longest) longest = temp;
    } else {
      temp = 1;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const lastDate = sortedActiveDates[sortedActiveDates.length - 1];

  let current = 0;
  if (lastDate === today || lastDate === yesterday) {
    current = 1;
    for (let i = sortedActiveDates.length - 2; i >= 0; i--) {
      const curr = new Date(sortedActiveDates[i + 1]).getTime();
      const prev = new Date(sortedActiveDates[i]).getTime();
      if ((curr - prev) / 86400000 === 1) current++;
      else break;
    }
  }

  return { currentStreak: current, longestStreak: longest };
}

function buildWeeks(
  allDates: string[],
  dataMap: Map<string, HeatmapDay>,
): Array<Array<{ date: string; data: HeatmapDay | null; inRange: boolean }>> {
  if (!allDates.length) return [];

  const startDate = new Date(allDates[0] + "T00:00:00");
  const dayOfWeek = startDate.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const paddedStart = new Date(startDate.getTime() - offset * 86400000);
  const endDate = new Date(allDates[allDates.length - 1] + "T00:00:00");

  const weeks: Array<Array<{ date: string; data: HeatmapDay | null; inRange: boolean }>> = [];
  let current = new Date(paddedStart);

  while (current <= endDate) {
    const week: Array<{ date: string; data: HeatmapDay | null; inRange: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split("T")[0];
      const inRange = allDates.includes(dateStr);
      week.push({ date: dateStr, data: dataMap.get(dateStr) ?? null, inRange });
      current = new Date(current.getTime() + 86400000);
    }
    weeks.push(week);
  }

  return weeks;
}

function getMonthLabels(
  weeks: Array<Array<{ date: string }>>,
): Array<{ label: string; weekIndex: number }> {
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const labels: Array<{ label: string; weekIndex: number }> = [];
  let lastMonth = -1;

  weeks.forEach((week, wi) => {
    const firstDay = week[0]?.date;
    if (!firstDay) return;
    const m = new Date(firstDay + "T00:00:00").getMonth();
    if (m !== lastMonth) {
      labels.push({ label: MONTH_NAMES[m], weekIndex: wi });
      lastMonth = m;
    }
  });

  return labels;
}

const LEGEND_CLASSES = [
  "bg-muted dark:bg-muted/40",
  "bg-green-200 dark:bg-green-900/70",
  "bg-green-400 dark:bg-green-700",
  "bg-green-500 dark:bg-green-600",
  "bg-green-600 dark:bg-green-500",
];

export default function HeatmapPage() {
  const [days, setDays] = React.useState(365);
  const [metric, setMetric] = React.useState<Metric>("count");
  const [heatData, setHeatData] = React.useState<HeatmapDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hovered, setHovered] = React.useState<HeatmapDay | null>(null);
  const [hoveredPos, setHoveredPos] = React.useState({ x: 0, y: 0 });
  const { refreshKey } = useRefresh();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await getWasteHeatmap(days);
      setHeatData(r.data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [days, refreshKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  const dataMap = React.useMemo(() => {
    const m = new Map<string, HeatmapDay>();
    heatData.forEach((d) => m.set(d.date, d));
    return m;
  }, [heatData]);

  const allDates = React.useMemo(() => {
    const arr: string[] = [];
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    let curr = new Date(start);
    while (curr <= end) {
      arr.push(curr.toISOString().split("T")[0]);
      curr = new Date(curr.getTime() + 86400000);
    }
    return arr;
  }, [days]);

  const maxValue = React.useMemo(() => {
    if (!heatData.length) return 1;
    return Math.max(...heatData.map((d) => (d[metric] as number) ?? 0), 1);
  }, [heatData, metric]);

  const activeDays = heatData.filter((d) => d.count > 0);
  const peakDay = heatData.length
    ? heatData.reduce((a, b) => ((a[metric] as number) > (b[metric] as number) ? a : b))
    : null;
  const totalAnalyses = heatData.reduce((s, d) => s + d.count, 0);
  const sortedActiveDates = activeDays.map((d) => d.date).sort();
  const { currentStreak, longestStreak } = calcStreaks(sortedActiveDates);

  const weeks = buildWeeks(allDates, dataMap);
  const monthLabels = getMonthLabels(weeks);

  const metricLabel: Record<Metric, string> = {
    count: "analyses",
    mass_kg: "kg mass",
    co2_saved_kg: "kg CO₂",
  };

  const top5 = [...heatData].sort((a, b) => b.count - a.count).slice(0, 5);

  const statCards = [
    { title: "Active Days", value: activeDays.length.toString(), icon: <Activity className="h-4 w-4" />, color: "#22c55e" },
    { title: "Peak Day", value: peakDay ? peakDay.date.slice(5).replace("-", "/") : "—", icon: <Trophy className="h-4 w-4" />, color: "#f59e0b" },
    { title: "Total Analyses", value: totalAnalyses.toString(), icon: <CalendarDays className="h-4 w-4" />, color: "#3b82f6" },
    { title: "Current Streak", value: `${currentStreak}d`, icon: <Flame className="h-4 w-4" />, color: "#ef4444" },
    { title: "Longest Streak", value: `${longestStreak}d`, icon: <Zap className="h-4 w-4" />, color: "#8b5cf6" },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Activity Map
        </h2>
        <p className="text-sm text-muted-foreground">
          Your waste analysis activity over time
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex flex-wrap items-center gap-4"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Range:</span>
          {([30, 90, 180, 365] as const).map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          {(
            [
              ["count", "Count"],
              ["mass_kg", "Mass (kg)"],
              ["co2_saved_kg", "CO₂ Saved"],
            ] as [Metric, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={metric === key ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.4, ease: "easeOut" }}
          >
            <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at top right, ${card.color}15, transparent 70%)`,
                }}
              />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}
                  >
                    {card.icon}
                  </div>
                </div>
                <p className="text-xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              {days}-Day Activity Heatmap{" "}
              <span className="text-sm font-normal text-muted-foreground">
                — colored by {metricLabel[metric]}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <p className="text-2xl">📭</p>
                <p className="text-sm">No activity in this period yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                {/* Month labels */}
                <div
                  className="relative h-5 mb-1"
                  style={{ minWidth: `${weeks.length * 14}px` }}
                >
                  {monthLabels.map(({ label, weekIndex }) => (
                    <span
                      key={`${label}-${weekIndex}`}
                      className="absolute text-xs text-muted-foreground"
                      style={{ left: `${weekIndex * 14}px` }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Week columns */}
                <div className="flex gap-0.5" style={{ minWidth: `${weeks.length * 14}px` }}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                      {week.map(({ date, data, inRange }, di) => {
                        const val = data ? ((data[metric] as number) ?? 0) : 0;
                        const cls = inRange
                          ? getIntensityClass(val, maxValue)
                          : "opacity-0";

                        return (
                          <div
                            key={di}
                            className={`w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-125 ${cls}`}
                            onMouseEnter={(e) => {
                              if (data && inRange) {
                                setHovered(data);
                                setHoveredPos({ x: e.clientX, y: e.clientY });
                              }
                            }}
                            onMouseLeave={() => setHovered(null)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Less</span>
                  {LEGEND_CLASSES.map((cls, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
                  ))}
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Floating tooltip */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border bg-card shadow-xl px-3 py-2 text-xs"
          style={{ left: hoveredPos.x + 14, top: hoveredPos.y - 52 }}
        >
          <p className="font-semibold mb-1">{hovered.date}</p>
          <p>{hovered.count} analyses</p>
          <p>{hovered.mass_kg.toFixed(3)} kg mass</p>
          <p>{hovered.co2_saved_kg.toFixed(4)} kg CO₂ saved</p>
        </div>
      )}

      {/* Top 5 Most Active Days */}
      {top5.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Most Active Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-muted-foreground font-medium">Rank</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Analyses</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Mass (kg)</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">CO₂ Saved (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5.map((day, i) => (
                      <tr
                        key={day.date}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 text-muted-foreground font-bold">#{i + 1}</td>
                        <td className="py-2.5 font-medium">{day.date}</td>
                        <td className="py-2.5 text-right">{day.count}</td>
                        <td className="py-2.5 text-right">{day.mass_kg.toFixed(3)}</td>
                        <td className="py-2.5 text-right">{day.co2_saved_kg.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
