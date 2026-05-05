"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  preview?: string | null;
  onClear?: () => void;
}

export function UploadZone({
  onFileSelect,
  disabled,
  preview,
  onClear,
}: UploadZoneProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border group">
        <img
          src={preview}
          alt="Preview"
          className="w-full h-80 object-contain bg-black/5 dark:bg-white/5"
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      whileHover={disabled ? {} : { scale: 1.005 }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 h-80 rounded-xl border-2 border-dashed transition-all cursor-pointer",
        dragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <motion.div
        animate={dragOver ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
      >
        {dragOver ? (
          <ImageIcon className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-primary" />
        )}
      </motion.div>

      <div className="text-center z-10">
        <p className="text-sm font-medium">
          {dragOver ? "Drop image here" : "Drag & drop waste image"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse · PNG, JPG, WebP up to 10MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </motion.div>
  );
}
