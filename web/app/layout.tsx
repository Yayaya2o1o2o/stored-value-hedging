import type { Metadata } from "next";
import { Newsreader, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Hedge-Ratio Optimization Under Uncertain Redemption Demand",
  description:
    "A dynamic hedge-ratio optimization model for consumer-facing stored-value products: research paper, simulation results, and an interactive optimizer.",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/model", label: "Interactive model" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profitability", label: "Profitability" },
  { href: "/results", label: "Results" },
  { href: "/paper", label: "Paper" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${sourceSerif.variable} ${plexMono.variable} min-h-screen antialiased`}
      >
        <header className="border-b border-hairline">
          <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-4">
            <Link href="/" className="eyebrow !text-ink hover:!text-terra">
              Stored-Value Hedging
            </Link>
            <nav className="flex gap-5">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="font-mono text-xs tracking-wide text-ink-soft hover:text-terra"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-20 border-t border-hairline">
          <div className="mx-auto max-w-4xl px-5 py-8">
            <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
              Working paper &amp; simulation artifact · July 2026 · Synthetic
              data calibrated to the prepaid-instrument literature; no company
              or commodity affiliation. Model code (Python) and all results
              accompany the paper.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
