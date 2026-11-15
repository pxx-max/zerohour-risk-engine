"use client";

import React, { createContext, useContext, useState } from "react";
import { useRiskStream } from "@/hooks/useRiskStream";

type RiskStreamReturn = ReturnType<typeof useRiskStream>;

interface RiskSettings {
  realTimeAlerts: boolean;
  strictAiGuardrail: boolean;
  deterministicSeedMode: boolean;
  autoCopulaTailCalibration: boolean;
}

interface RiskContextValue extends RiskStreamReturn {
  settings: RiskSettings;
  toggleSetting: (key: keyof RiskSettings) => void;
}

const RiskContext = createContext<RiskContextValue | null>(null);

export function RiskProvider({ children }: { children: React.ReactNode }) {
  const stream = useRiskStream();
  const [settings, setSettings] = useState<RiskSettings>({
    realTimeAlerts: true,
    strictAiGuardrail: true,
    deterministicSeedMode: true,
    autoCopulaTailCalibration: true,
  });

  const toggleSetting = (key: keyof RiskSettings) => {
    setSettings((prev) => {
      const nextVal = !prev[key];
      // Enforce that Strict AI Guardrail cannot be disabled (or if toggled, syncs seed)
      if (key === "deterministicSeedMode") {
        stream.updateStressParams({
          random_seed: nextVal ? 42 : null,
        });
      }
      return {
        ...prev,
        [key]: key === "strictAiGuardrail" ? true : nextVal,
      };
    });
  };

  return (
    <RiskContext.Provider value={{ ...stream, settings, toggleSetting }}>
      {children}
    </RiskContext.Provider>
  );
}

export function useRisk() {
  const ctx = useContext(RiskContext);
  if (!ctx) {
    throw new Error("useRisk must be used inside a RiskProvider");
  }
  return ctx;
}
