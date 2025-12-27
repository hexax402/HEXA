"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type DemoState = "READY" | "PAYMENT_REQUIRED" | "UNLOCKED";
type Tab = "terminal" | "routes" | "depth" | "pipeline" | "docs";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** ---------- Inline icons (no deps) ---------- */
function Icon({
  d,
  className = "text-zinc-700",
  size = 16,
}: {
  d: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  );
}

const I = {
  lock: "M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Zm3 10.73V19h-2v-1.27a2 2 0 1 1 2 0Z",
  terminal:
    "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm4.2 4.4L10 12l-2.8 2.6 1.4 1.4L13 12 8.6 8 7.2 9.4ZM13 16h5v-2h-5v2Z",
  search:
    "M10 2a8 8 0 1 1 5.293 14.293l4.207 4.207-1.414 1.414-4.207-4.207A8 8 0 0 1 10 2Zm0 2a6 6 0 1 0 .001 12.001A6 6 0 0 0 10 4Z",
  arrow:
    "M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z",
};

function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "red" | "green" | "amber";
  children: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-red-500/25 bg-red-50 text-red-700"
      : tone === "green"
      ? "border-emerald-500/25 bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "border-amber-500/25 bg-amber-50 text-amber-700"
      : "border-zinc-200 bg-white text-zinc-700";
  const dot =
    tone === "red"
      ? "bg-red-500"
      : tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-zinc-400";
  return (
    <span
      className={cn("inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-semibold")}
      style={{ letterSpacing: "0.12em" }}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      <span className={cls}>{children}</span>
    </span>
  );
}

