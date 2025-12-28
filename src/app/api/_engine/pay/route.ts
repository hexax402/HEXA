import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getEngine } from "../_engine/engine";

export const dynamic = "force-dynamic";

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signSession(payload: Record<string, any>) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET");

  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function POST(req: Request) {
  try {
    const { signature } = await req.json();
    const sig = String(signature || "").trim();
    if (!sig) {
      return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
    }

    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as
      | "devnet"
      | "testnet"
      | "mainnet-beta";

    const merchant = process.env.HADES_MERCHANT_PUBKEY;
    if (!merchant) {
      return NextResponse.json({ ok: false, error: "Missing HADES_MERCHANT_PUBKEY" }, { status: 500 });
    }

    const priceLamports = Number(process.env.HADES_PRICE_LAMPORTS || "10000000");
    const ttlMs = Number(process.env.HADES_SESSION_TTL_MS || "600000");

    const endpoint = clusterApiUrl(network);
    const connection = new Connection(endpoint, "confirmed");

    const merchantPk = new PublicKey(merchant);

    // Parsed tx makes it easy to read system transfers
    const tx = await connection.getParsedTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json(
        { ok: false, error: "Transaction not found (yet). Try again in a few seconds." },
        { status: 404 }
      );
    }

    if (tx.meta?.err) {
      return NextResponse.json({ ok: false, error: "Transaction failed", meta: tx.meta.err }, { status: 400 });
    }

    // Verify: must include a SystemProgram transfer to merchant >= priceLamports
    let paidLamports = 0;

    for (const ix of tx.transaction.message.instructions as any[]) {
      if (ix?.parsed?.type === "transfer") {
        const info = ix.parsed.info;
        const dest = String(info?.destination || "");
        const lamports = Number(info?.lamports || 0);

        if (dest === merchantPk.toBase58()) {
          paidLamports = Math.max(paidLamports, lamports);
        }
      }
    }

    if (paidLamports < priceLamports) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payment too small or not found",
          requiredLamports: priceLamports,
          detectedLamports: paidLamports,
          merchant: merchantPk.toBase58(),
        },
        { status: 402 }
      );
    }

    // Issue signed session cookie
    const exp = Date.now() + ttlMs;

    const token = signSession({
      v: 1,
      exp,
      network,
      merchant: merchantPk.toBase58(),
      paidLamports,
      tx: sig,
    });

    cookies().set({
      name: "hades_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.floor(ttlMs / 1000),
    });

    // ✅ Update in-memory engine so the UI immediately reflects unlock + tx
    const e = getEngine();
    e.onPaymentVerified({ tx: sig, paidLamports, exp });

    return NextResponse.json({ ok: true, exp, paidLamports, tx: sig });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
