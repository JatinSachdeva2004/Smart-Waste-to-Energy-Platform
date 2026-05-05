"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WASTE_ICONS } from "@/lib/types";
import type { WasteRecord } from "@/lib/types";
import { wasteTypeLabel, formatNumber } from "@/lib/utils";

interface RecentRecordsProps {
  records: WasteRecord[];
}

export function RecentRecords({ records }: RecentRecordsProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Analyses</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="text-4xl">🔬</p>
          <p className="text-sm text-muted-foreground">No analyses yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Analyses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.slice(0, 8).map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <span className="text-xl">{WASTE_ICONS[r.waste_type] || "🗑️"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {wasteTypeLabel(r.waste_type)}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.created_at
                  ? new Date(r.created_at).toLocaleDateString()
                  : "Unknown date"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium">
                {formatNumber(r.best_energy_kwh, 2)} kWh
              </p>
              <Badge variant="success" className="text-[10px]">
                {formatNumber(r.co2_saved_kg, 2)} kg CO₂
              </Badge>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
