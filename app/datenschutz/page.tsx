import type { Metadata } from "next";
import PrivacyControls from "./privacy-controls";
export const metadata: Metadata = { title: "Datenschutz · ConcertMatch" };
export default function Datenschutz() {
  return (
    <main className="legal-content">
      <a className="back-link" href="/">
        ← Zur Konzertsuche
      </a>
      <h1>Datenschutz</h1>
      <p>Stand: 30. September 2026</p>
      <h2>Verantwortlich</h2>
      <p>
        TiCore, Tilo Will, Hankhauser Weg 40, 26180 Rastede, Deutschland.
        Kontakt: <a href="mailto:tilowill02@gmail.com">tilowill02@gmail.com</a>.
      </p>
      <h2>Was wir für eure Konzertsuche speichern</h2>
      <p>
        Wir speichern die von euch gewählten Namen (Pseudonyme sind möglich),
        Künstler und Musikrichtungen sowie Gruppen, Suchort, Suchfilter,
        gemerkte Konzerte und Stimmen. Die Verarbeitung dient der von euch
        angefragten Funktion (Art. 6 Abs. 1 lit. b DSGVO). Wir erstellen keine
        öffentlichen Profile und verwenden die Auswahl nicht für Werbung.
      </p>
      <p>
        Wir verwenden ein technisch notwendiges Cookie namens{" "}
        <code>cm_session</code>, um diesen Browser deinen eigenen Profilen
        zuzuordnen. Es enthält einen zufälligen Schlüssel, ist für JavaScript
        nicht lesbar und hat eine Laufzeit von 180 Tagen. Serverseitig wird nur
        dessen Hash verwendet. Die Speicherung ist für den ausdrücklich
        gewünschten Dienst erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Ohne dieses
        Cookie können wir keine dauerhaft nutzbare Gruppe zuordnen.
      </p>
      <h2>Wer die Angaben sehen kann</h2>
      <p>
        Die Mitglieder deiner Gruppe sehen eure Namen, Künstler, Filter,
        Merkliste und Abstimmungen. Wer einen gültigen Einladungslink hat, kann
        der Gruppe beitreten. Gib den Link deshalb nur an gewünschte Teilnehmer
        weiter. Es gibt keine öffentliche Gruppensuche. Gruppenmitglieder können
        gemeinsame Filter und die Merkliste ändern, aber nur ihre eigenen
        Profile und Stimmen bearbeiten.
      </p>
      <h2>Import von Hörverläufen</h2>
      <p>
        Ausgewählte Spotify-JSON-Dateien werden ausschließlich im
        Arbeitsspeicher deines Browsers verarbeitet. Die vollständigen Dateien,
        einzelne Wiedergaben, Zeitstempel, Geräteinformationen und
        gegebenenfalls enthaltene IP-Adressen werden nicht an ConcertMatch
        hochgeladen. Nur die Künstlerauswahl wird nach deiner Bestätigung als
        Profil gespeichert. Du kannst sie vorher ändern.
      </p>
      <p>
        Wenn eine direkte Spotify-Verbindung angeboten wird und du sie
        aktivierst, lesen wir mit deiner Zustimmung deine Top-Künstler der
        vergangenen Monate. Es werden keine E-Mail-Adressen, privaten Playlists
        oder Wiedergabesteuerung angefordert. Zugangstoken werden nur für den
        unmittelbaren Abruf verwendet und nicht gespeichert. Die noch
        unbestätigte Auswahl wird höchstens zehn Minuten zwischengespeichert. Du
        kannst den Zugriff in den{" "}
        <a
          href="https://www.spotify.com/account/apps/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Spotify-App-Einstellungen
        </a>{" "}
        widerrufen. Anbieter: Spotify AB, Schweden;{" "}
        <a
          href="https://www.spotify.com/legal/privacy-policy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Spotify-Datenschutz
        </a>
        .
      </p>
      <h2>Künstlersuche und Musikdaten</h2>
      <p>
        Für die Künstlersuche und zur Ergänzung musikalischer Stilrichtungen
        übermittelt unser Server eingegebene Künstlernamen an MusicBrainz
        (MetaBrainz Foundation), bei Ausfällen an Apples iTunes-Suche. Für
        öffentlich verfügbare Hörerzahlen werden Künstlerkennungen an
        ListenBrainz (MetaBrainz Foundation) gesendet. Es werden dabei keine
        Gruppennamen, Browserkennungen, Kontaktangaben oder Zuordnungen zu
        Personen übermittelt. Dies dient der von euch angeforderten Suche und
        Empfehlung. Öffentliche Künstlerdaten speichern wir bis zu sieben Tage
        zwischen. Mehr Informationen:{" "}
        <a href="https://metabrainz.org/privacy">MetaBrainz-Datenschutz</a> und{" "}
        <a href="https://www.apple.com/legal/privacy/">Apple-Datenschutz</a>.
      </p>
      <h2>Musikalische Empfehlungen mit KI</h2>
      <p>
        Für die vertiefte Empfehlung verarbeitet Cloudflare Workers AI die
        gewählten Künstler und Genres je Profil sowie eine Auswahl tatsächlicher
        Konzert-Line-ups. Profil- und Gruppennamen, Kontaktangaben,
        Browserkennungen und Suchort werden nicht in die Modellanfrage
        aufgenommen. Die Verarbeitung dient eurer angefragten gemeinsamen
        Konzertempfehlung (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern
        Bewertungen und Begründungen für eure Gruppe bis zu 24 Stunden zwischen;
        beim Entfernen eines Profils oder Löschen der Gruppe werden sie
        gelöscht. Cloudflare verwendet die Inhalte laut seinen Bedingungen nicht
        zum Modelltraining ohne ausdrückliche Zustimmung. Mehr dazu:{" "}
        <a href="https://developers.cloudflare.com/workers-ai/platform/data-usage/">
          Workers AI und eure Daten
        </a>
        .
      </p>
      <h2>Konzertdaten und externe Links</h2>
      <p>
        Unser Server ruft Konzertdaten von Ticketmaster ab. Dabei werden
        Suchort, Umkreis, Zeitraum und gegebenenfalls ein eingegebener
        Künstlername übermittelt, aber keine Gruppennamen, Teilnehmerlisten oder
        vollständigen Musikprofile. Konzertbilder werden über unseren Server
        geladen. Beim Öffnen eines Ticket- oder Spotify-Links verlässt du
        ConcertMatch; dann gelten die Bedingungen des jeweiligen Anbieters.{" "}
        <a
          href="https://www.ticketmaster.de/help/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ticketmaster-Datenschutz
        </a>
        .
      </p>
      <h2>Hosting und technische Sicherheit</h2>
      <p>
        Der Dienst wird bei Cloudflare, Inc., 101 Townsend St, San Francisco, CA
        94107, USA, bereitgestellt. Technisch erforderliche Verbindungsdaten,
        insbesondere IP-Adresse und Zeitpunkt eines Aufrufs, werden dabei zur
        Auslieferung und Absicherung verarbeitet. ConcertMatch nutzt kurzzeitig
        gehashte Kennungen für Anfragelimits. Grundlage hierfür ist unser
        berechtigtes Interesse an einem sicheren, verfügbaren Dienst (Art. 6
        Abs. 1 lit. f DSGVO).
      </p>
      <p>
        Cloudflare kann Daten auch außerhalb der EU verarbeiten. Informationen
        zu Datenschutz und Übermittlungsmechanismen findest du bei{" "}
        <a
          href="https://www.cloudflare.com/privacypolicy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cloudflare
        </a>
        . Wir setzen keine eigenen Analyse- oder Werbetracker ein.
      </p>
      <h2>Speicherdauer</h2>
      <p>
        Eine Gruppe ist 90 Tage nach Erstellung nicht mehr zugänglich.
        Abgelaufene Gruppen und ihre Inhalte werden bei folgenden Dienstaufrufen
        automatisch bereinigt. Du kannst eigene Profile früher entfernen; die
        erstellende Person kann die ganze Gruppe löschen. Temporäre
        Autorisierungsdaten verfallen nach zehn Minuten, Konzert-Suchdaten in
        der Regel nach 15 Minuten, Künstler-Suchergebnisse nach 24 Stunden.
        Sicherheitszähler verfallen je nach Limit nach wenigen Sekunden bis zu
        einem Tag und werden beim nächsten Bereinigungslauf entfernt.
        Speicherfristen technischer Plattformprotokolle werden durch die
        Hostinganbieter bestimmt.
      </p>
      <h2>Deine Daten verwalten</h2>
      <p>
        Diese Aktionen betreffen die mit diesem Browser verbundenen Profile. Bei
        einem Gerätewechsel oder nach dem Löschen der Cookies ist diese
        Zuordnung nicht mehr verfügbar. Du kannst dich dann mit dem Gruppennamen
        und weiteren Angaben zur Zuordnung per E-Mail an uns wenden.
      </p>
      <PrivacyControls />
      <h2>Deine Rechte</h2>
      <p>
        Du hast im gesetzlichen Rahmen Rechte auf Auskunft, Berichtigung,
        Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Gegen
        Verarbeitungen auf Grundlage berechtigter Interessen kannst du
        Widerspruch einlegen. Eine erteilte Einwilligung kannst du mit Wirkung
        für die Zukunft widerrufen. Du kannst dich bei einer
        Datenschutzaufsichtsbehörde beschweren, insbesondere bei der{" "}
        <a
          href="https://lfd.niedersachsen.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          Landesbeauftragten für den Datenschutz Niedersachsen
        </a>
        .
      </p>
      <p>
        <a href="/impressum">Impressum</a> ·{" "}
        <a href="/methode">Matching erklärt</a>
      </p>
    </main>
  );
}
