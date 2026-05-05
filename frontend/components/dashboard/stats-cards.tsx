"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

function AnimatedCounter({
  value,
  suffix = "",
  decimals = 1,
  duration = 1.5,
}: AnimatedCounterProps) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    const increment = end / (duration * 60);
    let frame: number;
    const animate = () => {
      start += increment;
      if (start >= end) {
        setDisplay(end);
        return;
      }
      setDisplay(start);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span>
      {decimals === 0 ? Math.floor(display) : display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  description?: string;
  trend?: number;
  color: string;
  index: number;
}

export function StatsCard({
  title,
  value,
  suffix,
  decimals,
  icon,
  description,
  trend,
  color,
  index,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
    >
      <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
        {/* Glow accent */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at top right, ${color}15, transparent 70%)`,
          }}
        />
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tracking-tight">
                <AnimatedCounter
                  value={value}
                  suffix={suffix}
                  decimals={decimals ?? 1}
                />
              </p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
              )}
              style={{ backgroundColor: `${color}15`, color }}
            >
              {icon}
            </div>
          </div>
          {trend !== undefined && (
            <div className="mt-3 flex items-center gap-1 text-xs">
              <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </span>
              <span className="text-muted-foreground">from last period</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
