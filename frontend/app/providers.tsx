"use client";

import { ThemeProvider } from "next-themes";
import { RefreshProvider } from "@/lib/refresh-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <RefreshProvider>{children}</RefreshProvider>
    </ThemeProvider>
  );
}
