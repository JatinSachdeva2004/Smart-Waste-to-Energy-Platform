"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WASTE_COLORS, WASTE_ICONS } from "@/lib/types";
import { wasteTypeLabel } from "@/lib/utils";

interface WasteChartProps {
  data: Record<string, number>;
}

export function WasteDistributionChart({ data }: WasteChartProps) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: wasteTypeLabel(name),
      value,
      icon: WASTE_ICONS[name] || "🗑️",
      color: WASTE_COLORS[name] || "#9ca3af",
      key: name,
    }))
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No data yet — upload waste images to see distribution
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Waste Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Pie chart */}
            <div className="h-64 w-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-xl">
                          <p className="font-medium">
                            {d.icon} {d.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {d.value} records (
                            {total > 0
                              ? ((d.value / total) * 100).toFixed(1)
                              : 0}
                            %)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {chartData.map((d, i) => (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent/50 transition-colors"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-sm truncate">
                    {d.icon} {d.name}
                  </span>
                  <span className="ml-auto text-sm font-medium text-muted-foreground">
                    {d.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
