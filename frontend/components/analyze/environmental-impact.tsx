"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Leaf,
  Droplets,
  TreePine,
  Home,
  FlaskConical,
  Mountain,
  Flame,
  Ban,
} from "lucide-react";
import type { EnvironmentalData } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface EnvImpactProps {
  data: EnvironmentalData;
}

const METRICS = [
  {
    key: "co2_saved_kg",
    label: "CO₂ Reduced",
    unit: "kg",
    icon: Leaf,
    color: "#22c55e",
  },
  {
    key: "methane_saved_kg",
    label: "Methane Prevented",
    unit: "kg",
    icon: Flame,
    color: "#8b5cf6",
  },
  {
    key: "water_saved_liters",
    label: "Water Saved",
    unit: "L",
    icon: Droplets,
    color: "#0ea5e9",
  },
  {
    key: "landfill_diverted_m3",
    label: "Landfill Diverted",
    unit: "m³",
    icon: Ban,
    color: "#f59e0b",
  },
  {
    key: "trees_equivalent",
    label: "Trees Equivalent",
    unit: "",
    icon: TreePine,
    color: "#16a34a",
  },
  {
    key: "homes_powered_days",
    label: "Homes Powered",
    unit: "days",
    icon: Home,
    color: "#3b82f6",
  },
  {
    key: "toxic_leachate_liters",
    label: "Leachate Prevented",
    unit: "L",
    icon: FlaskConical,
    color: "#ef4444",
  },
  {
    key: "soil_saved_m2",
    label: "Soil Protected",
    unit: "m²",
    icon: Mountain,
    color: "#92400e",
  },
];

export function EnvironmentalImpact({ data }: EnvImpactProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🌍 Environmental Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {METRICS.map((m, i) => {
              const val = (data as any)[m.key] || 0;
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.06 }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border p-3 hover:bg-accent/30 transition-colors"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: m.color + "15", color: m.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold">
                    {formatNumber(val, val < 1 ? 4 : 2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground text-center leading-tight">
                    {m.label} {m.unit && `(${m.unit})`}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
