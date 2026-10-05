import LegalBack from "../legal-back";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Impressum – ConcertMatch" };
export default function Impressum() {
  return (
    <main className="legal-content">
      <LegalBack />
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
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
        ConcertMatch hilft bei der persönlichen und gemeinsamen Konzertauswahl.
        Tickets werden ausschließlich über die verlinkten Veranstalter und
        Ticketanbieter erworben. ConcertMatch ist weder Veranstalter noch
        Ticketverkäufer. Maßgeblich sind die aktuellen Angaben des jeweiligen
        Anbieters.
      </p>
      <h2>Quellen</h2>
      <p>
        ConcertMatch nimmt am Reservix-Partnerprogramm über Awin teil. Bei
        vergütbaren Käufen über gekennzeichnete Werbelinks erhalten wir eine
        Provision. Die Konzertreihenfolge richtet sich nach musikalischer
        Passung. Bei mehreren Ticketangeboten zeigen wir Reservix zuerst.
      </p>
      <p>
        Konzertdaten und zugehörige Bilder:{" "}
        <a
          href="https://www.ticketmaster.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ticketmaster
        </a>
        sowie Reservix über den Awin-Veranstaltungsfeed und, nach Freischaltung,
        Eventfrog. Künstlerdaten und Musikstil-Zuordnungen: MusicBrainz /
        MetaBrainz, ergänzend Apple iTunes, Ticketmaster und eine eigene
        Startauswahl. Öffentliche Hörerzahlen: ListenBrainz. Optionale
        KI-Empfehlungen: Cloudflare Workers AI. Spotify-Importe werden als
        solche gekennzeichnet.
      </p>
      <nav className="legal-links" aria-label="Weitere Informationen">
        <a href="/datenschutz">Datenschutz</a>
        <a href="/methode">Matching erklärt</a>
      </nav>
    </main>
  );
}
