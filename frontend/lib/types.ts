// Waste-to-Energy Platform Types

export interface Detection {
  object_index: number;
  record_id: number;
  waste_type: string;
  waste_subtype: string;
  confidence: number;
  confidence_level: string;
  confidence_color: number[] | string;
  bbox?: [number, number, number, number];
  mass_kg: number;
  mass_range: { min_kg: number; max_kg: number };
  estimation_method: string;
  pile_fraction?: number;
  size: SizeData;
  energy: EnergyData;
  environmental: EnvironmentalData;
  recommendation: Recommendation;
  warnings: string[];
}

export interface SizeData {
  mass_kg: number;
  area_cm2: number;
  volume_m3: number;
  estimation_method: string;
  confidence_pct: number;
  mass_range: { min_kg: number; max_kg: number };
  warnings: string[];
}

export interface EnergyPathway {
  energy_kwh: number;
  energy_mj?: number;
  realistic_kwh?: number;
  efficiency?: number;
  suitable?: boolean;
  name?: string;
}

export interface EnergyData {
  pathways: Record<string, EnergyPathway>;
  best_method: string;
  best_energy_kwh: number;
  best_realistic_kwh: number;
}

export interface EnvironmentalData {
  co2_saved_kg: number;
  methane_saved_kg: number;
  water_saved_liters: number;
  landfill_diverted_m3: number;
  trees_equivalent: number;
  homes_powered_days: number;
  toxic_leachate_liters: number;
  soil_saved_m2: number;
}

export interface Recommendation {
  text: string;
  is_hazardous: boolean;
  is_recyclable: boolean;
}

export interface UploadResponse {
  success: boolean;
  session_id: string;
  objects_count: number;
  objects: Detection[];
  density: DensityInfo;
  record_id: number;
  waste_type: string;
  waste_subtype: string;
  confidence: number;
  confidence_level: string;
  mass_kg: number;
  size: SizeData;
  energy: EnergyData;
  environmental: EnvironmentalData;
  recommendation: Recommendation;
  warnings: string[];
  totals: { mass_kg: number; energy_kwh: number; co2_saved_kg: number };
  images: { original: string; annotated: string };
  subtypes_available: Record<string, string>;
  error?: string;
}

export interface DensityInfo {
  is_dense_pile: boolean;
  detected_count: number;
  estimated_total_count: number;
  coverage_pct: number;
  instance_counts: Record<string, number>;
  estimated_counts: Record<string, number>;
  estimated_mass_kg: number;
  estimation_method: string;
  density_objects_per_m2: number;
  composition?: Record<string, number>;
}

export interface DashboardStats {
  total_records: number;
  total_mass_kg: number;
  total_energy_kwh: number;
  total_co2_saved_kg: number;
  total_water_saved_liters: number;
  total_methane_saved_kg: number;
  waste_type_distribution: Record<string, number>;
  method_distribution: Record<string, number>;
}

/** Alias used by some UI components */
export type WasteDistribution = DashboardStats["waste_type_distribution"];

export interface WasteRecord {
  id: number;
  waste_type: string;
  waste_subtype: string;
  confidence: number;
  estimated_mass_kg: number;
  best_method: string;
  best_energy_kwh: number;
  co2_saved_kg: number;
  methane_saved_kg: number;
  water_saved_liters: number;
  landfill_diverted_m3: number;
  trees_equivalent: number;
  homes_powered_days: number;
  toxic_leachate_liters: number;
  soil_saved_m2: number;
  image_path: string;
  annotated_image_path: string;
  recommendation_text: string;
  is_hazardous: boolean;
  is_recyclable: boolean;
  created_at: string;
}

export interface TrendAggregate {
  date: string;
  count: number;
  total_mass_kg: number;
  total_energy_kwh: number;
  total_co2_saved_kg: number;
}

export interface ForecastPoint {
  date: string;
  predicted_mass_kg: number;
  predicted_energy_kwh: number;
}

export interface WasteCategoryData {
  category: string;
  count: number;
  total_mass_kg: number;
  total_energy_kwh: number;
}

export type WasteCategory =
  | "plastic"
  | "paper"
  | "metal"
  | "glass"
  | "organic"
  | "ewaste"
  | "textile"
  | "wood"
  | "rubber"
  | "medical"
  | "composite"
  | "ceramic"
  | "general_waste";

export const WASTE_COLORS: Record<string, string> = {
  plastic: "#3b82f6",
  paper: "#f59e0b",
  metal: "#6b7280",
  glass: "#06b6d4",
  organic: "#22c55e",
  ewaste: "#ef4444",
  textile: "#a855f7",
  wood: "#92400e",
  rubber: "#1f2937",
  medical: "#dc2626",
  composite: "#8b5cf6",
  ceramic: "#d97706",
  general_waste: "#9ca3af",
};

export const WASTE_ICONS: Record<string, string> = {
  plastic: "🧴",
  paper: "📦",
  metal: "🔩",
  glass: "🍶",
  organic: "🍌",
  ewaste: "📱",
  textile: "👕",
  wood: "🪵",
  rubber: "🛞",
  medical: "💉",
  composite: "🔗",
  ceramic: "🏺",
  general_waste: "🗑️",
};

// ── Insights Types (Unique Features) ──────────────────

export interface DecompositionItem {
  waste_type: string;
  count: number;
  total_mass_kg: number;
  decomposition_years: number;
  decomposition_label: string;
  landfill_impact: "critical" | "moderate" | "low";
}

export interface DecompositionResponse {
  timeline: DecompositionItem[];
}

export interface CarbonCreditMonthly {
  month: string;
  co2_saved_kg: number;
  credits: number;
  value_inr: number;
  count: number;
}

export interface CarbonCreditResponse {
  total_co2_saved_kg: number;
  total_co2_tonnes: number;
  credits_earned: number;
  value_inr: number;
  value_usd: number;
  total_energy_kwh: number;
  total_records: number;
  monthly_breakdown: CarbonCreditMonthly[];
}

export interface HeatmapDay {
  date: string;
  count: number;
  mass_kg: number;
  co2_saved_kg: number;
}

export interface HeatmapResponse {
  days: number;
  data: HeatmapDay[];
}

export interface WhatIfScenario {
  scenario: {
    waste_type: string;
    mass_kg: number;
    method: string;
    recycling_rate: number;
    effective_mass_kg: number;
  };
  recovery: {
    energy: Record<string, unknown>;
    environmental: Record<string, number>;
  };
  landfill_comparison: {
    co2_emitted_kg: number;
    methane_emitted_kg: number;
    co2_difference_kg: number;
    energy_wasted_kwh: number;
  };
  carbon_credit_value_inr: number;
}
