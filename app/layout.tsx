import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "ConcertMatch – Euer nächstes Konzert",
 description: "Findet Konzerte, die euch zusammen gefallen. Musikgeschmack vergleichen, Neues entdecken und gemeinsam entscheiden.",
 icons: { icon: "/favicon.svg" },
 robots: { index: true, follow: true },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="de"><body>{children}</body></html>;
}
