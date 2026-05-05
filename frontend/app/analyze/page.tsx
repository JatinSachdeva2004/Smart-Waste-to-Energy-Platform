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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/input";
import { UploadZone } from "@/components/analyze/upload-zone";
import { AIProcessingAnimation } from "@/components/analyze/ai-processing";
import { DetectionOverlay } from "@/components/analyze/detection-overlay";
import { DetectionResults } from "@/components/analyze/detection-results";
import { EnergyBreakdown } from "@/components/analyze/energy-breakdown";
import { EnvironmentalImpact } from "@/components/analyze/environmental-impact";
import { RecommendationCard } from "@/components/analyze/recommendation-card";
import { uploadImage, getImageUrl, getSubtypes } from "@/lib/api";
import { useRefresh } from "@/lib/refresh-context";
import type { UploadResponse } from "@/lib/types";
import { WASTE_ICONS } from "@/lib/types";
import {
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatNumber, wasteTypeLabel } from "@/lib/utils";

type AnalysisState = "idle" | "processing" | "done" | "error";

const WASTE_TYPE_OPTIONS = [
  { value: "", label: "Auto-detect (default)" },
  { value: "plastic", label: "🧴 Plastic" },
  { value: "paper", label: "📦 Paper / Cardboard" },
  { value: "metal", label: "🔩 Metal" },
  { value: "glass", label: "🍶 Glass" },
  { value: "organic", label: "🍌 Organic" },
  { value: "ewaste", label: "📱 E-Waste" },
  { value: "textile", label: "👕 Textile" },
  { value: "wood", label: "🪵 Wood" },
  { value: "rubber", label: "🛞 Rubber" },
  { value: "medical", label: "💉 Medical Waste" },
  { value: "composite", label: "🔗 Composite" },
  { value: "ceramic", label: "🏺 Ceramic" },
  { value: "general_waste", label: "🗑️ General Waste" },
];

const REF_OBJECT_OPTIONS = [
  { value: "", label: "None (no reference object in image)" },
  { value: "coin_inr", label: "₹1 / ₹2 Coin (2.5 cm)" },
  { value: "coin_usd", label: "US Quarter (2.4 cm)" },
  { value: "credit_card", label: "Credit / ID Card (8.6 × 5.4 cm)" },
  { value: "a4_paper", label: "A4 Paper Sheet (21 × 29.7 cm)" },
];

