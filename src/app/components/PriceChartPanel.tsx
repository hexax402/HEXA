"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Candle = {
  t: number; // index
  o: number;
  h: number;
  l: number;
  c: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCandles(seed = 402, count = 60, start = 180) {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let price = start;

  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.5) * 1.8;
    const vol = 0.6 + rand() * 1.4;

    const o = price;
    const c = Math.max(1, o + drift);
    const highWick = Math.max(o, c) + rand() * vol;
    const lowWick = Math.min(o, c) - rand() * vol;

    const h = Math.max(highWick, o, c);
    const l = Math.max(0.5, Math.min(lowWick, o, c));

    candles.push({ t: i, o, h, l, c });
    price = c;
  }

  return candles;
}

function drawChart(
  canvas: HTMLCanvasElement,
  candles: Candle[],
  theme: {
    up: string;
    down: string;
    grid: string;
    fg: string;
    bg: string;
    frame: string;
  }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  // background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  // plot area padding
  const padL = 18 * dpr;
  const padR = 12 * dpr;
  const padT = 14 * dpr;
  const padB = 18 * dpr;

  const pw = w - padL - padR;
  const ph = h - padT - padB;

  // frame
  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 1 * dpr;
  ctx.strokeRect(0.5 * dpr, 0.5 * dpr, w - 1 * dpr, h - 1 * dpr);

  // grid
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1 * dpr;
  ctx.globalAlpha = 1;

  const gridY = 4;
  for (let i = 1; i <= gridY; i++) {
    const y = padT + (ph * i) / (gridY + 1);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + pw, y);
    ctx.stroke();
  }

  // min/max
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    min = Math.min(min, c.l);
    max = Math.max(max, c.h);
  }
  const range = Math.max(1e-6, max - min);
  const yOf = (v: number) => padT + ph - ((v - min) / range) * ph;

  // candle sizing
  const n = candles.length;
  const step = pw / n;
  const bodyW = Math.max(2 * dpr, step * 0.58);

  // draw candles
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = padL + i * step + step * 0.5;

    const yO = yOf(c.o);
    const yC = yOf(c.c);
    const yH = yOf(c.h);
    const yL = yOf(c.l);

    const up = c.c >= c.o;

    // wick
    ctx.strokeStyle = up ? theme.up : theme.down;
    ctx.lineWidth = 1.25 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, yH);
    ctx.lineTo(x, yL);
    ctx.stroke();

    // body
    const top = Math.min(yO, yC);
    const bot = Math.max(yO, yC);
    const bh = Math.max(2 * dpr, bot - top);

    ctx.fillStyle = up ? theme.up : theme.down;
    ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
  }

  // last price line
  const last = candles[candles.length - 1]?.c ?? 0;
  const yLast = yOf(last);
  ctx.strokeStyle = theme.fg;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([6 * dpr, 6 * dpr]);
  ctx.beginPath();
  ctx.moveTo(padL, yLast);
  ctx.lineTo(padL + pw, yLast);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // label (top-left)
  ctx.fillStyle = theme.fg;
  ctx.font = `${12 * dpr}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  ctx.fillText("LIVE FEED", padL, 12 * dpr);
}

export default function PriceChartPanel({
  symbol = "SOL",
  seed = 402,
}: {
  symbol?: string;
  seed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const base = useMemo(() => generateCandles(seed, 60, 185), [seed]);
  const [candles, setCandles] = useState<Candle[]>(base);

  // animate: every 1.2s nudge the last candle & occasionally append
  useEffect(() => {
    let tick = 0;
    const rand = mulberry32(seed + 999);

    const id = window.setInterval(() => {
      tick++;
      setCandles((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];

        // mutate last candle slightly
        const drift = (rand() - 0.5) * 1.2;
        const nextC = Math.max(1, last.c + drift);
        const nextH = Math.max(last.h, nextC, last.o) + rand() * 0.35;
        const nextL = Math.min(last.l, nextC, last.o) - rand() * 0.35;

        copy[copy.length - 1] = {
          ...last,
          c: nextC,
          h: Math.max(nextH, nextC, last.o),
          l: Math.max(0.5, Math.min(nextL, nextC, last.o)),
        };

        // every ~3 ticks, append a new candle and drop the oldest
        if (tick % 3 === 0) {
          const p = copy[copy.length - 1].c;
          const drift2 = (rand() - 0.5) * 1.8;
          const vol = 0.7 + rand() * 1.2;
          const o = p;
          const c = Math.max(1, o + drift2);
          const h = Math.max(o, c) + rand() * vol;
          const l = Math.max(0.5, Math.min(o, c) - rand() * vol);

          copy.push({ t: (last.t ?? 0) + 1, o, h, l, c });
          while (copy.length > 60) copy.shift();
        }

        return copy;
      });
    }, 1200);

    return () => window.clearInterval(id);
  }, [seed]);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const theme = {
      up: "#0b0b0b", // black bodies look aggressive on white/red UI
      down: "#e60000", // red down candles
      grid: "rgba(0,0,0,0.08)",
      fg: "rgba(0,0,0,0.75)",
      bg: "rgba(255,255,255,0.9)",
      frame: "rgba(0,0,0,0.10)",
    };

    const rerender = () => drawChart(canvas, candles, theme);

    rerender();
    const ro = new ResizeObserver(() => rerender());
    ro.observe(canvas);

    return () => ro.disconnect();
  }, [candles]);

  const last = candles[candles.length - 1]?.c ?? 0;

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/60 p-5 shadow-[0_30px_120px_rgba(230,0,0,0.08)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-[0.18em] text-black/70">
          PRICE ACTION
        </div>
        <div className="text-xs text-black/50">
          last:{" "}
          <span className="font-mono font-semibold text-black/80">
            {last.toFixed(2)}
          </span>{" "}
          <span className="font-mono text-black/40">{symbol}</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(230,0,0,0.12),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(0,0,0,0.10),transparent_60%)]" />
        <div className="relative h-[240px] w-full">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <div className="text-xs font-semibold tracking-[0.18em] text-black/55">
            INTENSITY
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-black">
            {(Math.abs(last - candles[0].c) / 10).toFixed(2)}
          </div>
          <div className="text-xs text-black/45">vol proxy</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <div className="text-xs font-semibold tracking-[0.18em] text-black/55">
            SHOCK
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-black">
            {(Math.max(0, (candles[candles.length - 1].h - candles[candles.length - 1].l) / 3)).toFixed(2)}
          </div>
          <div className="text-xs text-black/45">event pressure</div>
        </div>
      </div>
    </div>
  );
}
