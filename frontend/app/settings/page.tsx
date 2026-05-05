"use client";

import React from "react";
import { motion } from "framer-motion";
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
import { Select } from "@/components/ui/input";
import {
  Settings as SettingsIcon,
  Zap,
  Palette,
  Bell,
  Database,
  Save,
  Check,
} from "lucide-react";
import { useTheme } from "next-themes";

interface SettingsSection {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: SettingsSection) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [analysisMode, setAnalysisMode] = React.useState("standard");
  const [energyMethod, setEnergyMethod] = React.useState("best");
  const [contamination, setContamination] = React.useState("light");
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    // In a real app, persist to localStorage or backend
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "waste2energy_settings",
        JSON.stringify({ analysisMode, energyMethod, contamination }),
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Load saved settings on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("waste2energy_settings");
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.analysisMode) setAnalysisMode(s.analysisMode);
          if (s.energyMethod) setEnergyMethod(s.energyMethod);
          if (s.contamination) setContamination(s.contamination);
        } catch {}
      }
    }
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure analysis defaults and display preferences
        </p>
      </div>

      <div className="space-y-4">
        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Section
            title="Appearance"
            description="Visual settings"
            icon={Palette}
          >
            <SettingRow label="Theme" desc="Toggle between light and dark mode">
              <Select
                value={theme || "dark"}
                onChange={(e) => setTheme(e.target.value)}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
            </SettingRow>
          </Section>
        </motion.div>

        {/* Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Section
            title="Analysis Defaults"
            description="Default options for waste analysis"
            icon={Zap}
          >
            <SettingRow
              label="Analysis Mode"
              desc="Controls detection depth and speed"
            >
              <Select
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value)}
                options={[
                  { value: "quick", label: "Quick" },
                  { value: "standard", label: "Standard" },
                  { value: "deep", label: "Deep" },
                ]}
              />
            </SettingRow>

            <SettingRow
              label="Energy Method"
              desc="Preferred conversion pathway"
            >
              <Select
                value={energyMethod}
                onChange={(e) => setEnergyMethod(e.target.value)}
                options={[
                  { value: "best", label: "Best Available" },
                  { value: "incineration", label: "Incineration" },
                  { value: "pyrolysis", label: "Pyrolysis" },
                  { value: "gasification", label: "Gasification" },
                  { value: "biogas", label: "Biogas" },
                  { value: "plasma_arc", label: "Plasma Arc" },
                  { value: "recycling", label: "Recycling" },
                ]}
              />
            </SettingRow>

            <SettingRow
              label="Contamination Level"
              desc="Default contamination assumption"
            >
              <Select
                value={contamination}
                onChange={(e) => setContamination(e.target.value)}
                options={[
                  { value: "clean", label: "Clean" },
                  { value: "light", label: "Light" },
                  { value: "moderate", label: "Moderate" },
                  { value: "heavy", label: "Heavy" },
                ]}
              />
            </SettingRow>
          </Section>
        </motion.div>

        {/* Data */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Section
            title="Data"
            description="Data and storage management"
            icon={Database}
          >
            <SettingRow label="API Endpoint" desc="Backend server address">
              <Badge variant="outline" className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </Badge>
            </SettingRow>
          </Section>
        </motion.div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant={saved ? "outline" : "glow"} onClick={handleSave}>
          {saved ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