function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_70px_rgba(0,0,0,0.10)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_25%_0%,rgba(239,68,68,0.12),transparent_55%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div
          className="flex items-center gap-2 text-[11px] font-extrabold text-zinc-900"
          style={{ letterSpacing: "0.22em" }}
        >
          <span className="inline-block h-2 w-2 rounded-sm bg-red-600 shadow-[0_0_18px_rgba(239,68,68,0.45)]" />
          {title}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DarkWell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-900/10 bg-zinc-950 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Kv({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold text-zinc-500" style={{ letterSpacing: "0.12em" }}>
        {k}
      </div>
      <div className="mt-0.5 text-sm font-extrabold text-zinc-900">{v}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
      <div className="text-[10px] font-semibold text-zinc-400" style={{ letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div className="text-sm font-extrabold text-white">{value}</div>
    </div>
  );
}

/** ---------------- TradingView-ish charts ---------------- */

type Candle = { t: number; o: number; h: number; l: number; c: number };

function Sparkline({ values, height = 54 }: { values: number[]; height?: number }) {
  const w = 240;
  const h = height;
  const pad = 6;
  const v = (values?.length ? values : [0.3, 0.35, 0.33, 0.4, 0.38]).slice(-64);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;

  const pts = v
    .map((x, i) => {
      const px = pad + (i * (w - pad * 2)) / (v.length - 1 || 1);
      const py = pad + (1 - (x - min) / span) * (h - pad * 2);
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(239,68,68,0.45)" />
          <stop offset="1" stopColor="rgba(239,68,68,0.02)" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="rgba(239,68,68,0.95)" strokeWidth="2" points={pts} />
      <polygon fill="url(#sp)" points={`${pts} ${w - pad},${h - pad} ${pad},${h - pad}`} />
    </svg>
  );
}

function Candles({ candles, height = 180 }: { candles: Candle[]; height?: number }) {
  const w = 260;
  const h = height;
  const pad = 10;
  const data = (candles?.length ? candles : []).slice(-36);

  const lo = data.length ? Math.min(...data.map((c) => c.l)) : 0;
  const hi = data.length ? Math.max(...data.map((c) => c.h)) : 1;
  const span = hi - lo || 1;

  const cw = data.length ? (w - pad * 2) / data.length : (w - pad * 2) / 36;

  function y(px: number) {
    return pad + (1 - (px - lo) / span) * (h - pad * 2);
  }

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block">
      <rect x="0" y="0" width={w} height={h} fill="rgba(0,0,0,0.55)" rx="14" />
      <g opacity="0.25">
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={pad + (i * (h - pad * 2)) / 4}
            y2={pad + (i * (h - pad * 2)) / 4}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </g>

      {!data.length ? (
        <text x="50%" y="50%" fill="rgba(255,255,255,0.65)" fontSize="12" textAnchor="middle">
          loading…
        </text>
      ) : (
        data.map((c, i) => {
          const x = pad + i * cw + cw * 0.18;
          const bw = cw * 0.64;

          const up = c.c >= c.o;
          const bodyTop = y(Math.max(c.o, c.c));
          const bodyBot = y(Math.min(c.o, c.c));
          const wickTop = y(c.h);
          const wickBot = y(c.l);

          const col = up ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)";
          const body = up ? "rgba(16,185,129,0.55)" : "rgba(239,68,68,0.55)";

          return (
            <g key={c.t}>
              <line x1={x + bw / 2} x2={x + bw / 2} y1={wickTop} y2={wickBot} stroke={col} strokeWidth="2" opacity="0.9" />
              <rect
                x={x}
                y={Math.min(bodyTop, bodyBot)}
                width={bw}
                height={Math.max(2, Math.abs(bodyBot - bodyTop))}
                fill={body}
                stroke={col}
                strokeWidth="1"
                rx="2"
              />
            </g>
          );
        })
      )}
    </svg>
  );
}

/** ---------------- Data types + fetch helpers ---------------- */

type Telemetry = { latencyMs: number; rps: number; unlocks: number; revenueK: number; intensity: number; shock: number };
type Fill = { id: string; t: string; sym: string; side: "BUY" | "SELL"; px: number; qty: number; route: string };
type Position = { sym: string; side: "LONG" | "SHORT"; qty: number; avg: number; mark: number; uPnL: number };
type Status = { state: DemoState; statusText: string; route: string; price: string; sessionTtl: string; intentTtl: string };
type Series = { symbol: string; candles: Candle[]; intensity: number[]; shock: number[] };

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpost<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("terminal");

  // server-backed state
  const [status, setStatus] = useState<Status | null>(null);
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [fills, setFills] = useState<Fill[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Array<{ id: string; sev: "LOW" | "MED" | "HIGH"; msg: string; at: string }>>([]);
  const [series, setSeries] = useState<Series | null>(null);

  // UI
  const [copied, setCopied] = useState(false);
  const [cmd, setCmd] = useState("");
  const [cmdOpen, setCmdOpen] = useState(true);
  const cmdRef = useRef<HTMLInputElement | null>(null);

  // polling (real data flow)
  useEffect(() => {
    let alive = true;

    async function pullAll() {
      try {
        const [s, t, f, p, l, a, sr] = await Promise.all([
          jget<Status>("/api/status"),
          jget<Telemetry>("/api/telemetry"),
          jget<Fill[]>("/api/fills"),
          jget<Position[]>("/api/positions"),
          jget<string[]>("/api/logs"),
          jget<Array<{ id: string; sev: "LOW" | "MED" | "HIGH"; msg: string; at: string }>>("/api/alerts"),
          jget<Series>("/api/series"),
        ]);
        if (!alive) return;
        setStatus(s);
        setTele(t);
        setFills(f);
        setPositions(p);
        setLogs(l);
        setAlerts(a);
        setSeries(sr);
      } catch {
        // keep last-known state
      }
    }

    pullAll();
    const id = window.setInterval(pullAll, 1200);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        runCmd("call /api/premium-data");
      }
      if (e.key === "`") {
        e.preventDefault();
        setCmdOpen((x) => !x);
        setTimeout(() => cmdRef.current?.focus(), 50);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusTone = useMemo(() => {
    if (!status) return "neutral" as const;
    return status.state === "UNLOCKED"
      ? ("green" as const)
      : status.state === "PAYMENT_REQUIRED"
      ? ("red" as const)
      : ("neutral" as const);
  }, [status]);

  const oneLiner = useMemo(
    () =>
      `Hades x402 — Paywalled APIs with on-chain enforcement\n\n• Deterministic 402 → Pay → Unlock\n• Receipt verification + TTL sessions\n• Edge enforcement + audit-friendly logs\n• Operator-grade console UI`,
    []
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(oneLiner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    } catch {}
  }

  async function runCmd(input: string) {
    const line = input.trim();
    if (!line) return;
    setCmd("");
    try {
      await jpost("/api/command", { cmd: line });
      // polling will reflect changes
    } catch (e: any) {
      console.error(e);
    }
  }

  const totalUPnL = useMemo(() => positions.reduce((a, p) => a + p.uPnL, 0), [positions]);
  const grossNotional = useMemo(() => positions.reduce((a, p) => a + Math.abs(p.qty * p.mark), 0), [positions]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <style jsx global>{`
        :root {
          color-scheme: light;
        }
        @keyframes cursorBlink {
          0%,
          48% {
            opacity: 1;
          }
          49%,
          100% {
            opacity: 0;
          }
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, rgba(239,68,68,0.30) 0, transparent 35%), radial-gradient(circle at 78% 22%, rgba(239,68,68,0.22) 0, transparent 40%), radial-gradient(circle at 50% 70%, rgba(0,0,0,0.10) 0, transparent 46%)",
          }}
        />
        <div className="absolute -top-64 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-red-500/20 blur-[120px]" />
        <div className="absolute top-[38%] right-[-260px] h-[560px] w-[560px] rounded-full bg-red-500/12 blur-[150px]" />
        <div className="absolute bottom-[-260px] left-[-260px] h-[560px] w-[560px] rounded-full bg-zinc-900/10 blur-[170px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/55 to-white" />
      </div>

      <div className="relative mx-auto max-w-[1750px] px-5 pb-24 pt-6">
        {/* Top bar */}
        <div className="relative flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.10)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
              <Icon d={I.lock} className="text-red-600" />
              <div className="leading-tight">
                <div className="text-[10px] font-semibold text-zinc-500" style={{ letterSpacing: "0.12em" }}>
                  SOLANA x402 ENFORCEMENT
                </div>
                <div className="text-xs font-extrabold text-zinc-900" style={{ letterSpacing: "0.18em" }}>
                  HADES PROTOCOL
                </div>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Pill tone="red">EDGE POLICY: ACTIVE</Pill>
              <Pill tone={statusTone}>STATE: {status?.statusText ?? "LOADING"}</Pill>
              <span className="mx-2 h-5 w-px bg-zinc-200" />
              <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-700" style={{ letterSpacing: "0.12em" }}>
                <span>
                  LAT <span className="font-extrabold text-zinc-900">{tele?.latencyMs ?? "—"}ms</span>
                </span>
                <span>
                  RPS <span className="font-extrabold text-zinc-900">{tele?.rps ?? "—"}</span>
                </span>
                <span>
                  UNLOCKS <span className="font-extrabold text-zinc-900">{tele?.unlocks ?? "—"}</span>
                </span>
                <span>
                  REV <span className="font-extrabold text-zinc-900">${tele?.revenueK ?? "—"}k</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://x.com/LatchProtocol"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
              style={{ letterSpacing: "0.12em" }}
            >
              X <Icon d={I.arrow} className="text-zinc-700" />
            </a>
            <a
              href="https://github.com/latchprotocol/latch-protocol"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
              style={{ letterSpacing: "0.12em" }}
            >
              GITHUB <Icon d={I.arrow} className="text-zinc-700" />
            </a>
            <button
              onClick={copyText}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
              style={{ letterSpacing: "0.12em" }}
            >
              {copied ? "COPIED" : "COPY ONE-LINER"}
            </button>
          </div>
        </div>

        {/* Layout */}
        <section className="mt-5 grid gap-5 lg:grid-cols-12">
          {/* Left nav */}
          <div className="lg:col-span-3">
            <Panel title="NAVIGATION" right={<Pill tone="neutral">LIVE</Pill>} className="sticky top-6">
              <div className="grid gap-2">
                {(
                  [
                    ["terminal", "TERMINAL"],
                    ["routes", "ROUTES"],
                    ["depth", "DEPTH"],
                    ["pipeline", "PIPELINE"],
                    ["docs", "DOCS"],
                  ] as Array<[Tab, string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left text-xs font-extrabold",
                      tab === k
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    )}
                    style={{ letterSpacing: "0.16em" }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Kv k="PRIMARY ROUTE" v={status?.route ?? "/api/premium-data"} sub="enforced" />
                <Kv k="PRICE" v={status?.price ?? "0.01 SOL"} sub="per unlock window" />
                <Kv k="INTENT TTL" v={status?.intentTtl ?? "90s"} sub="quote window" />
                <Kv k="SESSION TTL" v={status?.sessionTtl ?? "10m"} sub="unlock window" />
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-[11px] font-extrabold text-zinc-900" style={{ letterSpacing: "0.18em" }}>
                  RISK SNAPSHOT
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Kv k="GROSS" v={`$${Math.round(grossNotional / 1000)}k`} sub="notional" />
                  <Kv k="uPNL" v={`${totalUPnL >= 0 ? "+" : ""}${Math.round(totalUPnL)}$`} sub="unrealized" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => runCmd("risk")}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    CHECK RISK
                  </button>
                  <button
                    onClick={() => runCmd("flatten")}
                    className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    FLATTEN
                  </button>
                </div>
              </div>
            </Panel>
          </div>

          {/* Main center */}
          <div className="lg:col-span-6">
            <Panel
              title="OPERATOR CONSOLE"
              right={
                <div className="flex items-center gap-2">
                  <Pill tone="amber">HOTKEY: Ctrl+L</Pill>
                  <Pill tone={statusTone}>{status?.statusText ?? "LOADING"}</Pill>
                </div>
              }
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                    <Icon d={I.terminal} className="text-red-600" />
                    Production enforcement surface + operator-grade visibility
                  </div>

                  <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                    402 enforcement that ships
                    <br />
                    <span className="text-red-600">like a real terminal</span>.
                  </h1>

                  <p className="mt-4 text-sm leading-6 text-zinc-700">
                    Policy-driven access. Receipt verification. TTL unlock windows. Audit-friendly events. This UI is wired to a backend
                    engine today — and the engine is designed to swap in your receipt verifier and Solana RPC without changing the UX.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => runCmd("call /api/premium-data")}
                      className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-red-700"
                      style={{ letterSpacing: "0.14em" }}
                    >
                      EXECUTE CALL
                    </button>
                    <button
                      onClick={() => runCmd("tick")}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                      style={{ letterSpacing: "0.14em" }}
                    >
                      TICK
                    </button>
                    <button
                      onClick={() => setTab("pipeline")}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                      style={{ letterSpacing: "0.14em" }}
                    >
                      VIEW PIPELINE
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Kv k="CHAIN" v="SOLANA" sub="receipt verification" />
                    <Kv k="EDGE" v="ENFORCED" sub="policy active" />
                    <Kv k="INTENT" v="SIGNED" sub="payment intent" />
                    <Kv k="SESSION" v="TTL" sub="unlock window" />
                    <Kv k="ROUTE" v={status?.route ?? "/api/premium-data"} sub="primary" />
                    <Kv k="PRICE" v={status?.price ?? "0.01 SOL"} sub="per window" />
                    <Kv k="INTENT TTL" v={status?.intentTtl ?? "90s"} sub="quote" />
                    <Kv k="SESSION TTL" v={status?.sessionTtl ?? "10m"} sub="unlock" />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-extrabold text-zinc-900" style={{ letterSpacing: "0.22em" }}>
                        HEALTH
                      </div>
                      <Pill tone={statusTone}>{status?.statusText ?? "LOADING"}</Pill>
                    </div>

                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-950 p-3">
                      <div className="grid grid-cols-4 gap-2">
                        <MiniStat label="LAT" value={`${tele?.latencyMs ?? "—"}ms`} />
                        <MiniStat label="RPS" value={`${tele?.rps ?? "—"}`} />
                        <MiniStat label="UNLOCKS" value={`${tele?.unlocks ?? "—"}`} />
                        <MiniStat label="REV" value={`$${tele?.revenueK ?? "—"}k`} />
                      </div>
                      <div className="mt-3 text-[11px] font-semibold text-zinc-300">
                        Depth intensity:{" "}
                        <span className="font-extrabold text-white">{tele?.intensity?.toFixed(2) ?? "—"}</span> • Shock:{" "}
                        <span className="font-extrabold text-white">{tele?.shock ?? "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-extrabold text-zinc-900" style={{ letterSpacing: "0.22em" }}>
                        POSITIONS SNAPSHOT
                      </div>
                      <Pill tone="neutral">{positions.length ? "LIVE" : "FLAT"}</Pill>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                      <div
                        className="grid grid-cols-12 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-extrabold text-zinc-700"
                        style={{ letterSpacing: "0.12em" }}
                      >
                        <div className="col-span-3">SYM</div>
                        <div className="col-span-3">SIDE</div>
                        <div className="col-span-3">QTY</div>
                        <div className="col-span-3 text-right">uPNL</div>
                      </div>
                      <div className="max-h-[220px] overflow-auto">
                        {positions.length === 0 ? (
                          <div className="p-4 text-sm font-semibold text-zinc-600">No open positions.</div>
                        ) : (
                          positions.map((p) => (
                            <div key={p.sym} className="grid grid-cols-12 px-3 py-2 text-sm hover:bg-zinc-50">
                              <div className="col-span-3 font-extrabold">{p.sym}</div>
                              <div className="col-span-3">
                                <span
                                  className={cn(
                                    "rounded-xl border px-2 py-1 text-[11px] font-extrabold",
                                    p.side === "LONG"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-red-200 bg-red-50 text-red-800"
                                  )}
                                  style={{ letterSpacing: "0.10em" }}
                                >
                                  {p.side}
                                </span>
                              </div>
                              <div className="col-span-3 text-zinc-700">{p.qty}</div>
                              <div
                                className={cn(
                                  "col-span-3 text-right font-extrabold",
                                  p.uPnL >= 0 ? "text-emerald-700" : "text-red-700"
                                )}
                              >
                                {p.uPnL >= 0 ? "+" : ""}
                                {p.uPnL.toFixed(0)}$
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Kv k="GROSS" v={`$${Math.round(grossNotional / 1000)}k`} sub="notional" />
                      <Kv k="uPNL" v={`${totalUPnL >= 0 ? "+" : ""}${Math.round(totalUPnL)}$`} sub="unrealized" />
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Tabs */}
            <div className="mt-5">
              {tab === "terminal" && (
                <Panel title="LIVE LOGS" right={<Pill tone="neutral">AUDIT</Pill>}>
                  <DarkWell className="p-3 font-mono text-[11px] leading-5">
                    <div className="text-zinc-400">event stream</div>
                    <div className="mt-2">
                      {logs.map((l, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-zinc-200">{l}</span>
                        </div>
                      ))}
                    </div>
                  </DarkWell>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => runCmd("probe")}
                      className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      RUN PROBE
                    </button>
                    <button
                      onClick={() => runCmd("clear logs")}
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      CLEAR
                    </button>
                  </div>
                </Panel>
              )}

              {tab === "routes" && (
                <Panel title="ROUTES" right={<Pill tone="neutral">EDGE</Pill>}>
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div
                      className="grid grid-cols-12 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] font-extrabold text-zinc-700"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      <div className="col-span-5">ROUTE</div>
                      <div className="col-span-2">METHOD</div>
                      <div className="col-span-2">PRICE</div>
                      <div className="col-span-3 text-right">STATE</div>
                    </div>
                    {[
                      {
                        route: "/api/premium-data",
                        method: "GET",
                        price: status?.price ?? "0.01 SOL",
                        st: status?.statusText ?? "READY",
                      },
                      { route: "/api/alpha-feed", method: "GET", price: "0.02 SOL", st: "READY" },
                      { route: "/api/metrics", method: "POST", price: "0.03 SOL", st: "READY" },
                      { route: "/api/export", method: "GET", price: "0.05 SOL", st: "READY" },
                    ].map((r) => (
                      <div key={r.route} className="grid grid-cols-12 px-4 py-3 text-sm text-zinc-900 hover:bg-zinc-50">
                        <div className="col-span-5 font-mono text-[12px] font-extrabold text-zinc-900">{r.route}</div>
                        <div className="col-span-2">
                          <span
                            className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] font-extrabold text-zinc-700"
                            style={{ letterSpacing: "0.12em" }}
                          >
                            {r.method}
                          </span>
                        </div>
                        <div className="col-span-2 text-zinc-700">{r.price}</div>
                        <div className="col-span-3 flex justify-end">
                          <Pill tone={r.st === "UNLOCKED" ? "green" : r.st.includes("PAYMENT") ? "red" : "neutral"}>
                            {r.st}
                          </Pill>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => runCmd("call /api/premium-data")}
                      className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-red-700"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      CALL /api/premium-data
                    </button>
                    <button
                      onClick={() => setTab("docs")}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      INTEGRATION
                    </button>
                  </div>
                </Panel>
              )}

              {tab === "depth" && (
                <Panel title="DEPTH" right={<Pill tone="neutral">LIVE</Pill>}>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <Icon d={I.search} className="text-red-600" />
                      <div className="text-[11px] font-semibold text-zinc-600" style={{ letterSpacing: "0.10em" }}>
                        Depth is driven by server telemetry intensity & shock
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-[12px] text-zinc-100">
                      intensity={tele?.intensity?.toFixed(3) ?? "—"} • shock={tele?.shock ?? "—"} • press Ctrl+L to generate on-chain gated flow
                    </div>
                  </div>
                </Panel>
              )}

              {tab === "pipeline" && (
                <Panel title="PIPELINE" right={<Pill tone={statusTone}>{status?.statusText ?? "LOADING"}</Pill>}>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-extrabold text-zinc-900">Enforcement lifecycle</div>
                    <div className="mt-2 text-sm text-zinc-700">
                      Request → Edge Policy → Payment Required (if no valid receipt) → Receipt Verified → Session Issued → Route Unlock
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <Kv k="EDGE POLICY" v="ACTIVE" />
                      <Kv k="INTENT TTL" v={status?.intentTtl ?? "90s"} />
                      <Kv k="SESSION TTL" v={status?.sessionTtl ?? "10m"} />
                      <Kv k="STATE" v={status?.statusText ?? "LOADING"} />
                    </div>
                  </div>
                </Panel>
              )}

              {tab === "docs" && (
                <Panel title="INTEGRATION" right={<Pill tone="neutral">READY</Pill>}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-zinc-900" style={{ letterSpacing: "0.12em" }}>
                        SERVER CONTRACT
                      </div>
                      <DarkWell className="mt-3 p-3 font-mono text-[11px] leading-5">
                        {"POST /api/command\n"}
                        {"cmd=call|tick|risk|flatten|probe\n\n"}
                        {"GET /api/status\n"}
                        {"GET /api/telemetry\n"}
                        {"GET /api/fills\n"}
                        {"GET /api/positions\n"}
                        {"GET /api/logs\n"}
                        {"GET /api/alerts\n"}
                        {"GET /api/series\n"}
                      </DarkWell>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-zinc-900" style={{ letterSpacing: "0.12em" }}>
                        NEXT STEP (REAL RECEIPTS)
                      </div>
                      <div className="mt-3 text-sm text-zinc-700 leading-6">
                        Replace the engine’s <span className="font-extrabold">receipt verifier</span> with your real Solana receipt check.
                        The UI stays unchanged — only the server enforcement logic is swapped.
                      </div>
                    </div>
                  </div>
                </Panel>
              )}
            </div>

            {/* Fills + Alerts */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Panel title="FILL TAPE" right={<Pill tone="neutral">T+0</Pill>}>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  <div
                    className="grid grid-cols-12 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-extrabold text-zinc-700"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    <div className="col-span-2">TIME</div>
                    <div className="col-span-2">SYM</div>
                    <div className="col-span-2">SIDE</div>
                    <div className="col-span-2">PX</div>
                    <div className="col-span-2">QTY</div>
                    <div className="col-span-2 text-right">ROUTE</div>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    {fills.map((f) => (
                      <div key={f.id} className="grid grid-cols-12 px-3 py-2 text-sm hover:bg-zinc-50">
                        <div className="col-span-2 font-mono text-[12px] text-zinc-700">{f.t}</div>
                        <div className="col-span-2 font-extrabold">{f.sym}</div>
                        <div className="col-span-2">
                          <span
                            className={cn(
                              "rounded-xl border px-2 py-1 text-[11px] font-extrabold",
                              f.side === "BUY"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-red-200 bg-red-50 text-red-800"
                            )}
                            style={{ letterSpacing: "0.10em" }}
                          >
                            {f.side}
                          </span>
                        </div>
                        <div className="col-span-2 font-mono text-[12px] text-zinc-700">{f.px.toFixed(4)}</div>
                        <div className="col-span-2 text-zinc-700">{f.qty}</div>
                        <div className="col-span-2 text-right font-mono text-[12px] text-zinc-600">{f.route}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => runCmd("call /api/premium-data")}
                    className="flex-1 rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    EXECUTE CALL
                  </button>
                  <button
                    onClick={() => runCmd("tick")}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    TICK
                  </button>
                </div>
              </Panel>

              <Panel title="ALERTS" right={<Pill tone="neutral">QUEUE</Pill>}>
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="mt-2 max-h-[340px] overflow-auto">
                    {alerts.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          "mb-2 rounded-2xl border p-3 last:mb-0",
                          a.sev === "HIGH"
                            ? "border-red-200 bg-red-50"
                            : a.sev === "MED"
                            ? "border-amber-200 bg-amber-50"
                            : "border-zinc-200 bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-extrabold text-zinc-700" style={{ letterSpacing: "0.14em" }}>
                            {a.at}
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] font-extrabold",
                              a.sev === "HIGH"
                                ? "border-red-200 bg-white text-red-700"
                                : a.sev === "MED"
                                ? "border-amber-200 bg-white text-amber-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700"
                            )}
                            style={{ letterSpacing: "0.12em" }}
                          >
                            {a.sev}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-extrabold text-zinc-900">{a.msg}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => runCmd("trigger alert")}
                    className="flex-1 rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    TRIGGER
                  </button>
                  <button
                    onClick={() => runCmd("clear alerts")}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    CLEAR
                  </button>
                </div>
              </Panel>
            </div>

            <footer className="relative mt-10 flex flex-col gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
              <div>© {new Date().getFullYear()} Hades Protocol — x402 enforcement console.</div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-extrabold text-zinc-800"
                  style={{ letterSpacing: "0.12em" }}
                >
                  Ctrl+L execute
                </span>
                <span
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-extrabold text-zinc-800"
                  style={{ letterSpacing: "0.12em" }}
                >
                  ` cmd bar
                </span>
              </div>
            </footer>
          </div>

          {/* Right charts column */}
          <div className="lg:col-span-3">
            <div className="sticky top-6 grid gap-5">
              <Panel title="CHART • SOL" right={<Pill tone="neutral">{series?.symbol ?? "SOL"}</Pill>}>
                <div className="rounded-2xl border border-zinc-200 bg-white p-2">
                  <div className="mb-2 flex items-center justify-between px-2">
                    <div className="text-[11px] font-extrabold text-zinc-900" style={{ letterSpacing: "0.14em" }}>
                      PRICE ACTION
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-600">
                      last:{" "}
                      <span className="font-extrabold text-zinc-900">
                        {series?.candles?.length ? series.candles[series.candles.length - 1].c.toFixed(3) : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl">
                    <Candles candles={series?.candles ?? []} height={190} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Kv k="INTENSITY" v={(tele?.intensity ?? 0).toFixed(2)} sub="vol proxy" />
                  <Kv k="SHOCK" v={String(tele?.shock ?? "—")} sub="event pressure" />
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => runCmd("call /api/premium-data")}
                    className="flex-1 rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    PUMP FLOW
                  </button>
                  <button
                    onClick={() => runCmd("probe")}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    PROBE
                  </button>
                </div>
              </Panel>

              <Panel title="CHART • INTENSITY" right={<Pill tone="neutral">{tele?.intensity?.toFixed(2) ?? "—"}</Pill>}>
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <Sparkline values={series?.intensity ?? []} height={70} />
                  <div className="mt-2 text-[11px] font-semibold text-zinc-600">
                    Engine volatility proxy. Spikes on <span className="font-extrabold text-zinc-900">CALL</span> and{" "}
                    <span className="font-extrabold text-zinc-900">PROBE</span>.
                  </div>
                </div>
              </Panel>

              <Panel title="CHART • SHOCK" right={<Pill tone="neutral">{tele?.shock ?? "—"}</Pill>}>
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <Sparkline values={series?.shock ?? []} height={70} />
                  <div className="mt-2 text-[11px] font-semibold text-zinc-600">
                    Incrementing event pressure. Helps sell “this is alive”.
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom command bar */}
      {cmdOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-zinc-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-[1750px] px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-zinc-800" style={{ letterSpacing: "0.18em" }}>
                <Icon d={I.terminal} className="text-red-600" />
                COMMAND LINE
              </div>
              <button
                onClick={() => setCmdOpen(false)}
                className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50"
                style={{ letterSpacing: "0.12em" }}
              >
                HIDE
              </button>
            </div>

            <div className="mt-2">
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-3">
                <span className="font-mono text-[12px] font-extrabold text-red-600">&gt;</span>
                <input
                  ref={cmdRef}
                  value={cmd}
                  onChange={(e) => setCmd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runCmd(cmd);
                    if (e.key === "Escape") setCmd("");
                  }}
                  placeholder="call /api/premium-data | tick | risk | flatten | probe | clear logs"
                  className="w-full bg-transparent font-mono text-[12px] font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
                />
                <span className="h-4 w-px bg-zinc-200" />
                <span className="font-mono text-[12px] text-zinc-500" style={{ animation: "cursorBlink 1s infinite" }}>
                  █
                </span>
                <button
                  onClick={() => runCmd(cmd)}
                  className="ml-2 rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700"
                  style={{ letterSpacing: "0.12em" }}
                >
                  RUN
                </button>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-zinc-600">
                Tip: press <span className="font-extrabold text-zinc-900">Ctrl+L</span> for a forced gated call,{" "}
                <span className="font-extrabold text-zinc-900">`</span> to toggle this bar.
              </div>
            </div>
          </div>
        </div>
      )}

      {!cmdOpen && (
        <button
          onClick={() => {
            setCmdOpen(true);
            setTimeout(() => cmdRef.current?.focus(), 50);
          }}
          className="fixed bottom-4 right-4 z-[95] rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-extrabold text-zinc-900 shadow-[0_25px_90px_rgba(0,0,0,0.14)] hover:bg-zinc-50"
          style={{ letterSpacing: "0.12em" }}
        >
          OPEN CMD BAR (`)
        </button>
      )}
    </main>
  );
}
