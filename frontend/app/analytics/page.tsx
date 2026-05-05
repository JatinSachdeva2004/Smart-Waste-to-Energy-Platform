"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendsChart } from "@/components/analytics/trends-chart";
import { ForecastChart } from "@/components/analytics/forecast-chart";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { getTrends, getForecast, getDashboardStats } from "@/lib/api";
import type {
  TrendAggregate,
  ForecastPoint,
  DashboardStats,
  WasteCategoryData,
} from "@/lib/types";
import { BarChart3, TrendingUp, Brain, RefreshCw } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useRefresh } from "@/lib/refresh-context";

export default function AnalyticsPage() {
  const [trends, setTrends] = React.useState<TrendAggregate[]>([]);
  const [forecast, setForecast] = React.useState<ForecastPoint[]>([]);
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [days, setDays] = React.useState(30);
  const [forecastDays, setForecastDays] = React.useState(7);
  const { refreshKey } = useRefresh();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [t, f, s] = await Promise.all([
        getTrends(days),
        getForecast(days, forecastDays),
        getDashboardStats(),
      ]);
      setTrends(t);
      setForecast(f);
      setStats(s);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [days, forecastDays, refreshKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  const categories: WasteCategoryData[] = stats
    ? Object.entries(stats.waste_type_distribution).map(([k, v]) => ({
        category: k,
        count: v,
        total_mass_kg: 0,
        total_energy_kwh: 0,
      }))
    : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Trends, forecasts, and waste processing insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Analyses",
              value: formatNumber(stats.total_records),
              icon: BarChart3,
              color: "text-blue-500",
            },
            {
              label: "Avg Energy / Record",
              value:
                stats.total_records > 0
                  ? formatNumber(
                      stats.total_energy_kwh / stats.total_records,
                      2,
                    ) + " kWh"
                  : "0",
              icon: TrendingUp,
              color: "text-primary",
            },
            {
              label: "Waste Types",
              value: Object.keys(
                stats.waste_type_distribution,
              ).length.toString(),
              icon: Brain,
              color: "text-purple-500",
            },
            {
              label: "Forecast Days",
              value: forecastDays.toString(),
              icon: TrendingUp,
              color: "text-amber-500",
            },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted/50 ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-lg font-bold">{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : null}

      {/* Charts */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <TrendsChart data={trends} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForecastChart data={forecast} />
            <CategoryBreakdown categories={categories} />
          </div>
        </div>
      )}
    </div>
  );
}
