"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ForecastPoint } from "@/lib/types";

interface Props {
  data: ForecastPoint[];
}

export function ForecastChart({ data }: Props) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Volume Forecast</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Not enough data for forecasting
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    "Mass (kg)": Math.round(d.predicted_mass_kg * 1000) / 1000,
    "Energy (kWh)": Math.round(d.predicted_energy_kwh * 1000) / 1000,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Volume Forecast</CardTitle>
          <CardDescription>Next {data.length} day prediction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
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
                <Line
                  type="monotone"
                  dataKey="Mass (kg)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f59e0b" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Energy (kWh)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
