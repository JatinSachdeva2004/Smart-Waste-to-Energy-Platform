"use client";

import React from "react";
import { Zap, Scale, Leaf, Droplets, TreePine, Flame } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-cards";
import { WasteDistributionChart } from "@/components/dashboard/waste-chart";
import { EnergyMethodChart } from "@/components/dashboard/energy-chart";
import { RecentRecords } from "@/components/dashboard/recent-records";
import { SustainabilityScore } from "@/components/dashboard/sustainability-score";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardStats, getRecords } from "@/lib/api";
import type { DashboardStats, WasteRecord } from "@/lib/types";
import { useRefresh } from "@/lib/refresh-context";

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [records, setRecords] = React.useState<WasteRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { refreshKey } = useRefresh();

  React.useEffect(() => {
    setLoading(true);
    Promise.all([getDashboardStats(), getRecords(10, 0)])
      .then(([s, r]) => {
        setStats(s);
        setRecords(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-3">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm">
          Could not load dashboard data. Is the backend running on port 8000?
        </p>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          AI-powered waste analysis overview and environmental impact
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Analyses"
          value={s.total_records}
          decimals={0}
          icon={<Flame className="h-6 w-6" />}
          color="#3b82f6"
          index={0}
        />
        <StatsCard
          title="Total Mass"
          value={s.total_mass_kg}
          suffix=" kg"
          icon={<Scale className="h-6 w-6" />}
          color="#f59e0b"
          index={1}
        />
        <StatsCard
          title="Energy Generated"
          value={s.total_energy_kwh}
          suffix=" kWh"
          icon={<Zap className="h-6 w-6" />}
          color="#22c55e"
          index={2}
        />
        <StatsCard
          title="CO₂ Reduced"
          value={s.total_co2_saved_kg}
          suffix=" kg"
          icon={<Leaf className="h-6 w-6" />}
          color="#06b6d4"
          index={3}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Water Saved"
          value={s.total_water_saved_liters}
          suffix=" L"
          icon={<Droplets className="h-6 w-6" />}
          color="#0ea5e9"
          index={4}
        />
        <StatsCard
          title="Methane Prevented"
          value={s.total_methane_saved_kg}
          suffix=" kg"
          icon={<Flame className="h-6 w-6" />}
          color="#a855f7"
          index={5}
        />
        <StatsCard
          title="Trees Equivalent"
          value={s.total_records > 0 ? s.total_co2_saved_kg / 22 : 0}
          decimals={1}
          icon={<TreePine className="h-6 w-6" />}
          color="#16a34a"
          index={6}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WasteDistributionChart data={s.waste_type_distribution} />
        <EnergyMethodChart data={s.method_distribution} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentRecords records={records} />
        </div>
        <SustainabilityScore
          co2Saved={s.total_co2_saved_kg}
          waterSaved={s.total_water_saved_liters}
          totalRecords={s.total_records}
        />
      </div>
    </div>
  );
}
