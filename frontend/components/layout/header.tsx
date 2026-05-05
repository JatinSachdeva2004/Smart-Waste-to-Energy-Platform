"use client";

import React from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-6">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search waste records..."
          className="h-9 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
        </Button>

        {/* Theme Toggle */}
        {mounted && (
          <motion.button
            whileTap={{ scale: 0.9, rotate: 180 }}
            transition={{ duration: 0.3 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background hover:bg-accent transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-yellow-500" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </motion.button>
        )}

        {/* Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          AI
        </div>
      </div>
    </header>
  );
}
