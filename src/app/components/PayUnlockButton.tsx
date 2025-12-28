"use client";

import React, { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export default function PayUnlockButton() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const merchant = process.env.NEXT_PUBLIC_HADES_MERCHANT_PUBKEY || "6srqBeHmRHrUppik1F7vSfyWyRuHmhpQ13ZMpH2T7mVx";
  const priceLamports = Number(process.env.NEXT_PUBLIC_HADES_PRICE_LAMPORTS || "10000000");

  const merchantPk = useMemo(() => new PublicKey(merchant), [merchant]);

  async function pay() {
    try {
      setMsg("");
      if (!connected || !publicKey) {
        setMsg("Connect wallet first.");
        return;
      }

      setBusy(true);

      const ix = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: merchantPk,
        lamports: priceLamports,
      });

      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);

      setMsg(`Sent. Verifying… (${sig.slice(0, 8)}…)`);

      // Wait for chain confirm
      await connection.confirmTransaction(sig, "confirmed");

      // Ask server to verify + set session cookie
      const r = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature: sig }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(j?.error || "Payment verify failed.");
        return;
      }

      setMsg("UNLOCKED ✅ (session issued)");
    } catch (e: any) {
      setMsg(e?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={pay}
        disabled={busy}
        className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-red-700 disabled:opacity-60"
        style={{ letterSpacing: "0.14em" }}
      >
        {busy ? "PROCESSING…" : "PAY 0.01 SOL → UNLOCK"}
      </button>
      {msg ? <div className="text-xs font-semibold text-zinc-600">{msg}</div> : null}
    </div>
  );
}
