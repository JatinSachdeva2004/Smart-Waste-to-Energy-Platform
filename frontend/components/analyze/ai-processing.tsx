"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, Brain, Zap, Leaf } from "lucide-react";

interface AIProcessingProps {
  stage: number; // 0=scanning, 1=detecting, 2=energy, 3=impact
  active: boolean;
}

const STAGES = [
  { icon: Scan, label: "Scanning Image", desc: "Analyzing visual features..." },
  {
    icon: Brain,
    label: "AI Detection",
    desc: "Identifying waste materials...",
  },
  {
    icon: Zap,
    label: "Energy Estimation",
    desc: "Calculating energy potential...",
  },
  {
    icon: Leaf,
    label: "Environmental Impact",
    desc: "Computing eco metrics...",
  },
];

export function AIProcessingAnimation({ stage, active }: AIProcessingProps) {
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 py-4"
    >
      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          animate={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
          transition={{ duration: 0.5 }}
          style={{ boxShadow: "0 0 10px hsl(var(--primary))" }}
        />
      </div>

      {/* Stage indicators */}
      <div className="grid grid-cols-4 gap-3">
        {STAGES.map((s, i) => {
          const isActive = i === stage;
          const isDone = i < stage;
          const Icon = s.icon;

          return (
            <motion.div
              key={i}
              animate={isActive ? { scale: [1, 1.02, 1] } : {}}
              transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
              className={`flex flex-col items-center gap-2 rounded-xl p-3 border transition-all ${
                isDone
                  ? "border-primary/30 bg-primary/5"
                  : isActive
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
                    : "border-transparent bg-muted/30"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  isDone
                    ? "bg-primary/20 text-primary"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    ✓
                  </motion.span>
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="text-center">
                <p
                  className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
                >
                  {s.label}
                </p>
                {isActive && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-[10px] text-muted-foreground mt-0.5"
                  >
                    {s.desc}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
