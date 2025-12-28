// In-memory engine shared across route handlers.
// Now reflects REAL enforcement by observing actual route responses,
// rather than simulating READY → 402 → UNLOCKED.
//
// - /api/command will "call" a real API route and update engine state.
// - /api/pay will log tx + mark UNLOCKED when session cookie is issued.

export type State = "READY" | "PAYMENT_REQUIRED" | "UNLOCKED";

export type Telemetry = {
  latencyMs: number;
  rps: number;
  unlocks: number;
  revenueK: number;
  intensity: number; // 0..1
  shock: number; // increments on activity
};

export type Fill = { id: string; t: string; sym: string; side: "BUY" | "SELL"; px: number; qty: number; route: string };
export type Position = { sym: string; side: "LONG" | "SHORT"; qty: number; avg: number; mark: number; uPnL: number };
export type Alert = { id: string; sev: "LOW" | "MED" | "HIGH"; msg: string; at: string };

function tsNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

class Engine {
  state: State = "READY";

  route = "/api/premium-data";
  price = "0.01 SOL";
  intentTtl = "90s";
  sessionTtl = "10m";

  telemetry: Telemetry = {
    latencyMs: 340,
    rps: 220,
    unlocks: 0,
    revenueK: 0,
    intensity: 0.46,
    shock: 1,
  };

  logs: string[] = [
    "boot: operator console online",
    "policy: edge enforcement enabled",
    `route: ${this.route} armed`,
    "stream: telemetry connected",
  ];

  alerts: Alert[] = [{ id: uid("a"), sev: "LOW", msg: "Route health nominal", at: tsNow() }];

  fills: Fill[] = [
    { id: uid("f"), t: tsNow(), sym: "SOL", side: "BUY", px: 186.12, qty: 40, route: this.route },
    { id: uid("f"), t: tsNow(), sym: "JTO", side: "SELL", px: 3.18, qty: 1400, route: "/api/alpha-feed" },
  ];

  positions: Position[] = [
    { sym: "SOL", side: "LONG", qty: 40, avg: 184.9, mark: 186.12, uPnL: +(40 * (186.12 - 184.9)).toFixed(2) },
    { sym: "JTO", side: "SHORT", qty: 1400, avg: 3.27, mark: 3.18, uPnL: +(1400 * (3.27 - 3.18)).toFixed(2) },
  ];

  private pushLog(s: string) {
    this.logs.push(s);
    if (this.logs.length > 24) this.logs = this.logs.slice(this.logs.length - 24);
  }

  private addAlert(sev: Alert["sev"], msg: string) {
    this.alerts.unshift({ id: uid("a"), sev, msg, at: tsNow() });
    if (this.alerts.length > 18) this.alerts = this.alerts.slice(0, 18);
  }

  private addFill(f: Omit<Fill, "id">) {
    this.fills.unshift({ ...f, id: uid("f") });
    if (this.fills.length > 20) this.fills = this.fills.slice(0, 20);
  }

  private reprice(kind: "tick" | "call") {
    const vol = kind === "call" ? (0.010 + this.telemetry.intensity * 0.014) : (0.004 + this.telemetry.intensity * 0.010);

    this.positions = this.positions.map((p) => {
      const dir = Math.random() > 0.5 ? 1 : -1;
      const drift = Math.random() * vol * dir;
      const mark = Math.max(0.000001, +(p.mark * (1 + drift)).toFixed(4));
      const uPnL =
        p.side === "LONG"
          ? +(p.qty * (mark - p.avg)).toFixed(2)
          : +(p.qty * (p.avg - mark)).toFixed(2);
      return { ...p, mark, uPnL };
    });
  }

  private jitter(kind: "tick" | "call") {
    const bump = kind === "call" ? 1.0 : 0.55;
    const t = this.telemetry;
    t.latencyMs = Math.max(120, Math.min(980, Math.round(t.latencyMs + bump * (Math.random() > 0.52 ? 32 : -26))));
    t.rps = Math.max(20, Math.min(1600, Math.round(t.rps + bump * (Math.random() > 0.5 ? 80 : -60))));
    t.revenueK = Math.max(0, +(t.revenueK + bump * (Math.random() > 0.55 ? 1.0 : 0.4)).toFixed(1));
    t.intensity = +Math.min(0.95, Math.max(0.22, t.intensity + (Math.random() - 0.48) * (0.10 + bump * 0.08))).toFixed(3);
    t.shock += 1;
    this.reprice(kind);
  }

