import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function confidenceColor(level: string): string {
  switch (level) {
    case "high":
      return "text-green-500";
    case "medium":
      return "text-yellow-500";
    case "low":
      return "text-orange-500";
    case "very_low":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

export function confidenceBg(level: string): string {
  switch (level) {
    case "high":
      return "bg-green-500/10 border-green-500/30";
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/30";
    case "low":
      return "bg-orange-500/10 border-orange-500/30";
    case "very_low":
      return "bg-red-500/10 border-red-500/30";
    default:
      return "bg-muted";
  }
}

export function wasteTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
