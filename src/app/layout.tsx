import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "HEXA",
  description: "Solana x402 paywalled APIs with on-chain enforcement.",
  applicationName: "HEXA",
  openGraph: {
    title: "HEXA",
    description: "Solana x402 paywalled APIs with on-chain enforcement.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HEXA",
    description: "Solana x402 paywalled APIs with on-chain enforcement.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
