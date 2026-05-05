"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SustainabilityScoreProps {
  co2Saved: number;
  waterSaved: number;
  totalRecords: number;
}

export function SustainabilityScore({
  co2Saved,
  waterSaved,
  totalRecords,
}: SustainabilityScoreProps) {
  // Score algorithm: based on volume of processing
  const score = Math.min(
    100,
    Math.round(
      Math.min(totalRecords * 3, 30) +
        Math.min(co2Saved * 5, 40) +
        Math.min(waterSaved * 0.5, 30),
    ),
  );

  const getColor = () => {
    if (score >= 80)
      return {
        ring: "#22c55e",
        glow: "rgba(34,197,94,0.3)",
        label: "Excellent",
        emoji: "🌟",
      };
    if (score >= 50)
      return {
        ring: "#f59e0b",
        glow: "rgba(245,158,11,0.3)",
        label: "Good",
        emoji: "👍",
      };
    return {
      ring: "#ef4444",
      glow: "rgba(239,68,68,0.3)",
      label: "Getting Started",
      emoji: "🌱",
    };
  };

  const c = getColor();
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sustainability Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              className="stroke-muted"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={c.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
              style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{score}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-medium">
            {c.emoji} {c.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {totalRecords} analyses
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
