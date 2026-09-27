import type { Metadata } from "next";
export const metadata: Metadata = { title: "Impressum · ConcertMatch" };
export default function Impressum() {
  return (
    <main className="legal-content">
      <a className="back-link" href="/">
        ← Zur Konzertsuche
      </a>
      <h1>Impressum</h1>
      <h2>Angaben zum Anbieter</h2>
      <address>
        TiCore
        <br />
        Tilo Will
        <br />
        Hankhauser Weg 40
        <br />
        26180 Rastede
        <br />
        Deutschland
      </address>
      <h2>Kontakt</h2>
      <p>
        <a href="mailto:tilowill02@gmail.com">tilowill02@gmail.com</a>
      </p>
      <h2>Zum Angebot</h2>
      <p>
        ConcertMatch hilft bei der gemeinsamen Konzertauswahl. Tickets werden
        ausschließlich über die verlinkten Veranstalter und Ticketanbieter
        erworben. ConcertMatch ist weder Veranstalter noch Ticketverkäufer.
        Maßgeblich sind die aktuellen Angaben des jeweiligen Anbieters.
      </p>
      <h2>Quellen</h2>
      <p>
        Konzertdaten und zugehörige Bilder:{" "}
        <a
          href="https://www.ticketmaster.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ticketmaster
        </a>
        . Musikstil-Zuordnungen stammen aus dem Ticketmaster-Katalog und einer
        eigenen redaktionellen Startauswahl. Spotify-Importe werden als solche
        gekennzeichnet.
      </p>
      <p>
        <a href="/datenschutz">Datenschutz</a> ·{" "}
        <a href="/methode">Matching erklärt</a>
      </p>
    </main>
  );
}
