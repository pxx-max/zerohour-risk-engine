import React from "react";
import AnalyticsBacktestView from "@/components/AnalyticsBacktestView";

export default function AnalyticsPage() {
  return (
    <AnalyticsBacktestView
      initialTab="performance"
      pageTitle="Analytics"
      pageSubtitle="Portfolio vs. Benchmark return trajectory, Student-t Copula tail correlation, and crisis comparisons"
    />
  );
}
