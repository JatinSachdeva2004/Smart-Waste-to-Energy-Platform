"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WASTE_ICONS, WASTE_COLORS } from "@/lib/types";
import type { Detection } from "@/lib/types";
import {
  cn,
  wasteTypeLabel,
  confidenceColor,
  formatNumber,
} from "@/lib/utils";

interface DetectionResultsProps {
  detections: Detection[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export function DetectionResults({
  detections,
  selectedIndex,
  onSelect,
}: DetectionResultsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Detected Objects ({detections.length})
      </h3>
      {detections.map((det, i) => {
        const isSelected = selectedIndex === i;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <Card
              onClick={() => onSelect?.(i)}
              className={cn(
                "overflow-hidden transition-all",
                onSelect && "cursor-pointer",
                isSelected
                  ? "ring-2 ring-primary shadow-md border-primary/40"
                  : "hover:shadow-md",
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-xl shrink-0"
                    style={{
                      backgroundColor:
                        (WASTE_COLORS[det.waste_type] || "#9ca3af") + "15",
                    }}
                  >
                    {WASTE_ICONS[det.waste_type] || "🗑️"}
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">
                          {wasteTypeLabel(det.waste_type)}
                          {detections.length > 1 && (
                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                              #{i + 1}
                            </span>
                          )}
                        </h4>
                        {det.waste_subtype && (
                          <p className="text-xs text-muted-foreground">
                            {det.waste_subtype}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && onSelect && (
                          <Badge variant="outline" className="text-xs border-primary text-primary">
                            Viewing
                          </Badge>
                        )}
                        <Badge
                          variant={
                            det.confidence_level === "high"
                              ? "success"
                              : det.confidence_level === "medium"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {(det.confidence * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Confidence</span>
                        <span className={confidenceColor(det.confidence_level)}>
                          {det.confidence_level}
                        </span>
                      </div>
                      <Progress
                        value={det.confidence * 100}
                        className="h-1.5"
                        indicatorClassName={cn(
                          det.confidence >= 0.85
                            ? "bg-green-500"
                            : det.confidence >= 0.6
                              ? "bg-yellow-500"
                              : det.confidence >= 0.4
                                ? "bg-orange-500"
                                : "bg-red-500",
                        )}
                      />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Mass</p>
                        <p className="text-sm font-bold">
                          {formatNumber(det.mass_kg, 3)} kg
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">Energy</p>
                        <p className="text-sm font-bold">
                          {formatNumber(det.energy.best_realistic_kwh, 3)} kWh
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-xs text-muted-foreground">CO₂ Saved</p>
                        <p className="text-sm font-bold">
                          {formatNumber(det.environmental.co2_saved_kg, 3)} kg
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
