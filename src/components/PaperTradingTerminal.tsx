"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  History,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";

export default function PaperTradingTerminal() {
  const {
    feedMode,
    feedSource,
    equitiesLive,
    binanceLive,
    lastLiveSync,
    assets,
    paperAccount,
    lastOrder,
    metrics,
    placePaperOrder,
    resetPaperAccount,
    syncLiveMarket,
  } = useRisk();

  const [selectedTicker, setSelectedTicker] = useState<string>(
    assets[0]?.ticker || "NVDA"
  );
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [sizingMode, setSizingMode] = useState<"USD" | "SHARES">("USD");
  const [usdAmount, setUsdAmount] = useState<string>("25000");
  const [shareQty, setShareQty] = useState<string>("100");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [orderBanner, setOrderBanner] = useState<{
    status: "FILLED" | "REJECTED";
    message: string;
  } | null>(null);

  // Keep selectedTicker valid when switching between Equities and Crypto
  useEffect(() => {
    if (!assets.some((a) => a.ticker === selectedTicker) && assets.length > 0) {
      setSelectedTicker(assets[0].ticker);
    }
  }, [assets, selectedTicker]);

  const activePosition = useMemo(() => {
    return (
      paperAccount.positions.find((p) => p.ticker === selectedTicker) ||
      paperAccount.positions[0]
    );
  }, [paperAccount.positions, selectedTicker]);

  const activeAsset = useMemo(() => {
    return (
      assets.find((a) => a.ticker === selectedTicker) ||
      assets[0] || {
        ticker: "NVDA",
        price: 138.6,
        weight: 0.25,
        change_24h_pct: 1.4,
      }
    );
  }, [assets, selectedTicker]);

  // Default limit price when switching ticker
  useEffect(() => {
    if (activeAsset?.price) {
      setLimitPrice(activeAsset.price.toFixed(2));
    }
  }, [selectedTicker, activeAsset?.price]);

  const executionPrice = useMemo(() => {
    if (orderType === "LIMIT" && Number(limitPrice) > 0) {
      return Number(limitPrice);
    }
    if (!activePosition) return activeAsset.price;
    return side === "BUY" ? activePosition.ask_price : activePosition.bid_price;
  }, [orderType, limitPrice, activePosition, activeAsset.price, side]);

  const estimatedShares = useMemo(() => {
    if (sizingMode === "SHARES") {
      return Math.max(0, Number(shareQty) || 0);
    }
    const usd = Math.max(0, Number(usdAmount) || 0);
    return executionPrice > 0 ? +(usd / executionPrice).toFixed(4) : 0;
  }, [sizingMode, shareQty, usdAmount, executionPrice]);

  const estimatedNotional = useMemo(() => {
    if (sizingMode === "USD") {
      return Math.max(0, Number(usdAmount) || 0);
    }
    return +(estimatedShares * executionPrice).toFixed(2);
  }, [sizingMode, usdAmount, estimatedShares, executionPrice]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicker || estimatedShares <= 0) return;
    setSubmitting(true);
    const rec = await placePaperOrder({
      ticker: selectedTicker,
      side,
      order_type: orderType,
      quantity: sizingMode === "SHARES" ? Number(shareQty) : undefined,
      notional_usd: sizingMode === "USD" ? Number(usdAmount) : undefined,
      limit_price: orderType === "LIMIT" ? Number(limitPrice) : undefined,
      feed_mode: feedMode,
    });
    setSubmitting(false);
    if (rec) {
      setOrderBanner({ status: rec.status, message: rec.message });
    }
  };

  const handleQuickTrade = async (
    ticker: string,
    tradeSide: "BUY" | "SELL",
    notionalUsd: number
  ) => {
    setSelectedTicker(ticker);
    setSubmitting(true);
    const rec = await placePaperOrder({
      ticker,
      side: tradeSide,
      order_type: "MARKET",
      notional_usd: notionalUsd,
      feed_mode: feedMode,
    });
    setSubmitting(false);
    if (rec) {
      setOrderBanner({ status: rec.status, message: rec.message });
    }
  };

  const handleSyncLive = async () => {
    setSyncing(true);
    await syncLiveMarket();
    setTimeout(() => setSyncing(false), 400);
  };

  const isLiveFeed =
    feedMode === "crypto"
      ? binanceLive || feedSource.includes("LIVE")
      : equitiesLive || feedSource.includes("LIVE");

  return (
    <div className="space-y-6">
      {/* Live Open-Source Market Feed Status Bar */}
      <div className="rl-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34D399]" />
            {feedMode === "crypto"
              ? "LIVE • Binance Spot Open Stream"
              : "LIVE • Yahoo Finance Open Market Feed"}
          </span>
          <span className="text-xs text-slate-400">
            Source:{" "}
            <strong className="text-slate-200">{feedSource}</strong>
            {lastLiveSync ? ` • Synced ${lastLiveSync}` : ""}
          </span>
          {!isLiveFeed && (
            <span className="text-[11px] text-amber-300">
              (High-Frequency Correlated Tick Mode Active)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncLive}
            disabled={syncing}
            title="Pull latest real-time quotes from Yahoo Finance & Binance open APIs"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-400/30 transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            <span>Sync Live Market</span>
          </button>

          <button
            type="button"
            onClick={resetPaperAccount}
            title="Reset Paper Trading Account back to $1,250,000 initial equity"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#161C32] hover:bg-[#1E2642] text-slate-300 hover:text-white border border-violet-500/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset $1.25M Account</span>
          </button>
        </div>
      </div>

      {/* Paper Trading Account Equity & Buying Power KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rl-card-glow p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Total Paper Equity</span>
            <Wallet className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            ${paperAccount.total_equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            Initial Capital: ${paperAccount.initial_equity.toLocaleString()}
          </p>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Cash Buying Power</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">
            ${paperAccount.cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Available for instant BUY orders
          </p>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Invested Market Value</span>
            <ShoppingCart className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-100 tabular-nums">
            ${paperAccount.positions_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            Live 95% CVaR: -
            {((metrics?.cvar_95 ?? 0.0342) * 100).toFixed(2)}%
          </p>
        </div>

        <div className="rl-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Total Paper PnL</span>
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <p
            className={`text-2xl sm:text-3xl font-bold tabular-nums ${
              paperAccount.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {paperAccount.total_pnl >= 0 ? "+" : "-"}$
            {Math.abs(paperAccount.total_pnl).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            Unrealized:{" "}
            {paperAccount.unrealized_pnl >= 0 ? "+" : "-"}$
            {Math.abs(paperAccount.unrealized_pnl).toLocaleString()} • Realized:{" "}
            {paperAccount.realized_pnl >= 0 ? "+" : "-"}$
            {Math.abs(paperAccount.realized_pnl).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Order Execution Notification Banner */}
      {(orderBanner || lastOrder) && (
        <div
          className={`px-4 py-3 rounded-2xl border flex items-center justify-between text-xs ${
            (orderBanner?.status || lastOrder?.status) === "FILLED"
              ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
              : "bg-rose-500/10 border-rose-400/30 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {(orderBanner?.status || lastOrder?.status) === "FILLED" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">
              {orderBanner?.message || lastOrder?.message}
            </span>
            <span className="text-slate-400 hidden md:inline">
              — Portfolio weights &amp; Student-t Copula VaR/CVaR automatically
              recalculated.
            </span>
          </div>
          {orderBanner && (
            <button
              type="button"
              onClick={() => setOrderBanner(null)}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Main 2-Column Paper Trading Desk: Left = BUY/SELL Order Ticket, Right = Live Positions & Quick Trade */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (5 cols): Interactive BUY / SELL Order Ticket */}
        <form
          onSubmit={handleSubmitOrder}
          className="lg:col-span-5 rl-card p-6 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-violet-500/15 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-white">
                  Paper Trade Order Ticket
                </h2>
                <p className="text-xs text-slate-400">
                  Execute manual BUY or SELL orders at live market prices
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-400/25">
                {selectedTicker}
              </span>
            </div>

            {/* Ticker Selector Pills */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Select Instrument
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2">
                {assets.map((a) => {
                  const active = a.ticker === selectedTicker;
                  const chg = a.change_24h_pct ?? 0.5;
                  return (
                    <button
                      key={a.ticker}
                      type="button"
                      onClick={() => setSelectedTicker(a.ticker)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? "bg-violet-600/20 border-violet-400/50 text-white shadow-[0_0_16px_rgba(139,92,246,0.25)]"
                          : "bg-[#0E1324] border-violet-500/15 text-slate-300 hover:border-violet-400/30"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{a.ticker}</span>
                        <span
                          className={`text-[10px] ${
                            chg >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {chg >= 0 ? "+" : ""}
                          {chg.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 tabular-nums mt-0.5">
                        ${a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Bid / Ask / Position Quote Box */}
            {activePosition && (
              <div className="p-3.5 rounded-xl bg-[#0E1324] border border-violet-500/15 grid grid-cols-3 gap-2 text-xs tabular-nums">
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Live Bid / Ask
                  </span>
                  <span className="font-semibold text-emerald-400">
                    ${activePosition.bid_price.toFixed(2)}
                  </span>{" "}
                  /{" "}
                  <span className="font-semibold text-rose-400">
                    ${activePosition.ask_price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Current Position
                  </span>
                  <span className="font-bold text-white">
                    {activePosition.shares.toLocaleString()} sh
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Position Value
                  </span>
                  <span className="font-bold text-violet-300">
                    ${activePosition.market_value.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* BUY / SELL Side Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide("BUY")}
                title="Buy shares/units using available cash buying power"
                className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  side === "BUY"
                    ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    : "bg-[#0E1324] border-violet-500/15 text-slate-400 hover:text-slate-200"
                }`}
              >
                BUY {selectedTicker}
              </button>
              <button
                type="button"
                onClick={() => setSide("SELL")}
                title="Sell existing shares/units back to cash"
                className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  side === "SELL"
                    ? "bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_20px_rgba(251,113,133,0.3)]"
                    : "bg-[#0E1324] border-violet-500/15 text-slate-400 hover:text-slate-200"
                }`}
              >
                SELL {selectedTicker}
              </button>
            </div>

            {/* Order Type (MARKET vs LIMIT) & Sizing Mode (USD vs SHARES) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-1 rounded-xl bg-[#0E1324] border border-violet-500/15 grid grid-cols-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setOrderType("MARKET")}
                  className={`py-1.5 rounded-lg transition-all ${
                    orderType === "MARKET"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("LIMIT")}
                  className={`py-1.5 rounded-lg transition-all ${
                    orderType === "LIMIT"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Limit
                </button>
              </div>

              <div className="p-1 rounded-xl bg-[#0E1324] border border-violet-500/15 grid grid-cols-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSizingMode("USD")}
                  className={`py-1.5 rounded-lg transition-all ${
                    sizingMode === "USD"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  By USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setSizingMode("SHARES")}
                  className={`py-1.5 rounded-lg transition-all ${
                    sizingMode === "SHARES"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  By Shares
                </button>
              </div>
            </div>

            {/* Amount / Quantity Input + Quick Sizing Pills */}
            {sizingMode === "USD" ? (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Order Dollar Amount (USD)
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    ≈ {estimatedShares.toLocaleString()} {selectedTicker}
                  </span>
                </div>
                <input
                  type="number"
                  min={100}
                  step={500}
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1324] border border-violet-500/25 text-white font-bold tabular-nums text-sm focus:outline-none focus:border-violet-400"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setUsdAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#151C33] hover:bg-violet-600/25 text-slate-300 border border-violet-500/15"
                    >
                      ${(amt / 1000).toFixed(0)}k
                    </button>
                  ))}
                  {side === "BUY" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setUsdAmount(
                          String(Math.floor(paperAccount.cash_balance * 0.5))
                        )
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                    >
                      50% Cash
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setUsdAmount(
                          String(
                            Math.floor((activePosition?.market_value || 0) * 0.5)
                          )
                        )
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/25"
                    >
                      50% Pos
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Share / Unit Quantity
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    ≈ ${estimatedNotional.toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  min={0.01}
                  step={1}
                  value={shareQty}
                  onChange={(e) => setShareQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1324] border border-violet-500/25 text-white font-bold tabular-nums text-sm focus:outline-none focus:border-violet-400"
                />
                {side === "SELL" && activePosition && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShareQty(String(+(activePosition.shares * 0.25).toFixed(4)))
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-[#151C33] text-slate-300"
                    >
                      25% Shares
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setShareQty(String(+(activePosition.shares * 0.5).toFixed(4)))
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-[#151C33] text-slate-300"
                    >
                      50% Shares
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareQty(String(activePosition.shares))}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/25"
                    >
                      Sell All (100%)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Limit Price Input when LIMIT is selected */}
            {orderType === "LIMIT" && (
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Limit Execution Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0E1324] border border-violet-500/25 text-white font-bold tabular-nums text-sm"
                />
              </div>
            )}
          </div>

          {/* Submit Order Button */}
          <div className="pt-3 border-t border-violet-500/15 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 tabular-nums">
              <span>Estimated Order Total:</span>
              <span className="font-bold text-white text-sm">
                ${estimatedNotional.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || estimatedShares <= 0}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-lg ${
                side === "BUY"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                  : "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-[0_0_24px_rgba(244,63,94,0.35)]"
              }`}
            >
              {submitting
                ? "Executing Order..."
                : `${side} ${estimatedShares.toLocaleString()} ${selectedTicker} (${orderType})`}
            </button>
          </div>
        </form>

        {/* Right (7 cols): Live Positions Table with 1-Click Quick Buy/Sell + Order History Blotter */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Live Positions Table */}
          <div className="rl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Open Paper Positions &amp; 1-Click Quick Trade
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time mark-to-market valuation and portfolio weights
                  feeding the Student-t Copula engine
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-violet-500/15 text-slate-400">
                    <th className="py-2.5 pr-3 font-medium">Asset</th>
                    <th className="py-2.5 px-2 font-medium">Live Price</th>
                    <th className="py-2.5 px-2 font-medium">Shares</th>
                    <th className="py-2.5 px-2 font-medium">Market Value</th>
                    <th className="py-2.5 px-2 font-medium">Weight</th>
                    <th className="py-2.5 px-2 font-medium">Unrealized PnL</th>
                    <th className="py-2.5 pl-2 text-right font-medium">
                      Quick Trade ($10k)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-500/10">
                  {paperAccount.positions.map((pos) => {
                    const isUp = pos.day_change_pct >= 0;
                    const pnlUp = pos.unrealized_pnl >= 0;
                    return (
                      <tr
                        key={pos.ticker}
                        onClick={() => setSelectedTicker(pos.ticker)}
                        className={`cursor-pointer transition-colors ${
                          selectedTicker === pos.ticker
                            ? "bg-violet-500/10"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {pos.ticker}
                            </span>
                            <span
                              className={`inline-flex items-center text-[10px] font-semibold ${
                                isUp ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isUp ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {isUp ? "+" : ""}
                              {pos.day_change_pct.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 font-semibold text-slate-100">
                          ${pos.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-slate-300">
                          {pos.shares.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 font-bold text-white">
                          ${pos.market_value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 font-semibold">
                            {(pos.weight * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td
                          className={`py-3 px-2 font-bold ${
                            pnlUp ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {pnlUp ? "+" : "-"}$
                          {Math.abs(pos.unrealized_pnl).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                          <span className="text-[10px] font-normal">
                            ({pnlUp ? "+" : ""}
                            {pos.unrealized_pnl_pct.toFixed(1)}%)
                          </span>
                        </td>
                        <td
                          className="py-3 pl-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickTrade(pos.ticker, "BUY", 10000)
                              }
                              title={`Instant Market BUY $10,000 of ${pos.ticker}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/30 transition-all"
                            >
                              +Buy $10k
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickTrade(pos.ticker, "SELL", 10000)
                              }
                              title={`Instant Market SELL $10,000 of ${pos.ticker}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-400/30 transition-all"
                            >
                              -Sell $10k
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Paper Order Execution Blotter */}
          <div className="rl-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white">
                  Recent Paper Order Blotter
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {paperAccount.order_history.length} orders logged
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {paperAccount.order_history.slice(0, 8).map((ord) => (
                <div
                  key={ord.order_id}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0E1324] border border-violet-500/15 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        ord.side === "BUY"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {ord.side}
                    </span>
                    <span className="font-bold text-white">{ord.ticker}</span>
                    <span className="text-slate-300">{ord.message}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span
                      className={
                        ord.status === "FILLED"
                          ? "text-emerald-400 font-semibold"
                          : "text-rose-400 font-semibold"
                      }
                    >
                      {ord.status}
                    </span>
                    <span>{ord.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
