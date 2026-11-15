import React from "react";
import AnalyticsBacktestView from "@/components/AnalyticsBacktestView";

export default function BacktestsPage() {
  return (
    <AnalyticsBacktestView
      initialTab="covid_2020"
      pageTitle="Crisis Backtests (COVID-19 & 2022)"
      pageSubtitle="Historical stress backtesting across the 2020 COVID-19 Crash and 2022 Rate-Hike Bear Market"
    />
  );
}
