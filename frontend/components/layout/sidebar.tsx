"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  History,
  BarChart3,
  Settings,
  Leaf,
  ChevronLeft,
  Zap,
  Timer,
  Coins,
  CalendarDays,
  FlaskConical,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyze", label: "Analyze Waste", icon: Upload },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/decomposition", label: "Decomposition", icon: Timer },
  { href: "/carbon-credits", label: "Carbon Credits", icon: Coins },
  { href: "/heatmap", label: "Activity Map", icon: CalendarDays },
  { href: "/whatif", label: "What-If Lab", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex h-screen flex-col border-r border-border bg-card/50 backdrop-blur-xl"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-sm font-bold tracking-tight">
                Waste<span className="text-primary">2</span>Energy
              </h1>
              <p className="text-[10px] text-muted-foreground">
                AI Analytics Platform
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 h-8 w-1 rounded-r-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Eco footer */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-border p-4"
          >
            <div className="flex items-center gap-2 rounded-lg bg-green-500/5 p-3 border border-green-500/10">
              <Leaf className="h-4 w-4 text-green-500" />
              <div className="text-xs">
                <p className="font-medium text-green-600 dark:text-green-400">
                  Eco Impact
                </p>
                <p className="text-muted-foreground">
                  Every scan helps the planet
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-accent transition-colors z-10"
      >
        <ChevronLeft
          className={cn(
            "h-3 w-3 transition-transform",
            collapsed && "rotate-180",
          )}
        />
      </button>
    </motion.aside>
  );
}
