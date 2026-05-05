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
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { WasteCategoryData } from "@/lib/types";
import { WASTE_COLORS } from "@/lib/types";

interface Props {
  categories: WasteCategoryData[];
}

export function CategoryBreakdown({ categories }: Props) {
  if (!categories.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No category data
        </CardContent>
      </Card>
    );
  }

  const data = categories.map((c) => ({
    name: c.category,
    value: c.count,
    mass: c.total_mass_kg,
    energy: c.total_energy_kwh,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Breakdown</CardTitle>
          <CardDescription>Distribution by waste type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={70}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          WASTE_COLORS[d.name as keyof typeof WASTE_COLORS] ||
                          "#94a3b8"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-48">
              {categories.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background:
                          WASTE_COLORS[
                            c.category as keyof typeof WASTE_COLORS
                          ] || "#94a3b8",
                      }}
                    />
                    <span className="capitalize">{c.category}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {c.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
