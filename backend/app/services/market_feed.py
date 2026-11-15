from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import uuid
from typing import Dict, List, Literal, Optional
import httpx
import numpy as np

from app.schemas import (
    AssetInput,
    PaperAccountState,
    PaperOrderRecord,
    PaperOrderRequest,
    PaperPosition,
)
from app.engine.network_contagion import (
    BASELINE_ANNUAL_VOL,
    build_base_correlation_matrix,
)

logger = logging.getLogger(__name__)

BINANCE_WS_URL = (
    "wss://stream.binance.com:9443/stream?streams="
    "btcusdt@ticker/ethusdt@ticker/solusdt@ticker/bnbusdt@ticker"
)

BINANCE_REST_URLS = [
    "https://api.binance.com/api/v3/ticker/24hr",
    "https://api.binance.us/api/v3/ticker/24hr",
]

COINGECKO_SIMPLE_URL = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true"
)

YAHOO_CHART_URLS = [
    "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d",
]

SYMBOL_MAP = {
    "BTCUSDT": "BTC",
    "ETHUSDT": "ETH",
    "SOLUSDT": "SOL",
    "BNBUSDT": "BNB",
}

COINGECKO_MAP = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "solana": "SOL",
    "binancecoin": "BNB",
}

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class DualModeMarketStreamer:
    """
    Open-source live market data streamer + interactive Paper Trading engine:
      1. Live Equities Feed via Yahoo Finance open v8 chart API (NVDA, AAPL, MSFT, JPM, GLD, TLT).
      2. Live 24/7 Crypto Feed via Binance Spot WebSocket + REST + CoinGecko open API (BTC, ETH, SOL, BNB).
      3. Interactive Paper Trading Book supporting BUY / SELL Market & Limit orders with real-time
         portfolio weight recalculation feeding directly into Student-t Copula Monte Carlo VaR/CVaR.
    """

    def __init__(self) -> None:
        self.equities_prices: Dict[str, float] = {
            "NVDA": 138.60,
            "AAPL": 228.40,
            "MSFT": 442.10,
            "JPM": 234.80,
            "GLD": 246.50,
            "TLT": 92.30,
        }
        self.equities_anchor_prices: Dict[str, float] = dict(self.equities_prices)
        self.equities_prev_close: Dict[str, float] = {
            "NVDA": 136.20,
            "AAPL": 226.80,
            "MSFT": 439.50,
            "JPM": 232.90,
            "GLD": 244.80,
            "TLT": 92.95,
        }
        self.equities_high: Dict[str, float] = {
            k: round(v * 1.014, 2) for k, v in self.equities_prices.items()
        }
        self.equities_low: Dict[str, float] = {
            k: round(v * 0.986, 2) for k, v in self.equities_prices.items()
        }
        self.equities_volume: Dict[str, float] = {
            "NVDA": 48_500_000.0,
            "AAPL": 39_200_000.0,
            "MSFT": 19_800_000.0,
            "JPM": 9_400_000.0,
            "GLD": 6_100_000.0,
            "TLT": 31_400_000.0,
        }
        self.equities_weights: Dict[str, float] = {
            "NVDA": 0.25,
            "AAPL": 0.20,
            "MSFT": 0.20,
            "JPM": 0.15,
            "GLD": 0.10,
            "TLT": 0.10,
        }

        self.crypto_prices: Dict[str, float] = {
            "BTC": 91450.00,
            "ETH": 3180.00,
            "SOL": 212.40,
            "BNB": 642.80,
        }
        self.crypto_anchor_prices: Dict[str, float] = dict(self.crypto_prices)
        self.crypto_prev_close: Dict[str, float] = {
            "BTC": 89950.00,
            "ETH": 3110.00,
            "SOL": 206.80,
            "BNB": 635.00,
        }
        self.crypto_high: Dict[str, float] = {
            k: round(v * 1.025, 2) for k, v in self.crypto_prices.items()
        }
        self.crypto_low: Dict[str, float] = {
            k: round(v * 0.975, 2) for k, v in self.crypto_prices.items()
        }
        self.crypto_volume: Dict[str, float] = {
            "BTC": 34_200.0,
            "ETH": 245_000.0,
            "SOL": 3_400_000.0,
            "BNB": 410_000.0,
        }
        self.crypto_weights: Dict[str, float] = {
            "BTC": 0.45,
            "ETH": 0.30,
            "SOL": 0.15,
            "BNB": 0.10,
        }

        self._rng = np.random.default_rng(101)
        self._eq_tickers = list(self.equities_prices.keys())
        self._eq_chol = np.linalg.cholesky(build_base_correlation_matrix(self._eq_tickers))
        self._crypto_tickers = list(self.crypto_prices.keys())
        self._crypto_chol = np.linalg.cholesky(build_base_correlation_matrix(self._crypto_tickers))

        self.binance_live_connected: bool = False
        self.equities_live_connected: bool = False
        self.crypto_rest_connected: bool = False
        self.last_live_sync: Optional[str] = None

        self._binance_task: asyncio.Task | None = None
        self._live_poll_task: asyncio.Task | None = None

        # Paper Trading Account Books (Equities & Crypto)
        self.initial_equity_usd: float = 1_250_000.0
        self.paper_cash: Dict[str, float] = {
            "equities": 250_000.0,
            "crypto": 250_000.0,
        }
        self.paper_realized_pnl: Dict[str, float] = {
            "equities": 0.0,
            "crypto": 0.0,
        }
        self.paper_shares: Dict[str, Dict[str, float]] = {
            "equities": {},
            "crypto": {},
        }
        self.paper_avg_entry: Dict[str, Dict[str, float]] = {
            "equities": {},
            "crypto": {},
        }
        self.paper_orders: Dict[str, List[PaperOrderRecord]] = {
            "equities": [],
            "crypto": [],
        }
        self._init_paper_books()

    def _init_paper_books(self, mode: Optional[Literal["equities", "crypto"]] = None) -> None:
        """Initialize $1,000,000 invested positions + $250,000 cash buying power ($1,250,000 total)."""
        invested_capital = 1_000_000.0
        modes: List[Literal["equities", "crypto"]] = (
            [mode] if mode else ["equities", "crypto"]
        )
        for m in modes:
            self.paper_cash[m] = 250_000.0
            self.paper_realized_pnl[m] = 0.0
            prices = self.equities_prices if m == "equities" else self.crypto_prices
            weights = (
                {
                    "NVDA": 0.25,
                    "AAPL": 0.20,
                    "MSFT": 0.20,
                    "JPM": 0.15,
                    "GLD": 0.10,
                    "TLT": 0.10,
                }
                if m == "equities"
                else {
                    "BTC": 0.45,
                    "ETH": 0.30,
                    "SOL": 0.15,
                    "BNB": 0.10,
                }
            )
            self.paper_shares[m] = {}
            self.paper_avg_entry[m] = {}
            for ticker, w in weights.items():
                px = max(prices[ticker], 0.01)
                notional = invested_capital * w
                shares = round(notional / px, 4)
                self.paper_shares[m][ticker] = shares
                # Set initial avg entry slightly below current price (+1.8% unrealized gain)
                self.paper_avg_entry[m][ticker] = round(px * 0.982, 2)
            self._recompute_weights_from_positions(m)
            self.paper_orders[m] = [
                PaperOrderRecord(
                    order_id="ORD-INIT-01",
                    timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
                    ticker="NVDA" if m == "equities" else "BTC",
                    side="BUY",
                    order_type="MARKET",
                    quantity=self.paper_shares[m]["NVDA" if m == "equities" else "BTC"],
                    fill_price=self.paper_avg_entry[m]["NVDA" if m == "equities" else "BTC"],
                    notional_usd=round(
                        self.paper_shares[m]["NVDA" if m == "equities" else "BTC"]
                        * self.paper_avg_entry[m]["NVDA" if m == "equities" else "BTC"],
                        2,
                    ),
                    realized_pnl=0.0,
                    status="FILLED",
                    message="Initial portfolio allocation synced with live market feed",
                )
            ]

    def reset_paper_account(self, mode: Literal["equities", "crypto"] = "equities") -> PaperAccountState:
        self._init_paper_books(mode)
        return self.get_paper_account_state(mode)

    def _recompute_weights_from_positions(self, mode: Literal["equities", "crypto"]) -> None:
        prices = self.equities_prices if mode == "equities" else self.crypto_prices
        shares_map = self.paper_shares[mode]
        values = {t: max(shares_map.get(t, 0.0) * prices[t], 0.0) for t in prices}
        total_val = sum(values.values())
        target_weights = self.equities_weights if mode == "equities" else self.crypto_weights
        if total_val > 1e-6:
            for t in prices:
                target_weights[t] = round(values[t] / total_val, 4)
        else:
            n = len(prices)
            for t in prices:
                target_weights[t] = round(1.0 / n, 4)

    def start_background_tasks(self) -> None:
        try:
            loop = asyncio.get_running_loop()
            if self._binance_task is None or self._binance_task.done():
                self._binance_task = loop.create_task(self._binance_ws_loop())
            if self._live_poll_task is None or self._live_poll_task.done():
                self._live_poll_task = loop.create_task(self._live_market_poll_loop())
        except RuntimeError:
            pass

    async def fetch_yahoo_equities_once(self) -> bool:
        """Fetch real-time open-source Yahoo Finance chart quotes for NVDA, AAPL, MSFT, JPM, GLD, TLT."""
        updated_any = False
        async with httpx.AsyncClient(timeout=4.0, headers=HTTP_HEADERS, follow_redirects=True) as client:
            for ticker in self._eq_tickers:
                for url_tmpl in YAHOO_CHART_URLS:
                    url = url_tmpl.format(symbol=ticker)
                    try:
                        resp = await client.get(url)
                        if resp.status_code == 200:
                            data = resp.json()
                            result = (data.get("chart", {}).get("result") or [None])[0]
                            if result and "meta" in result:
                                meta = result["meta"]
                                regular_price = meta.get("regularMarketPrice")
                                prev_close = (
                                    meta.get("chartPreviousClose")
                                    or meta.get("previousClose")
                                    or self.equities_prev_close.get(ticker)
                                )
                                day_high = meta.get("regularMarketDayHigh")
                                day_low = meta.get("regularMarketDayLow")
                                day_vol = meta.get("regularMarketVolume")
                                if regular_price and float(regular_price) > 0:
                                    px = round(float(regular_price), 2)
                                    self.equities_prices[ticker] = px
                                    self.equities_anchor_prices[ticker] = px
                                    if prev_close and float(prev_close) > 0:
                                        self.equities_prev_close[ticker] = round(float(prev_close), 2)
                                    if day_high and float(day_high) > 0:
                                        self.equities_high[ticker] = round(float(day_high), 2)
                                    if day_low and float(day_low) > 0:
                                        self.equities_low[ticker] = round(float(day_low), 2)
                                    if day_vol and float(day_vol) >= 0:
                                        self.equities_volume[ticker] = float(day_vol)
                                    updated_any = True
                                    break
                    except Exception:
                        continue
        if updated_any:
            self.equities_live_connected = True
            self.last_live_sync = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            self._recompute_weights_from_positions("equities")
        return updated_any

    async def fetch_crypto_rest_once(self) -> bool:
        """Fetch real-time 24h crypto quotes from Binance public REST API or CoinGecko open API."""
        async with httpx.AsyncClient(timeout=4.0, headers=HTTP_HEADERS, follow_redirects=True) as client:
            for binance_url in BINANCE_REST_URLS:
                try:
                    symbols_param = json.dumps(list(SYMBOL_MAP.keys())).replace(" ", "")
                    resp = await client.get(f"{binance_url}?symbols={symbols_param}")
                    if resp.status_code == 200:
                        items = resp.json()
                        if isinstance(items, list) and len(items) > 0:
                            for item in items:
                                sym = item.get("symbol", "")
                                ticker = SYMBOL_MAP.get(sym)
                                if ticker:
                                    last_px = float(item.get("lastPrice", 0) or 0)
                                    open_px = float(item.get("openPrice", 0) or 0)
                                    high_px = float(item.get("highPrice", 0) or 0)
                                    low_px = float(item.get("lowPrice", 0) or 0)
                                    vol = float(item.get("volume", 0) or 0)
                                    if last_px > 0:
                                        self.crypto_prices[ticker] = round(last_px, 2)
                                        self.crypto_anchor_prices[ticker] = round(last_px, 2)
                                    if open_px > 0:
                                        self.crypto_prev_close[ticker] = round(open_px, 2)
                                    if high_px > 0:
                                        self.crypto_high[ticker] = round(high_px, 2)
                                    if low_px > 0:
                                        self.crypto_low[ticker] = round(low_px, 2)
                                    if vol > 0:
                                        self.crypto_volume[ticker] = vol
                            self.crypto_rest_connected = True
                            self.last_live_sync = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
                            self._recompute_weights_from_positions("crypto")
                            return True
                except Exception:
                    continue

            # CoinGecko fallback
            try:
                resp = await client.get(COINGECKO_SIMPLE_URL)
                if resp.status_code == 200:
                    data = resp.json()
                    for cg_id, ticker in COINGECKO_MAP.items():
                        entry = data.get(cg_id, {})
                        usd_px = entry.get("usd")
                        chg_24h = entry.get("usd_24h_change", 0.0)
                        if usd_px and float(usd_px) > 0:
                            px = round(float(usd_px), 2)
                            self.crypto_prices[ticker] = px
                            self.crypto_anchor_prices[ticker] = px
                            self.crypto_prev_close[ticker] = round(
                                px / (1.0 + float(chg_24h or 0.0) / 100.0), 2
                            )
                    self.crypto_rest_connected = True
                    self.last_live_sync = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
                    self._recompute_weights_from_positions("crypto")
                    return True
            except Exception:
                pass
        return False

    async def sync_live_market_now(self) -> Dict[str, bool]:
        """Force an immediate live poll of both Yahoo Finance Equities and Binance/CoinGecko Crypto."""
        eq_ok, cr_ok = await asyncio.gather(
            self.fetch_yahoo_equities_once(),
            self.fetch_crypto_rest_once(),
        )
        return {"equities_live": eq_ok, "crypto_live": cr_ok or self.binance_live_connected}

    async def _live_market_poll_loop(self) -> None:
        """Background loop polling open-source Yahoo Finance & Binance REST APIs every 6 seconds."""
        try:
            while True:
                try:
                    await self.fetch_yahoo_equities_once()
                    if not self.binance_live_connected:
                        await self.fetch_crypto_rest_once()
                except Exception:
                    pass
                await asyncio.sleep(6.0)
        except asyncio.CancelledError:
            return

    async def _binance_ws_loop(self) -> None:
        """Connect to Binance public multi-stream WebSocket when network is available."""
        try:
            import websockets  # type: ignore

            while True:
                try:
                    async with websockets.connect(
                        BINANCE_WS_URL,
                        open_timeout=3.0,
                        ping_interval=15.0,
                        close_timeout=2.0,
                    ) as ws:
                        self.binance_live_connected = True
                        async for raw_msg in ws:
                            data = json.loads(raw_msg)
                            payload = data.get("data", {})
                            raw_sym = payload.get("s", "")
                            price_str = payload.get("c")
                            open_str = payload.get("o")
                            high_str = payload.get("h")
                            low_str = payload.get("l")
                            vol_str = payload.get("v")
                            ticker = SYMBOL_MAP.get(raw_sym)
                            if ticker and price_str:
                                px = round(float(price_str), 2)
                                self.crypto_prices[ticker] = px
                                self.crypto_anchor_prices[ticker] = px
                                if open_str and float(open_str) > 0:
                                    self.crypto_prev_close[ticker] = round(float(open_str), 2)
                                if high_str and float(high_str) > 0:
                                    self.crypto_high[ticker] = round(float(high_str), 2)
                                if low_str and float(low_str) > 0:
                                    self.crypto_low[ticker] = round(float(low_str), 2)
                                if vol_str and float(vol_str) >= 0:
                                    self.crypto_volume[ticker] = float(vol_str)
                                self.last_live_sync = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
                except Exception:
                    self.binance_live_connected = False
                    await asyncio.sleep(5.0)
        except asyncio.CancelledError:
            self.binance_live_connected = False

    def get_feed_source_label(self, mode: Literal["equities", "crypto"]) -> str:
        if mode == "crypto":
            if self.binance_live_connected:
                return "LIVE_BINANCE_WS"
            if self.crypto_rest_connected:
                return "LIVE_BINANCE_REST"
            return "SIMULATED_FALLBACK"
        if self.equities_live_connected:
            return "LIVE_YAHOO_FINANCE"
        return "SIMULATED_FALLBACK"

    def step_tick(
        self,
        mode: Literal["equities", "crypto"] = "equities",
        volatility_multiplier: float = 1.0,
    ) -> List[AssetInput]:
        """Advance a 500ms market tick and return enriched AssetInput list."""
        dt_tick = 1.0 / (252.0 * 78.0)
        sqrt_dt = np.sqrt(dt_tick) * min(max(volatility_multiplier, 0.5), 3.0)
        feed_src = self.get_feed_source_label(mode)

        if mode == "crypto":
            if not self.binance_live_connected:
                z = self._rng.standard_normal(len(self._crypto_tickers))
                corr_z = z @ self._crypto_chol.T
                for i, t in enumerate(self._crypto_tickers):
                    vol = BASELINE_ANNUAL_VOL.get(t, 0.65)
                    # If REST live is connected, mean-revert tightly around the live REST anchor price
                    if self.crypto_rest_connected:
                        anchor = self.crypto_anchor_prices.get(t, self.crypto_prices[t])
                        jitter = float(corr_z[i]) * 0.00025
                        self.crypto_prices[t] = round(max(anchor * (1.0 + jitter), 0.01), 2)
                    else:
                        ret = corr_z[i] * vol * sqrt_dt
                        self.crypto_prices[t] = round(
                            max(self.crypto_prices[t] * (1.0 + float(ret)), 0.01), 2
                        )
            self._recompute_weights_from_positions("crypto")
            result: List[AssetInput] = []
            for t in self._crypto_tickers:
                px = self.crypto_prices[t]
                prev = self.crypto_prev_close.get(t, px)
                chg_pct = ((px - prev) / max(prev, 1e-6)) * 100.0
                spread = max(px * 0.0003, 0.01)
                result.append(
                    AssetInput(
                        ticker=t,
                        weight=self.crypto_weights[t],
                        price=px,
                        change_24h_pct=round(chg_pct, 2),
                        bid=round(px - spread, 2),
                        ask=round(px + spread, 2),
                        day_high=max(self.crypto_high.get(t, px), px),
                        day_low=min(self.crypto_low.get(t, px), px),
                        volume_24h=self.crypto_volume.get(t, 0.0),
                        feed_source=feed_src,
                    )
                )
            return result

        # Equities mode
        z = self._rng.standard_normal(len(self._eq_tickers))
        corr_z = z @ self._eq_chol.T
        for i, t in enumerate(self._eq_tickers):
            vol = BASELINE_ANNUAL_VOL.get(t, 0.25)
            if self.equities_live_connected:
                # Anchor tightly to live Yahoo Finance quote with micro order-book movement
                anchor = self.equities_anchor_prices.get(t, self.equities_prices[t])
                jitter = float(corr_z[i]) * 0.00018 * min(volatility_multiplier, 2.5)
                self.equities_prices[t] = round(max(anchor * (1.0 + jitter), 0.50), 2)
            else:
                ret = corr_z[i] * vol * sqrt_dt
                self.equities_prices[t] = round(
                    max(self.equities_prices[t] * (1.0 + float(ret)), 0.50), 2
                )

        self._recompute_weights_from_positions("equities")
        eq_result: List[AssetInput] = []
        for t in self._eq_tickers:
            px = self.equities_prices[t]
            prev = self.equities_prev_close.get(t, px)
            chg_pct = ((px - prev) / max(prev, 1e-6)) * 100.0
            spread = max(px * 0.0002, 0.01)
            eq_result.append(
                AssetInput(
                    ticker=t,
                    weight=self.equities_weights[t],
                    price=px,
                    change_24h_pct=round(chg_pct, 2),
                    bid=round(px - spread, 2),
                    ask=round(px + spread, 2),
                    day_high=max(self.equities_high.get(t, px), px),
                    day_low=min(self.equities_low.get(t, px), px),
                    volume_24h=self.equities_volume.get(t, 0.0),
                    feed_source=feed_src,
                )
            )
        return eq_result

    def execute_paper_order(self, req: PaperOrderRequest) -> PaperOrderRecord:
        """
        Execute a manual user BUY or SELL paper trade, updating cash, positions,
        realized/unrealized PnL, and live portfolio weights.
        """
        mode: Literal["equities", "crypto"] = req.feed_mode
        ticker = req.ticker.upper()
        prices = self.equities_prices if mode == "equities" else self.crypto_prices
        anchors = (
            self.equities_anchor_prices if mode == "equities" else self.crypto_anchor_prices
        )

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        order_id = f"ORD-{uuid.uuid4().hex[:6].upper()}"

        if ticker not in prices:
            rec = PaperOrderRecord(
                order_id=order_id,
                timestamp=now_str,
                ticker=ticker,
                side=req.side,
                order_type=req.order_type,
                quantity=0.0,
                fill_price=0.0,
                notional_usd=0.0,
                realized_pnl=0.0,
                status="REJECTED",
                message=f"Unknown ticker {ticker} for {mode} feed.",
            )
            self.paper_orders[mode].insert(0, rec)
            return rec

        mid_px = prices[ticker]
        spread = max(mid_px * 0.00025, 0.01)
        market_fill_px = round(mid_px + spread if req.side == "BUY" else mid_px - spread, 2)

        # Check limit order price constraint
        if req.order_type == "LIMIT" and req.limit_price is not None:
            if req.side == "BUY" and req.limit_price < market_fill_px:
                rec = PaperOrderRecord(
                    order_id=order_id,
                    timestamp=now_str,
                    ticker=ticker,
                    side=req.side,
                    order_type=req.order_type,
                    quantity=req.quantity or 0.0,
                    fill_price=req.limit_price,
                    notional_usd=0.0,
                    realized_pnl=0.0,
                    status="REJECTED",
                    message=(
                        f"Limit BUY price ${req.limit_price:.2f} is below current ask ${market_fill_px:.2f}."
                    ),
                )
                self.paper_orders[mode].insert(0, rec)
                return rec
            if req.side == "SELL" and req.limit_price > market_fill_px:
                rec = PaperOrderRecord(
                    order_id=order_id,
                    timestamp=now_str,
                    ticker=ticker,
                    side=req.side,
                    order_type=req.order_type,
                    quantity=req.quantity or 0.0,
                    fill_price=req.limit_price,
                    notional_usd=0.0,
                    realized_pnl=0.0,
                    status="REJECTED",
                    message=(
                        f"Limit SELL price ${req.limit_price:.2f} is above current bid ${market_fill_px:.2f}."
                    ),
                )
                self.paper_orders[mode].insert(0, rec)
                return rec

        fill_px = market_fill_px
        if req.quantity and req.quantity > 0:
            qty = round(float(req.quantity), 4)
        elif req.notional_usd and req.notional_usd > 0:
            qty = round(float(req.notional_usd) / fill_px, 4)
        else:
            qty = 0.0

        if qty <= 0:
            rec = PaperOrderRecord(
                order_id=order_id,
                timestamp=now_str,
                ticker=ticker,
                side=req.side,
                order_type=req.order_type,
                quantity=0.0,
                fill_price=fill_px,
                notional_usd=0.0,
                realized_pnl=0.0,
                status="REJECTED",
                message="Order quantity must be greater than zero.",
            )
            self.paper_orders[mode].insert(0, rec)
            return rec

        notional = round(qty * fill_px, 2)
        cur_shares = self.paper_shares[mode].get(ticker, 0.0)
        cur_avg = self.paper_avg_entry[mode].get(ticker, fill_px)
        cash = self.paper_cash[mode]

        if req.side == "BUY":
            if notional > cash + 1e-2:
                rec = PaperOrderRecord(
                    order_id=order_id,
                    timestamp=now_str,
                    ticker=ticker,
                    side="BUY",
                    order_type=req.order_type,
                    quantity=qty,
                    fill_price=fill_px,
                    notional_usd=notional,
                    realized_pnl=0.0,
                    status="REJECTED",
                    message=(
                        f"Insufficient buying power (${cash:,.2f} available vs ${notional:,.2f} required)."
                    ),
                )
                self.paper_orders[mode].insert(0, rec)
                return rec

            new_shares = round(cur_shares + qty, 4)
            new_avg = round(((cur_shares * cur_avg) + notional) / max(new_shares, 1e-6), 2)
            self.paper_cash[mode] = round(cash - notional, 2)
            self.paper_shares[mode][ticker] = new_shares
            self.paper_avg_entry[mode][ticker] = new_avg
            self._recompute_weights_from_positions(mode)

            rec = PaperOrderRecord(
                order_id=order_id,
                timestamp=now_str,
                ticker=ticker,
                side="BUY",
                order_type=req.order_type,
                quantity=qty,
                fill_price=fill_px,
                notional_usd=notional,
                realized_pnl=0.0,
                status="FILLED",
                message=f"Bought {qty:g} {ticker} @ ${fill_px:,.2f} (${notional:,.2f})",
            )
            self.paper_orders[mode].insert(0, rec)
            self.paper_orders[mode] = self.paper_orders[mode][:40]
            return rec

        # SELL side
        if qty > cur_shares + 1e-4:
            rec = PaperOrderRecord(
                order_id=order_id,
                timestamp=now_str,
                ticker=ticker,
                side="SELL",
                order_type=req.order_type,
                quantity=qty,
                fill_price=fill_px,
                notional_usd=notional,
                realized_pnl=0.0,
                status="REJECTED",
                message=(
                    f"Insufficient position size ({cur_shares:g} {ticker} held vs {qty:g} requested to sell)."
                ),
            )
            self.paper_orders[mode].insert(0, rec)
            return rec

        sell_qty = min(qty, cur_shares)
        notional = round(sell_qty * fill_px, 2)
        realized = round((fill_px - cur_avg) * sell_qty, 2)
        remaining_shares = round(max(cur_shares - sell_qty, 0.0), 4)

        self.paper_cash[mode] = round(cash + notional, 2)
        self.paper_realized_pnl[mode] = round(self.paper_realized_pnl[mode] + realized, 2)
        self.paper_shares[mode][ticker] = remaining_shares
        self._recompute_weights_from_positions(mode)

        rec = PaperOrderRecord(
            order_id=order_id,
            timestamp=now_str,
            ticker=ticker,
            side="SELL",
            order_type=req.order_type,
            quantity=sell_qty,
            fill_price=fill_px,
            notional_usd=notional,
            realized_pnl=realized,
            status="FILLED",
            message=(
                f"Sold {sell_qty:g} {ticker} @ ${fill_px:,.2f} "
                f"(Realized PnL: {'+' if realized >= 0 else ''}${realized:,.2f})"
            ),
        )
        self.paper_orders[mode].insert(0, rec)
        self.paper_orders[mode] = self.paper_orders[mode][:40]
        return rec

    def get_paper_account_state(
        self, mode: Literal["equities", "crypto"] = "equities"
    ) -> PaperAccountState:
        prices = self.equities_prices if mode == "equities" else self.crypto_prices
        prev_closes = (
            self.equities_prev_close if mode == "equities" else self.crypto_prev_close
        )
        weights = self.equities_weights if mode == "equities" else self.crypto_weights
        shares_map = self.paper_shares[mode]
        avg_map = self.paper_avg_entry[mode]
        feed_src = self.get_feed_source_label(mode)

        positions: List[PaperPosition] = []
        positions_value = 0.0
        unrealized_total = 0.0

        for ticker, px in prices.items():
            sh = shares_map.get(ticker, 0.0)
            avg_px = avg_map.get(ticker, px)
            mkt_val = round(sh * px, 2)
            positions_value += mkt_val
            unrl = round(sh * (px - avg_px), 2)
            unrealized_total += unrl
            unrl_pct = ((px - avg_px) / max(avg_px, 1e-6)) * 100.0 if sh > 0 else 0.0
            prev = prev_closes.get(ticker, px)
            day_chg = ((px - prev) / max(prev, 1e-6)) * 100.0
            spread = max(px * 0.00025, 0.01)

            positions.append(
                PaperPosition(
                    ticker=ticker,
                    shares=round(sh, 4),
                    avg_entry_price=round(avg_px, 2),
                    current_price=round(px, 2),
                    bid_price=round(px - spread, 2),
                    ask_price=round(px + spread, 2),
                    market_value=mkt_val,
                    weight=round(weights.get(ticker, 0.0), 4),
                    unrealized_pnl=unrl,
                    unrealized_pnl_pct=round(unrl_pct, 2),
                    day_change_pct=round(day_chg, 2),
                    feed_source=feed_src,
                )
            )

        cash = round(self.paper_cash[mode], 2)
        positions_value = round(positions_value, 2)
        total_equity = round(cash + positions_value, 2)
        realized = round(self.paper_realized_pnl[mode], 2)
        unrealized_total = round(unrealized_total, 2)
        total_pnl = round(realized + unrealized_total, 2)
        total_pnl_pct = round((total_pnl / self.initial_equity_usd) * 100.0, 2)

        return PaperAccountState(
            cash_balance=cash,
            positions_value=positions_value,
            total_equity=total_equity,
            initial_equity=self.initial_equity_usd,
            total_pnl=total_pnl,
            total_pnl_pct=total_pnl_pct,
            realized_pnl=realized,
            unrealized_pnl=unrealized_total,
            buying_power=cash,
            feed_mode=mode,
            feed_source=feed_src,
            last_live_sync=self.last_live_sync,
            positions=positions,
            order_history=self.paper_orders[mode],
        )

    def apply_instant_shock(
        self,
        ticker: str,
        shock_pct: float,
        mode: Literal["equities", "crypto"] = "equities",
    ) -> None:
        """Inject an instant price shock into a target asset for live replay demonstration."""
        t = ticker.upper()
        if mode == "crypto" and t in self.crypto_prices:
            new_px = round(max(self.crypto_prices[t] * (1.0 + shock_pct), 0.01), 2)
            self.crypto_prices[t] = new_px
            self.crypto_anchor_prices[t] = new_px
            self._recompute_weights_from_positions("crypto")
        elif t in self.equities_prices:
            new_px = round(max(self.equities_prices[t] * (1.0 + shock_pct), 0.50), 2)
            self.equities_prices[t] = new_px
            self.equities_anchor_prices[t] = new_px
            self._recompute_weights_from_positions("equities")


MARKET_STREAMER = DualModeMarketStreamer()
