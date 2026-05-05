"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getWhatIfScenario } from "@/lib/api";
import type { WhatIfScenario } from "@/lib/types";
import { WASTE_COLORS, WASTE_ICONS } from "@/lib/types";
import { wasteTypeLabel } from "@/lib/utils";
import { useRefresh } from "@/lib/refresh-context";
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Leaf,
  Zap,
  Droplets,
  Wind,
  Flame,
  Scan,
  Send,
  History,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Trophy,
  X,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────

const WASTE_TYPES = [
  "plastic","paper","metal","glass","organic",
  "ewaste","textile","wood","rubber","medical",
  "composite","ceramic","general_waste",
];

const METHODS = [
  "Incineration","Pyrolysis","Gasification","Biogas","Plasma Arc","Recycling",
];

const METHOD_COLORS: Record<string, string> = {
  Incineration: "#ef4444",
  Pyrolysis:    "#f59e0b",
  Gasification: "#3b82f6",
  Biogas:       "#22c55e",
  "Plasma Arc": "#8b5cf6",
  Recycling:    "#06b6d4",
};

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: 12,
};

// ── Question parser ────────────────────────────────────

interface ParsedParams {
  wasteType?: string;
  massKg?: number;
  method?: string;
  recyclingRate?: number;
  mode?: "compare";
}

function parseQuestion(
  q: string,
  base: { wasteType: string; massKg: number; method: string; recyclingRate: number },
): ParsedParams | null {
  const s = q.toLowerCase().trim();
  if (!s) return null;

  // "compare all" / "best method" / "all methods"
  if (/best method|compare|all method|which method|optimal/.test(s)) {
    return { mode: "compare" };
  }

  // "X kg" — set absolute mass
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return { massKg: parseFloat(kgMatch[1]) };

  // "X tonnes" / "X ton"
  const tonMatch = s.match(/(\d+(?:\.\d+)?)\s*tonn?e?s?/);
  if (tonMatch) return { massKg: parseFloat(tonMatch[1]) * 1000 };

  // "X times" / "Xx" — scale current mass
  const timesMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:x\b|times|×)/);
  if (timesMatch) return { massKg: base.massKg * parseFloat(timesMatch[1]) };

  // "X of these" / "X bottles" / "X items" / "X pieces"
  const countMatch = s.match(/(\d+)\s*(?:of these|items?|pieces?|bottles?|cans?|bags?|boxes?|units?)/);
  if (countMatch) return { massKg: base.massKg * parseInt(countMatch[1]) };

  // "X% recycled" / "recycle X%"
  const recycleMatch = s.match(/(\d+)\s*%\s*recycle|recycle\s+(\d+)\s*%/);
  if (recycleMatch) {
    const pct = parseInt(recycleMatch[1] ?? recycleMatch[2]);
    return { recyclingRate: pct };
  }

  // "fully recycled" / "100 percent recycled" / "completely recycled"
  if (/fully recycle|100\s*%?\s*recycle|completely recycle|all recycle/.test(s)) {
    return { recyclingRate: 100 };
  }

  // "no recycling" / "zero recycling" / "without recycling"
  if (/no recycle|zero recycle|without recycle/.test(s)) {
    return { recyclingRate: 0 };
  }

  // Method names
  for (const m of METHODS) {
    if (s.includes(m.toLowerCase())) return { method: m };
  }

  // Waste type names
  for (const t of WASTE_TYPES) {
    if (s.includes(t.replace("_", " "))) return { wasteType: t };
  }

  return null;
}

// ── Scenario log item ──────────────────────────────────

interface LogEntry {
  id: number;
  label: string;
  params: { wasteType: string; massKg: number; method: string; recyclingRate: number };
  result: WhatIfScenario;
}

// ── Component ─────────────────────────────────────────

