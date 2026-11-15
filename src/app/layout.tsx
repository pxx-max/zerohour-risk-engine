import type { Metadata } from "next";
import "./globals.css";
import GuideChatbotWidget from "@/components/GuideChatbotWidget";

export const metadata: Metadata = {
  title: "RiskLens // ZeroHour — See Risk. Plan Better.",
  description:
    "Real-Time Student-t Copula Tail-Risk Simulation, Historical Crisis Backtesting (COVID-19 & 2022), and León et al. (2011) TCTF Network Contagion Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0E1A] text-slate-100 antialiased selection:bg-violet-500/30 selection:text-violet-200">
        {children}
        <GuideChatbotWidget />
      </body>
    </html>
  );
}
