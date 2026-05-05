"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDecompositionTimeline } from "@/lib/api";
import { useRefresh } from "@/lib/refresh-context";
import type { DecompositionItem } from "@/lib/types";
import { WASTE_COLORS, WASTE_ICONS } from "@/lib/types";
import { wasteTypeLabel, formatNumber } from "@/lib/utils";
import { Timer, AlertTriangle, Scale, ArrowUpDown } from "lucide-react";

const MAX_LOG_YEARS = Math.log10(451); // plastic ~450yr worst case

function logBarPct(years: number): number {
  if (years <= 0) return 1;
  return Math.min(100, (Math.log10(years + 1) / MAX_LOG_YEARS) * 100);
}

function ImpactBadge({ impact }: { impact: "critical" | "moderate" | "low" }) {
  if (impact === "critical") return <Badge variant="danger">Critical</Badge>;
  if (impact === "moderate") return <Badge variant="warning">Moderate</Badge>;
  return <Badge variant="success">Low</Badge>;
}

type SortKey = "years" | "mass" | "impact";
const impactRank: Record<string, number> = { critical: 2, moderate: 1, low: 0 };

export default function DecompositionPage() {
  const [data, setData] = React.useState<DecompositionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState<SortKey>("years");
  const { refreshKey } = useRefresh();

  React.useEffect(() => {
    setLoading(true);
    getDecompositionTimeline()
      .then((r) => setData(r.timeline))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-3">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm">No data yet. Upload some waste images to see the decomposition timeline.</p>
      </div>
    );
  }

  const totalMass = data.reduce((s, d) => s + d.total_mass_kg, 0);
  const worst = data.reduce((a, b) =>
    a.decomposition_years > b.decomposition_years ? a : b,
  );

  const sorted = [...data].sort((a, b) => {
    if (sortBy === "years") return b.decomposition_years - a.decomposition_years;
    if (sortBy === "mass") return b.total_mass_kg - a.total_mass_kg;
    return (impactRank[b.landfill_impact] ?? 0) - (impactRank[a.landfill_impact] ?? 0);
  });

  const summaryCards = [
    {
      title: "Waste Types Tracked",
      value: data.length.toString(),
      icon: <Timer className="h-5 w-5" />,
      color: "#3b82f6",
      desc: "unique materials analyzed",
    },
    {
      title: "Total Mass at Risk",
      value: `${formatNumber(totalMass, 2)} kg`,
      icon: <Scale className="h-5 w-5" />,
      color: "#f59e0b",
      desc: "across all analyses",
    },
    {
      title: "Worst Offender",
      value: wasteTypeLabel(worst.waste_type),
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "#ef4444",
      desc: worst.decomposition_label,
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
          <Timer className="h-6 w-6 text-primary" />
          Decomposition Timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          How long your analyzed waste types will persist in landfill
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at top right, ${card.color}15, transparent 70%)`,
                }}
              />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}
                  >
                    {card.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Sort Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex flex-wrap items-center gap-2"
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(
          [
            ["years", "Decomposition Time"],
            ["mass", "Mass"],
            ["impact", "Impact Severity"],
          ] as [SortKey, string][]
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={sortBy === key ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy(key)}
          >
            {label}
          </Button>
        ))}
      </motion.div>

      {/* Timeline Bars */}
      <div className="space-y-3">
        {sorted.map((item, i) => {
          const color = WASTE_COLORS[item.waste_type] ?? "#9ca3af";
          const icon = WASTE_ICONS[item.waste_type] ?? "♻️";
          const pct = logBarPct(item.decomposition_years);
          const lifetimes = (item.decomposition_years / 79).toFixed(1);

          return (
            <motion.div
              key={item.waste_type}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Label */}
                    <div className="w-40 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{icon}</span>
                        <div>
                          <p className="font-semibold text-sm">
                            {wasteTypeLabel(item.waste_type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.count} sample{item.count !== 1 ? "s" : ""} · {item.total_mass_kg.toFixed(2)} kg
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bar + Info */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-5 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            delay: i * 0.08 + 0.2,
                            duration: 0.6,
                            ease: "easeOut",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{item.decomposition_label}</span>
                          <ImpactBadge impact={item.landfill_impact} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ⌛ {lifetimes} human lifetime{parseFloat(lifetimes) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Explainer Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What This Means</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  emoji: "🔴",
                  label: "Critical Impact",
                  color: "#ef4444",
                  text: "These materials will outlast entire civilizations in landfill — prioritize diversion and energy recovery at all costs.",
                },
                {
                  emoji: "🟡",
                  label: "Moderate Impact",
                  color: "#f59e0b",
                  text: "Decades of slow degradation releasing harmful leachates into soil and groundwater — significant processing opportunity.",
                },
                {
                  emoji: "🟢",
                  label: "Low Impact",
                  color: "#22c55e",
                  text: "Biodegradable within a human timescale, but still contributes to methane emissions and leachate in landfill.",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="rounded-lg p-4 border"
                  style={{ borderColor: `${card.color}30`, backgroundColor: `${card.color}08` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{card.emoji}</span>
                    <span className="text-sm font-semibold" style={{ color: card.color }}>
                      {card.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