  /** Realistic UI updates based on actual HTTP result */
  observeRouteResult(opts: { route: string; httpStatus: number; note?: string }) {
    const { route, httpStatus, note } = opts;

    if (httpStatus === 402) {
      this.state = "PAYMENT_REQUIRED";
      this.pushLog(`route: ${route} → 402 PAYMENT REQUIRED`);
      this.pushLog(`intent: amount=${this.price} ttl=${this.intentTtl}`);
      this.addAlert("HIGH", "Payment required — route is enforced");
      return;
    }

    if (httpStatus >= 200 && httpStatus < 300) {
      this.state = "UNLOCKED";
      this.telemetry.unlocks += 1;
      this.pushLog(`route: ${route} → ${httpStatus} OK (session valid)`);
      if (note) this.pushLog(note);
      this.addAlert("MED", "Session active — premium route unlocked");
      return;
    }

    // other errors
    this.pushLog(`route: ${route} → ${httpStatus} ERROR`);
    if (note) this.pushLog(note);
    this.addAlert("MED", `Route error — ${httpStatus}`);
  }

  /** Called by /api/pay on successful verification */
  onPaymentVerified(payload: { tx: string; paidLamports: number; exp: number }) {
    this.state = "UNLOCKED";
    this.telemetry.unlocks += 1;
    this.telemetry.revenueK = +(this.telemetry.revenueK + 0.1).toFixed(1); // cosmetic
    this.pushLog(`chain: payment verified tx=${payload.tx.slice(0, 10)}…`);
    this.pushLog(`session: issued ttl=${this.sessionTtl}`);
    this.addAlert("MED", "Receipt verified — session issued");
  }

  /** "call" now just produces a fill + telemetry jitter. The real call happens in /api/command via fetch(). */
  synthCall(route = this.route) {
    const sym = ["SOL", "JTO", "WIF", "PYTH"][Math.floor(Math.random() * 4)];
    const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
    const px =
      sym === "SOL" ? 180 + Math.random() * 18 :
      sym === "JTO" ? 3 + Math.random() * 0.5 :
      sym === "WIF" ? 1.8 + Math.random() * 0.7 :
      0.35 + Math.random() * 0.25;

    const qty = sym === "SOL" ? Math.round(10 + Math.random() * 80) : Math.round(200 + Math.random() * 2600);

    this.addFill({ t: tsNow(), sym, side, px: +px.toFixed(4), qty, route });
    this.jitter("call");
  }

  tick() {
    this.jitter("tick");
    this.pushLog("telemetry: tick");
    this.addAlert("LOW", "Telemetry updated");
  }

  risk() {
    const health = Math.max(0.06, 1 - (0.18 + this.telemetry.intensity * 0.52));
    this.pushLog(`risk: health=${Math.round(health * 100)}%`);
    this.addAlert(health < 0.22 ? "HIGH" : "MED", `Risk polled — health ${Math.round(health * 100)}%`);
  }

  flatten() {
    this.positions = [];
    this.pushLog("risk: flatten executed — all positions closed");
    this.addAlert("HIGH", "Flatten executed — all positions closed");
  }

  probe() {
    this.pushLog(`probe: ${this.route} reachable`);
    this.addAlert("LOW", "Probe executed — route reachable");
    this.jitter("tick");
  }

  clearLogs() {
    this.logs = ["boot: operator console online", "policy: edge enforcement enabled"];
    this.pushLog("logs: cleared");
  }

  clearAlerts() {
    this.alerts = [{ id: uid("a"), sev: "LOW", msg: "Queue cleared", at: tsNow() }];
  }

  triggerAlert() {
    this.addAlert("MED", "Operator alert — threshold trigger");
  }

  status() {
    const statusText =
      this.state === "UNLOCKED" ? "UNLOCKED" : this.state === "PAYMENT_REQUIRED" ? "PAYMENT REQUIRED" : "READY";
    return {
      state: this.state,
      statusText,
      route: this.route,
      price: this.price,
      intentTtl: this.intentTtl,
      sessionTtl: this.sessionTtl,
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __HADES_ENGINE__: Engine | undefined;
}

export function getEngine() {
  if (!globalThis.__HADES_ENGINE__) globalThis.__HADES_ENGINE__ = new Engine();
  return globalThis.__HADES_ENGINE__;
}