export default function WhatIfPage() {
  const { lastScan } = useRefresh();

  const [wasteType, setWasteType] = React.useState("plastic");
  const [massKg, setMassKg]       = React.useState(10);
  const [method, setMethod]       = React.useState("Incineration");
  const [recyclingRate, setRecyclingRate] = React.useState(0);

  const [result, setResult]   = React.useState<WhatIfScenario | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Compare-all-methods mode
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareResults, setCompareResults] = React.useState<Record<string, WhatIfScenario | null>>({});
  const [compareLoading, setCompareLoading] = React.useState(false);

  // Question input
  const [question, setQuestion]   = React.useState("");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = React.useState<string | null>(null);

  // Scenario log
  const [log, setLog]           = React.useState<LogEntry[]>([]);
  const [logOpen, setLogOpen]   = React.useState(false);
  const logIdRef                = React.useRef(0);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  // ── Auto-load from last scan ───────────────────────
  const loadedFromScan = React.useRef(false);
  React.useEffect(() => {
    if (lastScan && !loadedFromScan.current) {
      setWasteType(lastScan.waste_type);
      setMassKg(parseFloat(lastScan.totals.mass_kg.toFixed(3)));
      loadedFromScan.current = true;
    }
  }, [lastScan]);

  // ── Scenario runner ────────────────────────────────
  const runScenario = React.useCallback(
    (wt = wasteType, m = massKg, meth = method, rr = recyclingRate) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setCompareMode(false);
        try {
          const r = await getWhatIfScenario(wt, m, meth, rr / 100);
          setResult(r);
          const entry: LogEntry = {
            id: ++logIdRef.current,
            label: `${WASTE_ICONS[wt] ?? "♻️"} ${wasteTypeLabel(wt)} · ${m.toFixed(2)} kg · ${meth}${rr > 0 ? ` · ${rr}% recycled` : ""}`,
            params: { wasteType: wt, massKg: m, method: meth, recyclingRate: rr },
            result: r,
          };
          setLog((prev) => [entry, ...prev].slice(0, 8));
        } catch {
          // silently handle
        } finally {
          setLoading(false);
        }
      }, 400);
    },
    [wasteType, massKg, method, recyclingRate],
  );

  // ── Compare all methods ────────────────────────────
  const runCompare = React.useCallback(async () => {
    setCompareMode(true);
    setCompareLoading(true);
    setResult(null);
    try {
      const pairs = await Promise.all(
        METHODS.map((m) =>
          getWhatIfScenario(wasteType, massKg, m, recyclingRate / 100)
            .then((r) => [m, r] as [string, WhatIfScenario])
            .catch(() => [m, null] as [string, null]),
        ),
      );
      setCompareResults(Object.fromEntries(pairs));
    } finally {
      setCompareLoading(false);
    }
  }, [wasteType, massKg, recyclingRate]);

  // ── Question handler ───────────────────────────────
  const handleQuestion = (q: string) => {
    setParseError(null);
    setParseSuccess(null);
    const parsed = parseQuestion(q, { wasteType, massKg, method, recyclingRate });
    if (!parsed) {
      setParseError(`Couldn't understand "${q}" — try: "20 kg", "5x", "80% recycled", "Pyrolysis", "compare all methods"`);
      return;
    }
    if (parsed.mode === "compare") {
      setParseSuccess("Comparing all 6 methods…");
      setQuestion("");
      runCompare();
      return;
    }
    const newWt   = parsed.wasteType    ?? wasteType;
    const newM    = parsed.massKg       ?? massKg;
    const newMeth = parsed.method       ?? method;
    const newRr   = parsed.recyclingRate ?? recyclingRate;

    const parts: string[] = [];
    if (parsed.wasteType)     parts.push(`waste type → ${wasteTypeLabel(newWt)}`);
    if (parsed.massKg)        parts.push(`mass → ${newM.toFixed(2)} kg`);
    if (parsed.method)        parts.push(`method → ${newMeth}`);
    if (parsed.recyclingRate !== undefined) parts.push(`recycling → ${newRr}%`);
    setParseSuccess(`Applied: ${parts.join(", ")}`);

    setWasteType(newWt);
    setMassKg(newM);
    setMethod(newMeth);
    setRecyclingRate(newRr);
    setQuestion("");
    runScenario(newWt, newM, newMeth, newRr);
  };

  // ── Derived values ────────────────────────────────
  const color        = WASTE_COLORS[wasteType] ?? "#9ca3af";
  const energy       = result?.recovery.energy as Record<string, unknown> | undefined;
  const bestEnergyKwh = typeof energy?.best_energy_kwh === "number" ? energy.best_energy_kwh : 0;
  const env          = result?.recovery.environmental ?? {};
  const co2Diff      = result?.landfill_comparison.co2_difference_kg ?? 0;
  const co2Emitted   = result?.landfill_comparison.co2_emitted_kg ?? 0;
  const totalComp    = co2Emitted + co2Diff;
  const recoveryPct  = totalComp > 0 ? (co2Diff / totalComp) * 100 : 50;
  const carbonCreditLost = (co2Diff / 1000) * 1200;

  // Compare chart data
  const compareChartData = METHODS.map((m) => {
    const r = compareResults[m];
    const e = r?.recovery.energy as Record<string, unknown> | undefined;
    return {
      method: m,
      energy: typeof e?.best_energy_kwh === "number" ? e.best_energy_kwh : 0,
      co2:    r?.recovery.environmental?.co2_saved_kg ?? 0,
      credit: r?.carbon_credit_value_inr ?? 0,
    };
  }).filter((d) => d.energy > 0);

  const bestMethodEntry = compareChartData.reduce(
    (best, cur) => (cur.energy > best.energy ? cur : best),
    compareChartData[0] ?? { method: "", energy: 0, co2: 0, credit: 0 },
  );

  // ── Quick chips ───────────────────────────────────
  const quickChips = [
    { label: "10× scale", icon: "🔢", q: "10x" },
    { label: "1 tonne",   icon: "🏭", q: "1 tonne" },
    { label: "100% recycled", icon: "♻️", q: "fully recycled" },
    { label: "0% recycled",   icon: "🗑️", q: "no recycling" },
    { label: "Best method?",  icon: "🏆", q: "compare all methods" },
    { label: "Biogas",    icon: "💧", q: "Biogas" },
    { label: "Plasma Arc", icon: "⚡", q: "Plasma Arc" },
    { label: "Pyrolysis",  icon: "🔥", q: "Pyrolysis" },
  ];

  // ── Render ────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          What-If Lab
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask any question about your waste — compare scenarios, methods, and scales
        </p>
      </motion.div>

      {/* Scan banner */}
      <AnimatePresence>
        {lastScan && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex flex-wrap items-center gap-3">
                <Scan className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Loaded from your scan:{" "}
                    <span className="text-primary">
                      {WASTE_ICONS[lastScan.waste_type] ?? "♻️"}{" "}
                      {wasteTypeLabel(lastScan.waste_type)} ·{" "}
                      {lastScan.totals.mass_kg.toFixed(3)} kg
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {(lastScan.confidence * 100).toFixed(0)}% · Best method:{" "}
                    {lastScan.energy.best_method} · {lastScan.objects_count} object(s) detected
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWasteType(lastScan.waste_type);
                    setMassKg(parseFloat(lastScan.totals.mass_kg.toFixed(3)));
                    runScenario(lastScan.waste_type, lastScan.totals.mass_kg, method, recyclingRate);
                    setParseSuccess("Loaded scan data into simulator");
                  }}
                >
                  Use This Data
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question input + quick chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="space-y-3"
      >
        {/* Text input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder='Ask anything: "20 kg", "5x more", "80% recycled", "compare all methods", "10 bottles"…'
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setParseError(null);
                setParseSuccess(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && question.trim()) handleQuestion(question);
              }}
              className="pr-4"
            />
          </div>
          <Button
            variant="glow"
            onClick={() => question.trim() && handleQuestion(question)}
            disabled={!question.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Parse feedback */}
        <AnimatePresence>
          {parseError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-destructive flex items-center gap-1.5"
            >
              <X className="h-3 w-3" /> {parseError}
            </motion.p>
          )}
          {parseSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5"
            >
              <CheckCircle className="h-3 w-3" /> {parseSuccess}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Quick chips */}
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleQuestion(chip.q)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Left — input panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:sticky lg:top-6 space-y-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-primary" />
                Parameters
              </CardTitle>
              <CardDescription>Manual controls — or just ask above</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Waste type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Waste Type</label>
                <div className="flex items-center gap-2">
                  <span
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    {WASTE_ICONS[wasteType] ?? "♻️"}
                  </span>
                  <Select
                    className="flex-1"
                    value={wasteType}
                    onChange={(e) => {
                      setWasteType(e.target.value);
                      runScenario(e.target.value, massKg, method, recyclingRate);
                    }}
                    options={WASTE_TYPES.map((t) => ({
                      value: t,
                      label: `${WASTE_ICONS[t] ?? "♻️"} ${wasteTypeLabel(t)}`,
                    }))}
                  />
                </div>
              </div>

              {/* Mass */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Mass</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0.001"
                      max="100000"
                      step="0.1"
                      value={massKg}
                      onChange={(e) => {
                        const v = Math.max(0.001, parseFloat(e.target.value) || 0.001);
                        setMassKg(v);
                        runScenario(wasteType, v, method, recyclingRate);
                      }}
                      className="w-24 h-8 text-sm text-right"
                    />
                    <span className="text-sm text-muted-foreground">kg</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={Math.min(massKg, 100)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setMassKg(v);
                    runScenario(wasteType, v, method, recyclingRate);
                  }}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.1 kg</span>
                  <span>100 kg</span>
                </div>
              </div>

              {/* Method */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Processing Method</label>
                <Select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value);
                    runScenario(wasteType, massKg, e.target.value, recyclingRate);
                  }}
                  options={METHODS.map((m) => ({
                    value: m,
                    label: `${m}`,
                  }))}
                />
                <div className="flex gap-1 flex-wrap">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMethod(m);
                        runScenario(wasteType, massKg, m, recyclingRate);
                      }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all"
                      style={{
                        backgroundColor: method === m ? `${METHOD_COLORS[m]}20` : "transparent",
                        borderColor: method === m ? METHOD_COLORS[m] : "hsl(var(--border))",
                        color: method === m ? METHOD_COLORS[m] : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recycling rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Recycling Rate</label>
                  <span className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>
                    {recyclingRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={recyclingRate}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setRecyclingRate(v);
                    runScenario(wasteType, massKg, method, v);
                  }}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0% (all processed)</span>
                  <span>100% (all recycled)</span>
                </div>
              </div>

              {/* Compare all button */}
              <Button
                variant="outline"
                className="w-full border-primary/30 hover:border-primary hover:bg-primary/5"
                onClick={runCompare}
                disabled={compareLoading}
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                {compareLoading ? "Comparing…" : "Compare All 6 Methods"}
              </Button>
            </CardContent>
          </Card>

          {/* Scenario log */}
          {log.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between p-4 text-sm font-medium"
                  onClick={() => setLogOpen((o) => !o)}
                >
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Session Log ({log.length})
                  </span>
                  {logOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {logOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 border-t">
                        {log.map((entry) => (
                          <button
                            key={entry.id}
                            className="w-full text-left rounded-lg p-2.5 text-xs bg-muted/50 hover:bg-muted transition-colors"
                            onClick={() => {
                              setWasteType(entry.params.wasteType);
                              setMassKg(entry.params.massKg);
                              setMethod(entry.params.method);
                              setRecyclingRate(entry.params.recyclingRate);
                              setResult(entry.result);
                              setCompareMode(false);
                              setParseSuccess(`Restored: ${entry.label}`);
                            }}
                          >
                            <p className="font-medium truncate">{entry.label}</p>
                            <p className="text-muted-foreground mt-0.5">
                              ⚡ {(entry.result.recovery.energy as Record<string, unknown>)?.best_energy_kwh?.toLocaleString() ?? "—"} kWh ·
                              ₹{entry.result.carbon_credit_value_inr.toFixed(2)} credit value
                            </p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Right — results */}
        <div className="space-y-4 min-h-96">
          <AnimatePresence mode="wait">
            {/* Compare all methods */}
            {compareMode ? (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {compareLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Best method callout */}
                    {bestMethodEntry.method && (
                      <Card className="border-yellow-500/30 bg-yellow-500/5">
                        <CardContent className="p-4 flex items-center gap-3">
                          <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">
                              Best method for {wasteTypeLabel(wasteType)}:{" "}
                              <span style={{ color: METHOD_COLORS[bestMethodEntry.method] }}>
                                {bestMethodEntry.method}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bestMethodEntry.energy.toFixed(4)} kWh energy ·
                              ₹{bestMethodEntry.credit.toFixed(2)} carbon credit value
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto flex-shrink-0"
                            onClick={() => {
                              setMethod(bestMethodEntry.method);
                              setCompareMode(false);
                              runScenario(wasteType, massKg, bestMethodEntry.method, recyclingRate);
                            }}
                          >
                            Use This
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Energy comparison chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Energy Output by Method</CardTitle>
                        <CardDescription>
                          {massKg.toFixed(2)} kg of {wasteTypeLabel(wasteType)} · {recyclingRate}% recycled
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={compareChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="method" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" kWh" />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(4)} kWh`, "Energy"]} />
                            <Bar dataKey="energy" radius={[4, 4, 0, 0]} name="Energy (kWh)">
                              {compareChartData.map((entry) => (
                                <Cell
                                  key={entry.method}
                                  fill={METHOD_COLORS[entry.method] ?? "#9ca3af"}
                                  opacity={entry.method === bestMethodEntry.method ? 1 : 0.6}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Per-method cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {METHODS.map((m) => {
                        const r = compareResults[m];
                        if (!r) return null;
                        const e = r.recovery.energy as Record<string, unknown>;
                        const kwh = typeof e?.best_energy_kwh === "number" ? e.best_energy_kwh : 0;
                        const co2 = r.recovery.environmental?.co2_saved_kg ?? 0;
                        const isBest = m === bestMethodEntry.method;
                        const mc = METHOD_COLORS[m] ?? "#9ca3af";
                        return (
                          <motion.div
                            key={m}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: METHODS.indexOf(m) * 0.05 }}
                          >
                            <Card
                              className={`relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${isBest ? "ring-2 ring-yellow-500/40" : ""}`}
                              onClick={() => {
                                setMethod(m);
                                setCompareMode(false);
                                runScenario(wasteType, massKg, m, recyclingRate);
                              }}
                            >
                              <div
                                className="absolute inset-0"
                                style={{ background: `radial-gradient(circle at top right, ${mc}12, transparent 70%)` }}
                              />
                              <CardContent className="p-4 relative">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold" style={{ color: mc }}>{m}</span>
                                  {isBest && <Badge variant="warning" className="text-[10px]">Best ⚡</Badge>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-muted-foreground">Energy</p>
                                    <p className="font-semibold">{kwh.toFixed(4)} kWh</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">CO₂ Saved</p>
                                    <p className="font-semibold text-green-600 dark:text-green-400">{co2.toFixed(4)} kg</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Credit Value</p>
                                    <p className="font-semibold">₹{r.carbon_credit_value_inr.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Effective Mass</p>
                                    <p className="font-semibold">{r.scenario.effective_mass_kg.toFixed(3)} kg</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </motion.div>
            ) : !result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-80 gap-4 text-muted-foreground">
                    <FlaskConical className="w-16 h-16 opacity-20" />
                    <p className="text-lg font-medium">Ask a question to start</p>
                    <p className="text-sm text-center max-w-xs">
                      Try "20 kg", "5x more", "80% recycled", or hit a quick chip above.
                      Upload a scan first to auto-load your waste data.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* Scenario summary */}
                <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow duration-300">
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle at top right, ${color}15, transparent 70%)` }}
                  />
                  <CardContent className="p-6 relative">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Active Scenario</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xl">{WASTE_ICONS[result.scenario.waste_type] ?? "♻️"}</span>
                          <span className="text-xl font-bold">{wasteTypeLabel(result.scenario.waste_type)}</span>
                          <Badge style={{ backgroundColor: `${METHOD_COLORS[result.scenario.method]}20`, color: METHOD_COLORS[result.scenario.method], borderColor: `${METHOD_COLORS[result.scenario.method]}40` }}>
                            {result.scenario.method}
                          </Badge>
                          {result.scenario.recycling_rate > 0 && (
                            <Badge variant="success">{(result.scenario.recycling_rate * 100).toFixed(0)}% recycled</Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Input</p>
                          <p className="font-bold">{result.scenario.mass_kg.toFixed(3)} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Processed</p>
                          <p className="font-bold">{result.scenario.effective_mass_kg.toFixed(3)} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Recycled</p>
                          <p className="font-bold">{(result.scenario.mass_kg * result.scenario.recycling_rate).toFixed(3)} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Credit Value</p>
                          <p className="font-bold text-green-600 dark:text-green-400">₹{result.carbon_credit_value_inr.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recovery vs Landfill */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Recovery vs Landfill</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
                      <div className="p-5 bg-green-500/5">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-semibold text-sm text-green-600 dark:text-green-400">Energy Recovery</span>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            { icon: <Leaf className="h-3.5 w-3.5" />, label: "CO₂ Saved", value: `${((env.co2_saved_kg as number) ?? 0).toFixed(4)} kg` },
                            { icon: <Wind className="h-3.5 w-3.5" />, label: "Methane Saved", value: `${((env.methane_saved_kg as number) ?? 0).toFixed(4)} kg` },
                            { icon: <Droplets className="h-3.5 w-3.5" />, label: "Water Saved", value: `${((env.water_saved_liters as number) ?? 0).toFixed(2)} L` },
                            { icon: <Zap className="h-3.5 w-3.5" />, label: "Energy", value: `${bestEnergyKwh.toFixed(4)} kWh` },
                            { icon: <span className="text-[10px] font-bold">₹</span>, label: "Carbon Credit", value: `₹${result.carbon_credit_value_inr.toFixed(2)}` },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                {item.icon}
                                <span className="text-foreground">{item.label}</span>
                              </div>
                              <span className="font-semibold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-5 bg-red-500/5">
                        <div className="flex items-center gap-2 mb-3">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="font-semibold text-sm text-red-600 dark:text-red-400">If Landfilled</span>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            { icon: <Flame className="h-3.5 w-3.5" />, label: "CO₂ Emitted", value: `${result.landfill_comparison.co2_emitted_kg.toFixed(4)} kg` },
                            { icon: <Wind className="h-3.5 w-3.5" />, label: "Methane Emitted", value: `${result.landfill_comparison.methane_emitted_kg.toFixed(4)} kg` },
                            { icon: <Zap className="h-3.5 w-3.5" />, label: "Energy Wasted", value: `${result.landfill_comparison.energy_wasted_kwh.toFixed(4)} kWh` },
                            { icon: <span className="text-[10px] font-bold">₹</span>, label: "Credits Lost", value: `₹${carbonCreditLost.toFixed(2)}` },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-red-500">
                                {item.icon}
                                <span className="text-foreground">{item.label}</span>
                              </div>
                              <span className="font-semibold text-red-600 dark:text-red-400">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Impact meter */}
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold mb-0.5">CO₂ Impact Comparison</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Recovery saves{" "}
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {co2Diff.toFixed(4)} kg CO₂
                      </span>{" "}
                      vs landfill
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">Recovery</span>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden flex">
                        <motion.div
                          className="h-full bg-green-500"
                          style={{ borderRadius: "9999px 0 0 9999px" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${recoveryPct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                        <motion.div
                          className="h-full bg-red-500"
                          style={{ borderRadius: "0 9999px 9999px 0" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${100 - recoveryPct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Landfill</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="w-16 text-right" />
                      <div className="flex-1 flex justify-between text-xs">
                        <span className="font-medium text-green-600 dark:text-green-400">{recoveryPct.toFixed(0)}% better</span>
                        <span className="font-medium text-red-500">{(100 - recoveryPct).toFixed(0)}% worse</span>
                      </div>
                      <span className="w-16" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
