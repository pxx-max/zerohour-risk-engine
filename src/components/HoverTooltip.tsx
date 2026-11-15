"use client";

import React from "react";
import { HelpCircle } from "lucide-react";

interface HoverTooltipProps {
  title?: string;
  description?: string;
  label?: string;
  explanation?: string;
  badge?: string;
  position?: "top" | "bottom";
  children?: React.ReactNode;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  title,
  description,
  label,
  explanation,
  badge,
  position = "bottom",
  children,
}) => {
  const resolvedTitle = title || label || "";
  const resolvedDescription = description || explanation || "";

  const posClasses =
    position === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-0";

  return (
    <div className="relative inline-flex items-center gap-1.5 group cursor-help">
      {children ? (
        children
      ) : (
        <>
          <span>{resolvedTitle}</span>
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-300 transition-colors" />
        </>
      )}
      <div
        role="tooltip"
        className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 absolute ${posClasses} w-64 p-3 rounded-xl bg-[#0B0E1A]/95 backdrop-blur-md border border-violet-400/30 shadow-xl text-left`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-100">
            {resolvedTitle}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-400/30">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
          {resolvedDescription}
        </p>
      </div>
    </div>
  );
};

export default HoverTooltip;
