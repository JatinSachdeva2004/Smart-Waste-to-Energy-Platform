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
import { Badge } from "@/components/ui/badge";
import type { EnergyData } from "@/lib/types";

const COLORS: Record<string, string> = {
  incineration: "#ef4444",
  pyrolysis: "#f59e0b",
  gasification: "#3b82f6",
  biogas: "#22c55e",
  plasma_arc: "#8b5cf6",
  recycling: "#06b6d4",
};

const ICONS: Record<string, string> = {
  incineration: "🔥",
  pyrolysis: "⚗️",
  gasification: "💨",
  biogas: "🌱",
  plasma_arc: "⚡",
  recycling: "♻️",
};

interface EnergyBreakdownProps {
  energy: EnergyData;
}

export function EnergyBreakdown({ energy }: EnergyBreakdownProps) {
  const chartData = Object.entries(energy.pathways)
    .map(([key, val]) => ({
      name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      kwh: val.energy_kwh,
      realistic: val.realistic_kwh || val.energy_kwh,
      color: COLORS[key] || "#6b7280",
      icon: ICONS[key] || "⚡",
      key,
      isBest: key === energy.best_method,
    }))
    .sort((a, b) => b.kwh - a.kwh);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Energy Conversion Pathways
            </CardTitle>
            <Badge variant="success">
              Best: {energy.best_method?.replace(/_/g, " ")} —{" "}
              {energy.best_realistic_kwh.toFixed(4)} kWh
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-xl text-sm">
                        <p className="font-medium">
                          {d.icon} {d.name}
                        </p>
                        <p>Theoretical: {d.kwh.toFixed(4)} kWh</p>
                        <p>Realistic: {d.realistic.toFixed(4)} kWh</p>
                        {d.isBest && (
                          <Badge variant="success" className="mt-1">
                            Best Method
                          </Badge>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="kwh"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1000}
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={entry.isBest ? 1 : 0.6}
                      stroke={entry.isBest ? entry.color : "transparent"}
                      strokeWidth={entry.isBest ? 2 : 0}
                    />
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
