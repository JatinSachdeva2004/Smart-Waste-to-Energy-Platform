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
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getCarbonCredits } from "@/lib/api";
import { useRefresh } from "@/lib/refresh-context";
import type { CarbonCreditResponse } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Coins, Leaf, Wind, Zap, FileCheck } from "lucide-react";

function AnimatedCounter({
  value,
  decimals = 2,
  duration = 1.5,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const increment = value / (duration * 60);
    let frame: number;
    const animate = () => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        return;
      }
      setDisplay(start);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <span>{display.toFixed(decimals)}</span>;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m) - 1]} '${year.slice(2)}`;
}

type ChartMetric = "credits" | "co2_saved_kg" | "value_inr";
type Currency = "inr" | "usd";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: 12,
};

export default function CarbonCreditsPage() {
  const [data, setData] = React.useState<CarbonCreditResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [currency, setCurrency] = React.useState<Currency>("inr");
  const [chartMetric, setChartMetric] = React.useState<ChartMetric>("credits");
  const { refreshKey } = useRefresh();

  React.useEffect(() => {
    setLoading(true);
    getCarbonCredits()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-3">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm">Could not load carbon credit data. Is the backend running?</p>
      </div>
    );
  }

  const fractional = data.credits_earned % 1;
  const treesEquivalent = Math.round(data.total_co2_tonnes * 45.6);
  const carKmAvoided = Math.round(data.total_co2_saved_kg / 0.21);

  const chartData = data.monthly_breakdown.map((m) => ({
    ...m,
    name: formatMonth(m.month),
  }));

  const metricLabels: Record<ChartMetric, string> = {
    credits: "Credits",
    co2_saved_kg: "CO₂ (kg)",
    value_inr: "Value (₹)",
  };

  const metricCards = [
    {
      title: "CO₂ Saved",
      value: data.total_co2_saved_kg,
      suffix: " kg",
      decimals: 2,
      icon: <Leaf className="h-5 w-5" />,
      color: "#22c55e",
    },
    {
      title: "CO₂ in Tonnes",
      value: data.total_co2_tonnes,
      suffix: " t",
      decimals: 4,
      icon: <Wind className="h-5 w-5" />,
      color: "#06b6d4",
    },
    {
      title: "Energy Generated",
      value: data.total_energy_kwh,
      suffix: " kWh",
      decimals: 2,
      icon: <Zap className="h-5 w-5" />,
      color: "#f59e0b",
    },
    {
      title: "Records Processed",
      value: data.total_records,
      suffix: "",
      decimals: 0,
      icon: <FileCheck className="h-5 w-5" />,
      color: "#3b82f6",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" />
          Carbon Credit Wallet
        </h2>
        <p className="text-sm text-muted-foreground">
          CO₂ savings converted to tradeable carbon credits
        </p>
      </motion.div>

      {/* Hero Wallet Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Card className="relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at top left, #22c55e18, transparent 60%), radial-gradient(ellipse at bottom right, #16a34a12, transparent 60%)",
            }}
          />
          <CardContent className="p-8 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">
                  Carbon Credits Earned
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl">🌿</span>
                  <p className="text-6xl font-bold tracking-tight text-green-600 dark:text-green-400">
                    <AnimatedCounter value={data.credits_earned} decimals={4} />
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  credits · 1 credit = 1 tonne CO₂ equivalent
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrency((c) => (c === "inr" ? "usd" : "inr"))}
                >
                  {currency === "inr" ? "₹ INR" : "$ USD"} ⇄
                </Button>
                <div className="text-right">
                  <p className="text-3xl font-bold">
                    {currency === "inr"
                      ? `₹${formatNumber(data.value_inr, 2)}`
                      : `$${formatNumber(data.value_usd, 2)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currency === "inr"
                      ? `$${data.value_usd.toFixed(2)} USD`
                      : `₹${data.value_inr.toFixed(2)} INR`}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress to next credit */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Progress to next credit</span>
                <span>{(fractional * 100).toFixed(0)}%</span>
              </div>
              <Progress
                value={fractional * 100}
                className="h-2"
                indicatorClassName="bg-green-500"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at top right, ${card.color}15, transparent 70%)`,
                }}
              />
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}
                  >
                    {card.icon}
                  </div>
                </div>
                <p className="text-xl font-bold">
                  <AnimatedCounter value={card.value} decimals={card.decimals} />
                  {card.suffix}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Equivalent Impact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            emoji: "🌳",
            label: "Trees Equivalent",
            value: treesEquivalent.toLocaleString(),
            desc: "trees absorbing CO₂ for one year",
            color: "#22c55e",
          },
          {
            emoji: "🚗",
            label: "Car Journeys Avoided",
            value: carKmAvoided.toLocaleString(),
            desc: "km of average car travel offset",
            color: "#3b82f6",
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at top right, ${card.color}15, transparent 70%)`,
                }}
              />
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl flex-shrink-0"
                    style={{ backgroundColor: `${card.color}15` }}
                  >
                    {card.emoji}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Monthly Breakdown Chart */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Monthly Breakdown</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {(Object.entries(metricLabels) as [ChartMetric, string][]).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={chartMetric === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChartMetric(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey={chartMetric}
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name={metricLabels[chartMetric]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Monthly Table */}
      {data.monthly_breakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Monthly Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-muted-foreground font-medium">Month</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Analyses</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">CO₂ Saved</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Credits</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly_breakdown.map((row) => (
                      <tr
                        key={row.month}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 font-medium">{formatMonth(row.month)}</td>
                        <td className="py-2.5 text-right">{row.count}</td>
                        <td className="py-2.5 text-right">{row.co2_saved_kg.toFixed(3)} kg</td>
                        <td className="py-2.5 text-right font-medium text-green-600 dark:text-green-400">
                          {row.credits.toFixed(6)}
                        </td>
                        <td className="py-2.5 text-right">
                          {currency === "inr"
                            ? `₹${row.value_inr.toFixed(2)}`
                            : `$${(row.value_inr / 83).toFixed(2)}`}
                        </td>
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
