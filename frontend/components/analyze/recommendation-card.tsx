"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, Recycle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              AI Recommendation
            </CardTitle>
            <div className="flex gap-2">
              {recommendation.is_hazardous && (
                <Badge variant="danger" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Hazardous
                </Badge>
              )}
              {recommendation.is_recyclable && (
                <Badge variant="success" className="flex items-center gap-1">
                  <Recycle className="h-3 w-3" />
                  Recyclable
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {recommendation.text}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
