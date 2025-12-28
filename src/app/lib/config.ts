export function getConfig() {
  const demo = (process.env.DEMO_MODE ?? "0") === "1";

  const cfg = {
    demoMode: demo,
    solanaCluster: process.env.SOLANA_CLUSTER ?? "devnet",
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    priceLamports: Number(process.env.PRICE_LAMPORTS ?? "10000000"),
    merchantPubkey: process.env.MERCHANT_PUBKEY ?? "",
    sessionSecret: process.env.SESSION_SECRET ?? "",
  };

  // Minimal safety checks for production
  if (!cfg.demoMode) {
    if (!cfg.sessionSecret || cfg.sessionSecret.length < 16) {
      throw new Error("SESSION_SECRET must be set (16+ chars) when DEMO_MODE=0");
    }
  }

  return cfg;
}
