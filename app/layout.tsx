import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ConcertMatch – Dein nächstes Konzert",
  description:
    "Finde Konzerte, die zu deinem Musikgeschmack passen. Allein entdecken oder mit Freunden gemeinsame Favoriten finden.",
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
