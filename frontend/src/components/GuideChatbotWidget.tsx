'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Compass,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionLabel?: string;
  actionRoute?: string;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: 'Overview Dashboard',
    route: '/dashboard',
    summary:
      'Start here for your Portfolio Health Banner, 95% VaR & CVaR KPIs, Performance Area Chart, Asset Allocation Donut, and Risk Level Gauge.',
    tip: 'Watch the top-right Live Telemetry pill to see real-time market updates.',
  },
  {
    step: 2,
    title: 'Live Paper Trading & TCTF Contagion',
    route: '/dashboard/portfolio',
    summary:
      'Trade with $1,250,000 simulated equity using live Yahoo Finance & Binance feeds. Place Market or Limit BUY/SELL orders, use 1-click +$10k/-$10k buttons, and inspect the León et al. (2011) TCTF Network Contagion.',
    tip: 'Try the -15% Shock test to see how contagion propagates across assets.',
  },
  {
    step: 3,
    title: 'Student-t Copula Monte Carlo Lab',
    route: '/dashboard/risk-analysis',
    summary:
      'Run 50-bin tail-risk simulations with adjustable degrees of freedom (ν) and stress sliders to model extreme market crashes.',
    tip: 'Lower ν (e.g., 3–4) increases fat-tail joint crash probability.',
  },
  {
    step: 4,
    title: 'COVID-19 & 2022 Crisis Backtests',
    route: '/dashboard/backtests',
    summary:
      'Validate your portfolio against historical stress regimes including the March 2020 COVID-19 liquidity shock and the 2022 rate-hike drawdown.',
    tip: 'Compare VaR breaches against actual historical drawdowns.',
  },
  {
    step: 5,
    title: 'AI Governance Lock & Settings',
    route: '/dashboard/settings',
    summary:
      'Configure risk limits, governance locks, and telemetry preferences. Review automated executive summaries in AI Brief.',
    tip: 'You can return to this guide anytime from the bottom-right corner!',
  },
];

const QUICK_QUESTIONS = [
  'If I want to invest in Apple for profit, what should I do?',
  'How do I Buy/Sell in Paper Trading?',
  'Why was my order rejected?',
  'Explain 95% VaR vs CVaR',
  'What is Student-t Copula (ν)?',
  'How to test -15% TCTF Contagion?',
];

function localFallbackReply(question: string): Omit<ChatMessage, 'id' | 'role'> {
  const q = question.toLowerCase();
  if (q.includes('buy') || q.includes('sell') || q.includes('paper') || q.includes('trade')) {
    return {
      text: 'Go to **Portfolio & Paper Trading**. Pick any ticker (e.g., AAPL, NVDA, BTC-USD), choose **BUY** or **SELL**, select **Market** or **Limit**, enter your quantity (or click **+$10k / -$10k**), and submit. Orders execute against live Yahoo Finance / Binance prices with $1,250,000 paper equity.',
      actionLabel: 'Open Paper Trading',
      actionRoute: '/dashboard/portfolio',
    };
  }
  if (q.includes('reject') || q.includes('fail') || q.includes('error')) {
    return {
      text: 'Orders can be rejected if: (1) quantity is 0 or negative, (2) you try to **SELL** more shares/units than you currently hold, (3) a **BUY** exceeds your available paper cash, or (4) a Limit price is invalid. Check your open positions and available cash in the Paper Trading Terminal.',
      actionLabel: 'Check Positions',
      actionRoute: '/dashboard/portfolio',
    };
  }
  if (q.includes('var') || q.includes('cvar')) {
    return {
      text: '**95% VaR (Value at Risk)** is the maximum expected loss over 1 day at 95% confidence. **CVaR (Expected Shortfall)** is the average loss *beyond* that 95% threshold—capturing severe tail-crash risk.',
      actionLabel: 'View Risk KPIs',
      actionRoute: '/dashboard',
    };
  }
  if (q.includes('copula') || q.includes('ν') || q.includes('student')) {
    return {
      text: 'The **Student-t Copula** models joint tail dependence—meaning assets crash together during panics. Lowering **ν (degrees of freedom)** fattens the tails and increases simultaneous crash probability.',
      actionLabel: 'Open Copula Lab',
      actionRoute: '/dashboard/risk-analysis',
    };
  }
  if (q.includes('tctf') || q.includes('contagion') || q.includes('-15%')) {
    return {
      text: 'In **Portfolio & Paper Trading**, scroll to the **León et al. (2011) TCTF Network Contagion** panel and trigger the **-15% Shock** to see how distress propagates across correlated holdings.',
      actionLabel: 'Test TCTF Contagion',
      actionRoute: '/dashboard/portfolio',
    };
  }
  if (q.includes('covid') || q.includes('2022') || q.includes('backtest')) {
    return {
      text: 'Open **Backtests** to replay your current portfolio against the **March 2020 COVID-19** shock and the **2022 Rate-Hike** regime, comparing predicted VaR against realized drawdowns.',
      actionLabel: 'Open Backtests',
      actionRoute: '/dashboard/backtests',
    };
  }
  return {
    text: 'I can help you navigate **RiskLens // ZeroHour**, place paper trades, run Student-t Copula stress tests, or troubleshoot any issue. Pick a quick question below or switch to **Guided Tour** for a 5-step walkthrough!',
    actionLabel: 'Go to Overview',
    actionRoute: '/dashboard',
  };
}

