"use client";

import React from "react";
import type { UploadResponse } from "./types";

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
  lastScan: UploadResponse | null;
  setScanResult: (r: UploadResponse) => void;
}

export const RefreshContext = React.createContext<RefreshContextType>({
  refreshKey: 0,
  triggerRefresh: () => {},
  lastScan: null,
  setScanResult: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [lastScan, setLastScan] = React.useState<UploadResponse | null>(null);

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const setScanResult = React.useCallback((r: UploadResponse) => {
    setLastScan(r);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh, lastScan, setScanResult }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return React.useContext(RefreshContext);
}
