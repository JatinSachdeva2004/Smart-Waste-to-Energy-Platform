import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            active === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground/80",
          )}
        >
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
