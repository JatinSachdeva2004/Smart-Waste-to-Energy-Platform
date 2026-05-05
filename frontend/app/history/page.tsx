"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getRecords,
  deleteRecord,
  getImageUrl,
  generateReport,
  getDownloadUrl,
} from "@/lib/api";
import { useRefresh } from "@/lib/refresh-context";
import type { WasteRecord } from "@/lib/types";
import { WASTE_COLORS, WASTE_ICONS } from "@/lib/types";
import { formatNumber, wasteTypeLabel, cn } from "@/lib/utils";
import {
  Clock,
  Trash2,
  Search,
  Zap,
  Leaf,
  Weight,
  ChevronDown,
  ChevronUp,
  FileDown,
  ImageIcon,
} from "lucide-react";

export default function HistoryPage() {
  const [records, setRecords] = React.useState<WasteRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState<number | null>(null);
  const { refreshKey } = useRefresh();

  React.useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const data = await getRecords(200, 0);
        setRecords(data);
      } catch {}
      setLoading(false);
    })();
  }, [refreshKey]);

  const filtered = records.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.waste_type.toLowerCase().includes(s) ||
      r.waste_subtype?.toLowerCase().includes(s) ||
      r.created_at?.toLowerCase().includes(s)
    );
  });

  // Group records by date
  const grouped = React.useMemo(() => {
    const map = new Map<string, WasteRecord[]>();
    filtered.forEach((r) => {
      const dateKey = new Date(r.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(r);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {}
    setDeletingId(null);
  };

  const handleExport = async (id: number) => {
    setExporting(id);
    try {
      const res = await generateReport();
      if (res.report_id) {
        window.open(getDownloadUrl(res.report_id), "_blank");
      }
    } catch {}
    setExporting(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            History
          </h2>
          <p className="text-sm text-muted-foreground">
            {records.length} analysis record{records.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by type, subtype, date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No records found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, recs], gi) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
            >
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {date}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="outline" className="text-[10px]">
                  {recs.length}
                </Badge>
              </div>

              {/* Records */}
              <div className="ml-1 border-l-2 border-border pl-5 space-y-3">
                {recs.map((record) => {
                  const expanded = expandedId === record.id;
                  const icon =
                    WASTE_ICONS[
                      record.waste_type as keyof typeof WASTE_ICONS
                    ] || "♻️";
                  const color =
                    WASTE_COLORS[
                      record.waste_type as keyof typeof WASTE_COLORS
                    ] || "#94a3b8";

                  return (
                    <motion.div key={record.id} layout>
                      <Card
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          expanded && "ring-1 ring-primary/20",
                        )}
                        onClick={() =>
                          setExpandedId(expanded ? null : record.id)
                        }
                      >
                        <CardContent className="p-4">
                          {/* Main row */}
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                              style={{ background: color + "20" }}
                            >
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm capitalize truncate">
                                  {wasteTypeLabel(record.waste_type)}
                                </p>
                                {record.waste_subtype && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] capitalize"
                                  >
                                    {record.waste_subtype}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(record.created_at).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                                {" • "}
                                Conf: {Math.round(record.confidence * 100)}%
                              </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Weight className="h-3 w-3" />
                                {formatNumber(record.estimated_mass_kg, 3)} kg
                              </span>
                              <span className="flex items-center gap-1 text-primary">
                                <Zap className="h-3 w-3" />
                                {formatNumber(record.best_energy_kwh, 2)} kWh
                              </span>
                              <span className="flex items-center gap-1 text-green-500">
                                <Leaf className="h-3 w-3" />
                                {formatNumber(record.co2_saved_kg, 3)} kg
                              </span>
                            </div>
                            {expanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-border">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                      <p className="text-[10px] text-muted-foreground">
                                        Mass
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {formatNumber(
                                          record.estimated_mass_kg,
                                          4,
                                        )}{" "}
                                        kg
                                      </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                      <p className="text-[10px] text-muted-foreground">
                                        Energy
                                      </p>
                                      <p className="text-sm font-semibold text-primary">
                                        {formatNumber(
                                          record.best_energy_kwh,
                                          3,
                                        )}{" "}
                                        kWh
                                      </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                      <p className="text-[10px] text-muted-foreground">
                                        CO₂ Saved
                                      </p>
                                      <p className="text-sm font-semibold text-green-500">
                                        {formatNumber(record.co2_saved_kg, 4)}{" "}
                                        kg
                                      </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                      <p className="text-[10px] text-muted-foreground">
                                        Confidence
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {Math.round(record.confidence * 100)}%
                                      </p>
                                    </div>
                                  </div>

                                  {record.best_method && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Best method:{" "}
                                      <span className="capitalize font-medium text-foreground">
                                        {record.best_method.replace("_", " ")}
                                      </span>
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 mt-3">
                                    {record.image_path && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(
                                            getImageUrl(record.image_path!),
                                            "_blank",
                                          );
                                        }}
                                      >
                                        <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                                        View Image
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExport(record.id);
                                      }}
                                      disabled={exporting === record.id}
                                    >
                                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                                      {exporting === record.id
                                        ? "Generating..."
                                        : "PDF Report"}
                                    </Button>
                                    <div className="flex-1" />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(record.id);
                                      }}
                                      disabled={deletingId === record.id}
                                    >
                                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                      {deletingId === record.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
