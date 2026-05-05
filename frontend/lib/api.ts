import type {
  DashboardStats,
  UploadResponse,
  WasteRecord,
  TrendAggregate,
  ForecastPoint,
  DecompositionResponse,
  CarbonCreditResponse,
  HeatmapResponse,
  WhatIfScenario,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function uploadImage(
  file: File,
  options?: {
    userWasteType?: string;
    userSubtype?: string;
    manualWeight?: number;
    contamination?: string;
    refType?: string;
    moisturePct?: number;
  },
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (options?.userWasteType)
    form.append("user_waste_type", options.userWasteType);
  if (options?.userSubtype) form.append("user_subtype", options.userSubtype);
  if (options?.manualWeight)
    form.append("manual_weight_kg", String(options.manualWeight));
  if (options?.contamination)
    form.append("contamination", options.contamination);
  if (options?.refType) form.append("ref_type", options.refType);
  if (options?.moisturePct !== undefined)
    form.append("moisture_pct", String(options.moisturePct));

  return fetchJSON<UploadResponse>(`${API}/upload`, {
    method: "POST",
    body: form,
  });
}

export async function getSubtypes(
  category: string,
): Promise<{ category: string; subtypes: Record<string, string> }> {
  return fetchJSON(`${API}/subtypes/${encodeURIComponent(category)}`);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchJSON<DashboardStats>(`${API}/api/dashboard/stats`);
}

export async function getRecords(limit = 50, skip = 0): Promise<WasteRecord[]> {
  const data = await fetchJSON<{ records: WasteRecord[] }>(
    `${API}/api/records?skip=${skip}&limit=${limit}`,
  );
  return data.records;
}

export async function getRecord(id: number): Promise<WasteRecord> {
  return fetchJSON<WasteRecord>(`${API}/api/records/${id}`);
}

export async function deleteRecord(id: number): Promise<{ deleted: boolean }> {
  return fetchJSON(`${API}/api/records/${id}`, { method: "DELETE" });
}

export async function getTrends(days = 30): Promise<TrendAggregate[]> {
  const data = await fetchJSON<{ aggregates: TrendAggregate[] }>(
    `${API}/api/analytics/trends?days=${days}`,
  );
  return data.aggregates;
}

export async function getForecast(
  historyDays = 30,
  ahead = 7,
): Promise<ForecastPoint[]> {
  const data = await fetchJSON<{ predictions: ForecastPoint[] }>(
    `${API}/api/analytics/forecast?history_days=${historyDays}&ahead=${ahead}`,
  );
  return data.predictions;
}

export async function generateReport(
  recordId?: number,
): Promise<{ report_id: number; file: string }> {
  return fetchJSON(`${API}/api/reports/generate`, { method: "POST" });
}

export function getDownloadUrl(reportIdOrUrl: number | string): string {
  if (typeof reportIdOrUrl === "string") {
    if (reportIdOrUrl.startsWith("http")) return reportIdOrUrl;
    return `${API}${reportIdOrUrl}`;
  }
  return `${API}/api/reports/${reportIdOrUrl}/download`;
}

export function getImageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

// ── Insights APIs (Unique Features) ──────────────────

export async function getDecompositionTimeline(): Promise<DecompositionResponse> {
  return fetchJSON<DecompositionResponse>(`${API}/api/insights/decomposition`);
}

export async function getCarbonCredits(): Promise<CarbonCreditResponse> {
  return fetchJSON<CarbonCreditResponse>(`${API}/api/insights/carbon-credits`);
}

export async function getWasteHeatmap(days = 365): Promise<HeatmapResponse> {
  return fetchJSON<HeatmapResponse>(`${API}/api/insights/heatmap?days=${days}`);
}

export async function getWhatIfScenario(
  wasteType: string,
  massKg: number,
  method: string,
  recyclingRate: number,
): Promise<WhatIfScenario> {
  return fetchJSON<WhatIfScenario>(
    `${API}/api/insights/whatif?waste_type=${encodeURIComponent(wasteType)}&mass_kg=${massKg}&method=${encodeURIComponent(method)}&recycling_rate=${recyclingRate}`,
  );
}

export async function getComparison(
  ids: number[],
): Promise<{
  items: Record<string, unknown>[];
  totals: Record<string, number>;
}> {
  return fetchJSON(`${API}/api/insights/comparison?ids=${ids.join(",")}`);
}
