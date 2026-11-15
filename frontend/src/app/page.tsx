"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  History,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function TopographicWaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const resize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      t += 0.012;
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);

      const centerY = height * 0.56;
      const numLines = 26;

      for (let i = 0; i < numLines; i++) {
        const progress = i / (numLines - 1);
        const yOffset = (progress - 0.5) * 260;
        const alpha = 0.12 + Math.sin(progress * Math.PI) * 0.36;

        ctx.beginPath();
        const isCyanLayer = i % 3 === 0;
        if (isCyanLayer) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.78})`;
        } else {
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
        }
        ctx.lineWidth = i % 5 === 0 ? 1.8 : 1.05;

        const step = 18;
        for (let x = 0; x <= width + step; x += step) {
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI);
          const wave1 =
            Math.sin(normX * 4.8 + t + i * 0.19) * 58 * envelope;
          const wave2 =
            Math.cos(normX * 8.2 - t * 0.75 + i * 0.14) * 28 * envelope;
          const perspectiveTilt = (normX - 0.5) * (progress - 0.5) * 90;

          const y = centerY + yOffset + wave1 + wave2 + perspectiveTilt;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full opacity-90"
      aria-hidden="true"
    />
  );
}

export default function LandingHeroPage() {
  return (
    <div className="min-h-screen bg-[#090C16] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Ambient Deep Glows */}
      <div
        className="pointer-events-none absolute top-[-12%] left-1/2 -translate-x-1/2 w-[980px] h-[520px] rounded-full blur-[150px] opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(124,58,237,0.45) 0%, rgba(99,102,241,0.22) 45%, rgba(56,189,248,0.08) 75%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[-15%] left-1/3 w-[720px] h-[380px] rounded-full blur-[140px] opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(99,102,241,0.16) 55%, transparent 100%)",
        }}
      />

      {/* Animated 3D Topographic Wave Mesh */}
      <TopographicWaveCanvas />

      {/* Top Navigation Bar */}
      <header className="relative z-20 max-w-7xl w-full mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
        {/* Left Brand Badge */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          title="RiskLens // ZeroHour Quantitative Risk Engine"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-600/20 border border-violet-400/35 flex items-center justify-center shadow-[0_0_22px_rgba(139,92,246,0.35)]">
            <Activity className="w-4 h-4 text-violet-300" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">
              RiskLens <span className="text-violet-400 font-normal">//</span>{" "}
              ZeroHour
            </span>
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_10px_#8B5CF6]" />
          </div>
        </Link>

        {/* Center Clean Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link
            href="/dashboard"
            title="Open the real-time Portfolio Risk Overview dashboard"
            className="hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/risk-analysis"
            title="Inspect the Student-t Copula Monte Carlo engine and tail-loss distribution"
            className="hover:text-white transition-colors"
          >
            Copula Engine
          </Link>
          <Link
            href="/dashboard/backtests"
            title="Replay historical 2020 COVID-19 and 2022 Rate-Hike crisis backtests"
            className="hover:text-white transition-colors"
          >
            Crisis Backtests
          </Link>
          <Link
            href="/dashboard/ai-brief"
            title="View the read-only, math-verified AI Risk Governance Co-Pilot"
            className="hover:text-white transition-colors"
          >
            AI Governance
          </Link>
        </nav>

        {/* Right Pill CTA Button */}
        <Link
          href="/dashboard"
          title="Launch the live RiskLens Dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-400/35 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all"
        >
          <span>Explore Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Center Hero Section */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-4xl mx-auto">
        {/* Small Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#13182B]/85 border border-violet-400/25 text-xs font-medium text-violet-200 shadow-[0_0_24px_rgba(99,102,241,0.2)] backdrop-blur-md mb-7">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>
            Student-t Copula Tail-Risk • León et al. (2011) TCTF Contagion •
            COVID &amp; 2022 Backtests
          </span>
        </div>

        {/* Large Bold Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.06] mb-6 drop-shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          See Risk.{" "}
          <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
            Plan Better.
          </span>
        </h1>

        {/* Clean Subtitle */}
        <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl leading-relaxed mb-10">
          Real-time vectorized{" "}
          <span className="text-white font-medium">
            Student-t Copula Monte Carlo
          </span>{" "}
          simulations, dynamic{" "}
          <span className="text-white font-medium">
            Too-Connected-To-Fail (TCTF)
          </span>{" "}
          network contagion topology, and instant crisis backtesting across the
          2020 COVID-19 crash and 2022 rate-hike bear market.
        </p>

        {/* Dual Centered CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            title="Enter the live RiskLens Overview Dashboard (<25ms latency)"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-400/40 shadow-[0_0_32px_rgba(139,92,246,0.5)] transition-all"
          >
            <span>Explore Dashboard →</span>
          </Link>

          <Link
            href="/dashboard/backtests"
            title="Compare Gaussian vs. Student-t Copula VaR during the 2020 COVID-19 & 2022 Rate-Hike crashes"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold text-slate-200 hover:text-white bg-[#13182B]/75 hover:bg-[#192038]/90 border border-violet-400/25 backdrop-blur-md transition-all"
          >
            <History className="w-4 h-4 text-cyan-300" />
            <span>Run Crisis Backtest</span>
          </Link>
        </div>
      </main>

      {/* Bottom Quick-Access Capability Strip */}
      <footer className="relative z-20 max-w-6xl w-full mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Link
            href="/dashboard/risk-analysis"
            className="group p-4 rounded-2xl bg-[#13182B]/75 hover:bg-[#171E35]/90 border border-violet-500/15 hover:border-violet-400/35 backdrop-blur-md transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-violet-300">
                Student-t Copula Lab
              </span>
              <BarChart3 className="w-4 h-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              95% VaR &amp; 95%/99% CVaR with fat-tail degrees of freedom (ν) &amp;
              lower-tail dependence λ_L.
            </p>
          </Link>

          <Link
            href="/dashboard/backtests"
            className="group p-4 rounded-2xl bg-[#13182B]/75 hover:bg-[#171E35]/90 border border-violet-500/15 hover:border-violet-400/35 backdrop-blur-md transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-cyan-300">
                COVID-19 &amp; 2022 Backtests
              </span>
              <History className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              60-day historical crisis replay proving why Student-t Copula beats
              static Gaussian VaR.
            </p>
          </Link>

          <Link
            href="/dashboard/portfolio"
            className="group p-4 rounded-2xl bg-[#13182B]/75 hover:bg-[#171E35]/90 border border-violet-500/15 hover:border-violet-400/35 backdrop-blur-md transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-emerald-300">
                TCTF Network Contagion
              </span>
              <Network className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              León et al. (2011) eigenvector centrality &amp; interactive -15%
              single-node shock propagation.
            </p>
          </Link>

          <Link
            href="/dashboard/ai-brief"
            className="group p-4 rounded-2xl bg-[#13182B]/75 hover:bg-[#171E35]/90 border border-violet-500/15 hover:border-violet-400/35 backdrop-blur-md transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-amber-300">
                AI Governance Lock
              </span>
              <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Read-only advisory Co-Pilot with anti-hallucination numeric
              verification.
            </p>
          </Link>
        </div>
      </footer>
    </div>
  );
}