export default function AnalyzePage() {
  const [state, setState] = React.useState<AnalysisState>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<UploadResponse | null>(null);
  const [stage, setStage] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  // Basic option
  const [contamination, setContamination] = React.useState("light");

  // Advanced options
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [userWasteType, setUserWasteType] = React.useState("");
  const [userSubtype, setUserSubtype] = React.useState("");
  const [manualWeight, setManualWeight] = React.useState("");
  const [refType, setRefType] = React.useState("");
  const [moisturePct, setMoisturePct] = React.useState("");
  const [availableSubtypes, setAvailableSubtypes] = React.useState<
    { value: string; label: string }[]
  >([]);

  const { triggerRefresh, setScanResult } = useRefresh();

  // Per-object drill-down
  const [selectedObjIdx, setSelectedObjIdx] = React.useState(0);

  // Fetch subtypes dynamically when waste type override changes
  React.useEffect(() => {
    if (!userWasteType) {
      setAvailableSubtypes([]);
      setUserSubtype("");
      return;
    }
    getSubtypes(userWasteType)
      .then((data) => {
        const opts = Object.entries(data.subtypes || {}).map(([k, v]) => ({
          value: k,
          label: v as string,
        }));
        setAvailableSubtypes(opts);
        setUserSubtype("");
      })
      .catch(() => setAvailableSubtypes([]));
  }, [userWasteType]);

  // Reset selected object when a new result arrives
  React.useEffect(() => {
    setSelectedObjIdx(0);
  }, [result]);

  const selectedObj =
    result?.objects?.[selectedObjIdx] ?? result?.objects?.[0];

  const handleFileSelect = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setState("idle");
    setError(null);
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setState("idle");
    setError(null);
    setStage(0);
    setSelectedObjIdx(0);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setState("processing");
    setStage(0);
    setError(null);

    const stageTimers = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 2000),
      setTimeout(() => setStage(3), 3200),
    ];

    try {
      const res = await uploadImage(file, {
        contamination,
        userWasteType: userWasteType || undefined,
        userSubtype: userSubtype || undefined,
        manualWeight: manualWeight ? parseFloat(manualWeight) : undefined,
        refType: refType || undefined,
        moisturePct: moisturePct ? parseFloat(moisturePct) : undefined,
      });
      stageTimers.forEach(clearTimeout);
      if (res.error) {
        setError(res.error);
        setState("error");
      } else {
        setResult(res);
        setState("done");
        triggerRefresh();
        setScanResult(res);
      }
    } catch (err: any) {
      stageTimers.forEach(clearTimeout);
      setError(err.message || "Analysis failed");
      setState("error");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analyze Waste</h2>
          <p className="text-sm text-muted-foreground">
            Upload a waste image for AI-powered detection and energy analysis
          </p>
        </div>
        {state === "done" && (
          <Button variant="outline" onClick={handleClear}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New Analysis
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — Image + Charts */}
        <div className="lg:col-span-3 space-y-4">
          {/* Upload / Detection overlay */}
          {state === "done" && result ? (
            <DetectionOverlay
              imageUrl={getImageUrl(result.images.original)}
              detections={result.objects}
              selectedIndex={selectedObjIdx}
              onSelect={setSelectedObjIdx}
            />
          ) : (
            <UploadZone
              onFileSelect={handleFileSelect}
              disabled={state === "processing"}
              preview={preview}
              onClear={handleClear}
            />
          )}

          {/* AI Processing Animation */}
          <AnimatePresence>
            {state === "processing" && (
              <AIProcessingAnimation stage={stage} active />
            )}
          </AnimatePresence>

          {/* Scan line overlay */}
          {state === "processing" && preview && (
            <div className="relative -mt-[340px] h-80 pointer-events-none">
              <div className="scan-line" />
            </div>
          )}

          {/* Error */}
          {state === "error" && error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="text-sm text-destructive">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleAnalyze}
              >
                Try Again
              </Button>
            </motion.div>
          )}

          {/* Object selector pills — shown only for multi-object results */}
          {state === "done" && result && result.objects_count > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">
                      Viewing data for:
                    </span>
                    {result.objects.map((obj, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedObjIdx(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          selectedObjIdx === i
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <span>{WASTE_ICONS[obj.waste_type] || "🗑️"}</span>
                        <span>
                          #{i + 1} {wasteTypeLabel(obj.waste_type)}
                        </span>
                        <span className="opacity-60">
                          {(obj.confidence * 100).toFixed(0)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Energy Breakdown — per selected object */}
          {state === "done" && selectedObj && (
            <div>
              {result && result.objects_count > 1 && (
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <span>{WASTE_ICONS[selectedObj.waste_type] || "🗑️"}</span>
                  Object #{selectedObjIdx + 1} —{" "}
                  {wasteTypeLabel(selectedObj.waste_type)} ·{" "}
                  {formatNumber(selectedObj.mass_kg, 3)} kg
                </p>
              )}
              <EnergyBreakdown energy={selectedObj.energy} />
            </div>
          )}

          {/* Environmental Impact — per selected object */}
          {state === "done" && selectedObj && (
            <EnvironmentalImpact data={selectedObj.environmental} />
          )}
        </div>

        {/* Right column — Controls & Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Analysis Controls */}
          {state !== "done" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  Analysis Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contamination level */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Contamination Level
                  </label>
                  <Select
                    value={contamination}
                    onChange={(e) => setContamination(e.target.value)}
                    options={[
                      { value: "clean", label: "Clean" },
                      { value: "light", label: "Light Contamination" },
                      { value: "medium", label: "Moderate" },
                      { value: "heavy", label: "Heavy" },
                    ]}
                  />
                </div>

                {/* Advanced options toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {showAdvanced
                    ? "Hide advanced options"
                    : "Show advanced options"}
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {/* Waste type override */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Waste Type Override
                        </label>
                        <Select
                          value={userWasteType}
                          onChange={(e) => setUserWasteType(e.target.value)}
                          options={WASTE_TYPE_OPTIONS}
                        />
                      </div>

                      {/* Subtype — dynamic, only shown when type is selected */}
                      {availableSubtypes.length > 0 && (
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">
                            Sub-type
                          </label>
                          <Select
                            value={userSubtype}
                            onChange={(e) => setUserSubtype(e.target.value)}
                            options={[
                              { value: "", label: "Auto-detect" },
                              ...availableSubtypes,
                            ]}
                          />
                        </div>
                      )}

                      {/* Manual weight */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Manual Weight (kg)
                          <span className="ml-1 text-xs text-muted-foreground font-normal">
                            — single object only
                          </span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="e.g. 0.250"
                          value={manualWeight}
                          onChange={(e) => setManualWeight(e.target.value)}
                        />
                      </div>

                      {/* Reference object */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Reference Object in Image
                          <span className="ml-1 text-xs text-muted-foreground font-normal">
                            — improves size accuracy
                          </span>
                        </label>
                        <Select
                          value={refType}
                          onChange={(e) => setRefType(e.target.value)}
                          options={REF_OBJECT_OPTIONS}
                        />
                      </div>

                      {/* Moisture */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Moisture Content (%)
                          <span className="ml-1 text-xs text-muted-foreground font-normal">
                            — affects energy yield
                          </span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="e.g. 60 for wet organics"
                          value={moisturePct}
                          onChange={(e) => setMoisturePct(e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  variant="glow"
                  className="w-full"
                  size="lg"
                  disabled={!file || state === "processing"}
                  onClick={handleAnalyze}
                >
                  {state === "processing" ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="mr-2"
                      >
                        <Sparkles className="h-4 w-4" />
                      </motion.div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Summary Card — shows totals across all objects */}
          {state === "done" && result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base">Analysis Summary</CardTitle>
                  <CardDescription>
                    {result.objects_count} object(s) detected
                    {result.objects_count > 1 && (
                      <span className="ml-1 text-xs">
                        · click a card below to drill into each object
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Total Mass
                      </p>
                      <p className="text-xl font-bold">
                        {formatNumber(result.totals.mass_kg, 3)}
                      </p>
                      <p className="text-xs text-muted-foreground">kg</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Energy Potential
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {formatNumber(result.totals.energy_kwh, 3)}
                      </p>
                      <p className="text-xs text-muted-foreground">kWh</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-green-500/5 border border-green-500/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">CO₂ Reduced</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatNumber(result.totals.co2_saved_kg, 3)}
                    </p>
                    <p className="text-xs text-muted-foreground">kg CO₂</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Detection Results — clickable, drives per-object views */}
          {state === "done" && result && (
            <DetectionResults
              detections={result.objects}
              selectedIndex={selectedObjIdx}
              onSelect={setSelectedObjIdx}
            />
          )}

          {/* Recommendation — per selected object */}
          {state === "done" && selectedObj && (
            <RecommendationCard recommendation={selectedObj.recommendation} />
          )}

          {/* Warnings */}
          {state === "done" &&
            result &&
            result.warnings &&
            result.warnings.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">⚠️ Warnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {result.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground flex items-start gap-2"
                        >
                          <span className="text-yellow-500 mt-0.5">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}
