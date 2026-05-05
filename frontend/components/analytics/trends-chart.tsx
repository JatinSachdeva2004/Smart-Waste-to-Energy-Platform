"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  Line,
} from "recharts";
import type { TrendAggregate } from "@/lib/types";
import { WASTE_COLORS } from "@/lib/types";

interface Props {
  data: TrendAggregate[];
}

export function TrendsChart({ data }: Props) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No trend data available
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    "Total Mass (kg)": Math.round(d.total_mass_kg * 1000) / 1000,
    "Energy (kWh)": Math.round(d.total_energy_kwh * 1000) / 1000,
    "CO₂ Saved (kg)": Math.round(d.total_co2_saved_kg * 1000) / 1000,
    Records: d.count,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Processing Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="gradEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="gradCo2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="Energy (kWh)"
                  stroke="hsl(var(--primary))"
                  fill="url(#gradEnergy)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="CO₂ Saved (kg)"
                  stroke="#22c55e"
                  fill="url(#gradCo2)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Total Mass (kg)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
