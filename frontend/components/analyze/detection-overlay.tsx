"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Detection } from "@/lib/types";
import { WASTE_COLORS, WASTE_ICONS } from "@/lib/types";

interface DetectionOverlayProps {
  imageUrl: string;
  detections: Detection[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

export function DetectionOverlay({
  imageUrl,
  detections,
  selectedIndex,
  onSelect,
}: DetectionOverlayProps) {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = React.useState({ w: 0, h: 0, natW: 1, natH: 1 });

  const updateDims = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgDims({
      w: img.clientWidth,
      h: img.clientHeight,
      natW: img.naturalWidth || 1,
      natH: img.naturalHeight || 1,
    });
  };

  React.useEffect(() => {
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  const scaleX = imgDims.w / imgDims.natW;
  const scaleY = imgDims.h / imgDims.natH;

  return (
    <div className="relative rounded-xl overflow-hidden border border-border group">
      <div className="scan-line pointer-events-none" />

      <img
        ref={imgRef}
        src={imageUrl}
        alt="Detection result"
        className="w-full h-auto max-h-[500px] object-contain bg-black/5 dark:bg-white/5"
        onLoad={updateDims}
      />

      {imgDims.w > 0 &&
        detections.map((det, i) => {
          const bbox = det.bbox;
          if (!bbox || bbox.length < 4) return null;

          const [x1, y1, x2, y2] = bbox;
          const bw = x2 - x1;
          const bh = y2 - y1;

          // Skip zero-size or full-image boxes for pile detections
          const isFullImage =
            x1 <= 2 && y1 <= 2 &&
            Math.abs(x2 - imgDims.natW) <= 4 &&
            Math.abs(y2 - imgDims.natH) <= 4;
          if (isFullImage && detections.length > 1) return null;

          const left   = x1 * scaleX;
          const top    = y1 * scaleY;
          const width  = bw * scaleX;
          const height = bh * scaleY;

          const color  = WASTE_COLORS[det.waste_type] || "#9ca3af";
          const isSelected = selectedIndex === i;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.25 }}
              onClick={() => onSelect?.(i)}
              className="absolute"
              style={{
                left,
                top,
                width,
                height,
                cursor: onSelect ? "pointer" : "default",
                pointerEvents: onSelect ? "auto" : "none",
              }}
            >
              {/* Box border */}
              <div
                className="absolute inset-0 rounded-sm"
                style={{
                  border: `${isSelected ? 3 : 2}px solid ${color}`,
                  boxShadow: isSelected
                    ? `0 0 0 1px ${color}40, inset 0 0 0 1px ${color}20`
                    : `0 0 6px ${color}50`,
                  backgroundColor: isSelected ? `${color}12` : `${color}08`,
                  transition: "all 0.2s",
                }}
              />

              {/* Numbered circle badge — top-left corner */}
              <div
                className="absolute -top-3.5 -left-3.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md border-2 border-white/20 z-10"
                style={{ backgroundColor: color }}
              >
                {i + 1}
              </div>

              {/* Label bar — top of box */}
              <div
                className="absolute -top-6 left-3 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap shadow z-10"
                style={{ backgroundColor: color }}
              >
                <span>{WASTE_ICONS[det.waste_type] || "🗑️"}</span>
                <span className="capitalize">
                  {det.waste_type.replace(/_/g, " ")}
                </span>
                <span className="opacity-75">
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Corner accent dots */}
              {[
                { top: -3, left: -3 },
                { top: -3, right: -3 },
                { bottom: -3, left: -3 },
                { bottom: -3, right: -3 },
              ].map((pos, j) => (
                <div
                  key={j}
                  className="absolute h-2 w-2 rounded-full"
                  style={{ ...pos, backgroundColor: color }}
                />
              ))}
            </motion.div>
          );
        })}
    </div>
  );
}
