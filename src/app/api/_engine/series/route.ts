// src/app/api/series/route.ts
import { NextResponse } from "next/server";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

/**
 * Returns lightweight chart series for the UI.
 * Derives synthetic candles from engine telemetry so charts react to commands.
 */
export async function GET() {
  const e = getEngine();

  // Keep a tiny rolling series in-memory on the engine object (no schema changes)
  const anyE = e as any;

  if (!anyE.__series) {
    const base = 185;
    const now = Date.now();
    anyE.__series = {
      candles: Array.from({ length: 42 }).map((_, i) => {
        const t = now - (42 - i) * 60_000;
        const o = base + (Math.random() - 0.5) * 2.2;
        const c = o + (Math.random() - 0.5) * 2.6;
        const h = Math.max(o, c) + Math.random() * 1.4;
        const l = Math.min(o, c) - Math.random() * 1.4;
        return {
          t,
          o: +o.toFixed(3),
          h: +h.toFixed(3),
          l: +l.toFixed(3),
          c: +c.toFixed(3),
        };
      }),
      intensity: Array.from({ length: 64 }).map(() => +(0.25 + Math.random() * 0.55).toFixed(3)),
      shock: Array.from({ length: 64 }).map(() => Math.floor(1 + Math.random() * 6)),
    };
  }

  const s = anyE.__series as {
    candles: Array<{ t: number; o: number; h: number; l: number; c: number }>;
    intensity: number[];
    shock: number[];
  };

  // Move series gently based on engine telemetry/shock (reacts to commands)
  const last = s.candles[s.candles.length - 1];
  const k = Math.max(0.6, Math.min(1.8, 0.9 + e.telemetry.intensity)); // volatility factor

  const drift = (Math.random() - 0.5) * (1.8 * k);
  const o = last.c;
  const c = +(o + drift).toFixed(3);
  const h = +(Math.max(o, c) + Math.random() * (1.0 * k)).toFixed(3);
  const l = +(Math.min(o, c) - Math.random() * (1.0 * k)).toFixed(3);

  s.candles.push({ t: Date.now(), o: +o.toFixed(3), h, l, c });
  if (s.candles.length > 72) s.candles = s.candles.slice(s.candles.length - 72);

  s.intensity.push(+e.telemetry.intensity.toFixed(3));
  if (s.intensity.length > 96) s.intensity = s.intensity.slice(s.intensity.length - 96);

  s.shock.push(e.telemetry.shock);
  if (s.shock.length > 96) s.shock = s.shock.slice(s.shock.length - 96);

  return NextResponse.json({
    symbol: "SOL",
    candles: s.candles,
    intensity: s.intensity,
    shock: s.shock,
  });
}
