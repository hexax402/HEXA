"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

export default function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // prevent double-init (StrictMode)
    mountedRef.current = true;

    const container = containerRef.current;
    if (!container) return;

    // Clear container to avoid "loading..." forever if re-mounted
    container.innerHTML = "";

    const scriptId = "tradingview-widget-script";
    const existing = document.getElementById(scriptId);

    const init = () => {
      if (!window.TradingView || !containerRef.current) return;

      new window.TradingView.widget({
        autosize: true,
        symbol: "BINANCE:SOLUSDT",
        interval: "15",
        timezone: "Etc/UTC",
        theme: "light",
        style: "1",
        locale: "en",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        withdateranges: true,
        container_id: "tv_container_sol",
      });
    };

    // Ensure unique container id
    container.id = "tv_container_sol";

    if (existing) {
      // Script already loaded
      if (window.TradingView) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="h-[320px] w-full rounded-2xl border border-black/10 bg-white/70 p-3">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
