"use client";

import React from "react";
import { RiskProvider } from "@/context/RiskContext";
import SidebarNav from "@/components/SidebarNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RiskProvider>
      <div className="min-h-screen bg-[#0B0E1A] text-slate-100 flex">
        <SidebarNav />
        <div className="flex-1 min-w-0 flex flex-col bg-[#0B0E1A] relative overflow-x-hidden">
          {/* Subtle ambient radial glow at top-right */}
          <div
            className="pointer-events-none fixed top-0 right-0 w-[620px] h-[380px] rounded-full opacity-25 blur-[130px]"
            style={{
              background:
                "radial-gradient(circle, rgba(139,92,246,0.32) 0%, rgba(56,189,248,0.12) 60%, transparent 100%)",
            }}
          />
          <main className="flex-1 px-6 lg:px-9 py-7 max-w-[1480px] w-full mx-auto relative z-10">
            {children}
          </main>
        </div>
      </div>
    </RiskProvider>
  );
}
