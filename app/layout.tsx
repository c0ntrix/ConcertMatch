import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ConcertMatch – Konzertsuche",
  description:
    "Konzerte nach Lieblingskünstlern, Suchort und Zeitraum suchen. Persönliche und gemeinsame Suche mit Merkliste.",
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