export default function GuideChatbotWidget() {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [showCallout, setShowCallout] = useState(true);
  const [mode, setMode] = useState<'chat' | 'tour'>('chat');
  const [tourIndex, setTourIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to **RiskLens // ZeroHour**! I am your AI Guide. Ask me any question, troubleshoot an issue, or switch to **Guided Tour** for a 1-minute walkthrough.',
      actionLabel: 'Start Overview',
      actionRoute: '/dashboard',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, mode]);

  const handleOpen = () => {
    setIsOpen(true);
    setShowCallout(false);
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, currentPath: pathname }),
      });
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply || localFallbackReply(query).text,
          actionLabel: data.actionLabel,
          actionRoute: data.actionRoute,
        },
      ]);
    } catch {
      const fallback = localFallbackReply(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          ...fallback,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStep = TOUR_STEPS[tourIndex];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      {/* Proactive New-User Callout Bubble */}
      {!isOpen && showCallout && (
        <div className="relative max-w-[260px] rounded-2xl border border-violet-500/40 bg-slate-950/95 px-4 py-3 text-xs text-slate-100 shadow-2xl shadow-violet-950/50 backdrop-blur-xl animate-fade-in">
          <button
            onClick={() => setShowCallout(false)}
            aria-label="Dismiss guide callout"
            className="absolute right-2 top-2 rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-4 font-medium leading-relaxed">
            👋 <span className="text-violet-300 font-semibold">New here?</span> Click for a
            1-minute guided tour or ask me any problem!
          </p>
        </div>
      )}

      {/* Expanded Chatbot Popup */}
      {isOpen && (
        <div className="flex h-[540px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0b0f1e]/95 text-slate-100 shadow-2xl shadow-violet-950/60 backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-violet-950/80 via-indigo-950/80 to-slate-900/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/40">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  ZeroHour AI Guide
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-400">Onboarding &amp; Problem Solver</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Guide"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 border-b border-white/10 bg-slate-950/60 p-1.5">
            <button
              onClick={() => setMode('chat')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                mode === 'chat'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask AI Guide
            </button>
            <button
              onClick={() => setMode('tour')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                mode === 'tour'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              Guided Tour (5 Steps)
            </button>
          </div>

          {/* Body */}
          {mode === 'tour' ? (
            <div className="flex flex-1 flex-col justify-between p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-violet-300">
                    STEP {currentStep.step} OF {TOUR_STEPS.length}
                  </span>
                  <div className="flex gap-1">
                    {TOUR_STEPS.map((s, idx) => (
                      <button
                        key={s.step}
                        onClick={() => setTourIndex(idx)}
                        aria-label={`Go to step ${s.step}`}
                        className={`h-1.5 w-5 rounded-full transition ${
                          idx === tourIndex ? 'bg-violet-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2.5">
                  <h3 className="text-base font-semibold text-white">{currentStep.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-300">{currentStep.summary}</p>
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-2.5 text-[11px] text-violet-200">
                    <span className="font-semibold">Pro Tip:</span> {currentStep.tip}
                  </div>
                </div>

                <button
                  onClick={() => router.push(currentStep.route)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
                >
                  Take Me There
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <button
                  onClick={() => setTourIndex((i) => Math.max(0, i - 1))}
                  disabled={tourIndex === 0}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  onClick={() =>
                    setTourIndex((i) => (i < TOUR_STEPS.length - 1 ? i + 1 : 0))
                  }
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                >
                  {tourIndex === TOUR_STEPS.length - 1 ? 'Restart Tour' : 'Next Step'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-violet-600 text-white'
                          : 'border border-white/10 bg-white/5 text-slate-200'
                      }`}
                    >
                      {m.text.split('**').map((part, idx) =>
                        idx % 2 === 1 ? (
                          <strong key={idx} className="font-semibold text-white">
                            {part}
                          </strong>
                        ) : (
                          <span key={idx}>{part}</span>
                        )
                      )}
                    </div>
                    {m.actionRoute && m.actionLabel && (
                      <button
                        onClick={() => router.push(m.actionRoute!)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/25"
                      >
                        {m.actionLabel}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="text-xs text-slate-400 animate-pulse">
                    ZeroHour AI Guide is thinking...
                  </div>
                )}
              </div>

              {/* Quick Question Chips */}
              <div className="border-t border-white/10 bg-slate-950/50 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  <HelpCircle className="h-3 w-3 text-violet-400" />
                  Quick Help
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2 border-t border-white/10 bg-slate-950/80 p-3"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask any question or problem..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        aria-label="Toggle AI Guide Chatbot"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-900/50 ring-2 ring-violet-400/40 transition-all hover:scale-105 hover:ring-violet-300"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400" />
            </span>
          </>
        )}
      </button>
    </div>
  );
}
