"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnergyChartProps {
  data: Record<string, number>;
}

const METHOD_COLORS: Record<string, string> = {
  incineration: "#ef4444",
  pyrolysis: "#f59e0b",
  gasification: "#3b82f6",
  biogas: "#22c55e",
  plasma_arc: "#8b5cf6",
  recycling: "#06b6d4",
};

const METHOD_ICONS: Record<string, string> = {
  incineration: "🔥",
  pyrolysis: "⚗️",
  gasification: "💨",
  biogas: "🌱",
  plasma_arc: "⚡",
  recycling: "♻️",
};

export function EnergyMethodChart({ data }: EnergyChartProps) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([method, count]) => ({
      name: method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      color: METHOD_COLORS[method] || "#6b7280",
      icon: METHOD_ICONS[method] || "⚡",
      key: method,
    }))
    .sort((a, b) => b.count - a.count);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Energy Methods</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No energy conversion data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best Energy Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
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
                          {d.count} analyses
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1200}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
