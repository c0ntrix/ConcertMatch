import LegalBack from "../legal-back";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Wie das Matching funktioniert – ConcertMatch",
};
export default function Methode() {
  return (
    <main className="legal-content">
      <LegalBack />
      <h1>Wie die Konzertsuche funktioniert</h1>
      <p>
        ConcertMatch findet Konzerte für deinen Musikgeschmack. Du kannst allein
        suchen oder mit bis zu sieben weiteren Personen gemeinsame Favoriten
        finden.
      </p>
      <h2>Künstler und Suchfilter</h2>
      <p>
        Wählt ein paar Lieblingskünstler aus dem Musikkatalog oder fügt eine
        Liste mit Namen ein. Drei bis fünf Künstler sind ein guter Start. Falls
        ihr bereits einen Spotify-Datenexport habt, könnt ihr ihn zusätzlich
        importieren. Jede Person kann über den Einladungslink selbst mitmachen.
        Ihr könnt auch mehrere Profile an einem Gerät anlegen. Ein einzelnes
        Profil reicht für eine persönliche Suche. Wenn später jemand dazukommt,
        bleiben Suchort und Merkliste erhalten; die Empfehlungen werden für
        euren gemeinsamen Musikgeschmack neu berechnet.
      </p>
      <h2>So entstehen Matchpunkte</h2>
      <p>
        Wir vergleichen jeden auftretenden Künstler mit jeder Person in der
        Gruppe. Ein Lieblingskünstler bringt dieser Person 100 Punkte. Die
        schnelle Suche nutzt Favoriten und automatisch ergänzte Musikstile. Wenn
        ihr vor dem Start „Erweiterte KI-Suche“ einschaltet, beurteilt
        zusätzlich ein Sprachmodell musikalische Nähe, Klang, Szene und Energie
        für jede Person separat. Die Ergebnisse erscheinen nach dem
        vollständigen Abgleich und werden nicht später umsortiert. Diese
        Einschätzung berücksichtigt bis zu 50 Favoriten pro Profil und bis zu
        360 verschiedene Konzert-Line-ups, innerhalb einer begrenzten
        Anfragegröße. Bei sehr langen Eingaben fällt die Auswahl kleiner aus.
        Das Modell bewertet 16 geeignete Line-ups, sofern so viele verfügbar
        sind. Tourtermine desselben Line-ups teilen diese Einschätzung. Eine
        Bewertung kann auch eine geringe Passung ergeben. Weitere Konzerte
        behalten ihren Abgleich nach Favoriten und Musikstilen. Ohne
        Modellbewertung: Passende Grundrichtungen wie Pop oder Hip-Hop bringen
        höchstens 40 Punkte. Gemeinsame konkrete Stile wie Emo-Rap bringen bis
        zu 82 Punkte. Wir berücksichtigen die gesamte Künstlerauswahl einer
        Person: Die beste stilistische Verbindung zählt zu 60 %, der
        Durchschnitt aller Verbindungen zu 40 %. Nebensächliche Genre-Tags
        zählen weniger als prägende Stilrichtungen. Support-Acts erhalten bei
        stilistischen Empfehlungen ein geringeres Gewicht als der erste
        angekündigte Act. Fehlen passende oder ausreichende Daten, gibt es 0
        Punkte – das heißt nicht, dass euch die Musik nicht gefallen könnte.
      </p>
      <p className="method-formula">
        Gruppenwert = 65 % niedrigster Einzelwert + 35 % Durchschnitt
      </p>
      <p>
        Ein Beispiel: Ein Konzert mit 100 und 0 Punkten bekommt zusammen 18
        Punkte. Ein Konzert, das für beide bei 70 liegt, bekommt 70 Punkte. So
        dominiert niemand die gemeinsame Auswahl. Bei einer Person entspricht
        der angezeigte Wert ihrer persönlichen Passung.
      </p>
      <h2>KI-Bewertungen und neue Künstler</h2>
      <p>
        Ein Künstler ist „neu für euch“, wenn er in keiner eurer Auswahlen
        vorkommt. Seine Musikrichtungen können trotzdem gut passen. Diese
        Empfehlungen beruhen auf musikalischen Metadaten und dem Wissen des
        Sprachmodells Llama 4 Scout bei Cloudflare Workers AI, wenn ihr die
        KI-Suche wählt. Die KI sieht auch Konzertkandidaten ohne passende
        Genre-Tags; sie ist nicht auf die bereits angezeigten Treffer
        beschränkt. Es werden keine Audiodateien analysiert und keine Termine
        vom Modell erzeugt. Im aufklappbaren Ergebnis steht die Einschätzung für
        jede Person.
      </p>
      <p>
        Breite Genres können ungenau sein. Ein Indie-Label allein sagt wenig
        über die Energie einer Liveshow. Hört deshalb kurz rein und nutzt eure
        Abstimmung. Matchpunkte sind keine Prozentwahrscheinlichkeit.
      </p>
      <p>
        Modellwerte reichen bis 92 Punkte; bei unsicherem Wissen höchstens bis
        45. Das Modell kann sich irren. Ist die erweiterte KI-Suche momentan
        nicht verfügbar, zeigen wir die Ergebnisse nach Favoriten und
        Musikstilen mit einem entsprechenden Hinweis. Die zusätzliche Suche
        dauert länger. Eure Favoriten bleiben unabhängig davon berücksichtigt.
      </p>
      <h2>Bekannte und weniger bekannte Künstler</h2>
      <p>
        Bei vergleichbarer musikalischer Passung bevorzugen wir bekannte Acts.
        Dafür verwenden wir verfügbare Hörerzahlen der ListenBrainz-Community
        des zuerst angekündigten Acts ohne Sonderbonus für einzelne
        Künstlerlisten. Dieser Sortierbonus beträgt höchstens 20 Punkte und
        verändert die angezeigten Matchpunkte nicht. Eine deutlich passendere
        kleine Band kann deshalb vor einem großen Act stehen. Ohne musikalische
        Gemeinsamkeit wird ein Termin nicht allein wegen seiner Bekanntheit
        empfohlen.
      </p>
      <p>
        Die Hörerzahlen sind keine weltweiten Spotify-Zahlen. Unbekannte Werte
        bedeuten nicht, dass ein Künstler keine Fans hat. Wir ergänzen Genres
        und Künstlerkennungen aus MusicBrainz, soweit sie eindeutig zugeordnet
        werden können. Nicht jedes Konzert hat solche Daten. VIP-Upgrades und
        doppelte Angebote derselben Show blenden wir aus.
      </p>
      <p>
        Bei Entdeckungen braucht jede Person mindestens 30 Matchpunkte und damit
        eine grundlegende musikalische Passung. Sonst zeigen wir das Konzert
        nicht als gemeinsame Entdeckung an. Bereits gewählte Favoriten bleiben
        auch mit unterschiedlicher Passung sichtbar.
      </p>
      <h2>Künstler aus Spotify auswählen</h2>
      <p>
        Öffne in der Spotify-App über dein Profilbild die Hörstatistiken, sofern
        sie bei dir verfügbar sind. Dort kannst du deine Top-Künstler nachsehen.
        Du kannst mehrere Namen auf einmal bei uns einfügen. Ein Datenexport ist
        für die Konzertsuche nicht nötig.
      </p>
      <h2>Spotify-Hörverlauf importieren</h2>
      <p>
        Standard- und erweiterte Spotify-Hörverläufe werden als ZIP oder
        einzelne Audio-JSON-Dateien direkt in eurem Browser ausgewertet, auch
        aus mehreren Jahren. Die letzten zwölf Monate und 20 Künstler sind
        vorausgewählt. Ihr könnt einzelne Jahre oder den gesamten Verlauf und
        10, 20, 30 oder 50 Künstler wählen. Wir sortieren nach Hörzeit und
        lassen Podcasts, Hörbücher, Videos und Wiedergaben unter 30 Sekunden
        weg. Mehr Künstler sind nicht automatisch besser: Selten gehörte Acts
        können euren Geschmack verwässern. Ihr bestätigt und bearbeitet die
        Auswahl selbst. Der direkte Spotify-Import ist optional und nur
        verfügbar, wenn die Anbindung freigeschaltet ist.
      </p>
      <h2>Datenquellen</h2>
      <p>
        Künstlerdaten: <a href="https://musicbrainz.org/">MusicBrainz</a>, bei
        Ausfällen ergänzend <a href="https://music.apple.com/">Apple iTunes</a>.
        Hörerzahlen: <a href="https://listenbrainz.org/">ListenBrainz</a>.
        Konzerttermine: Ticketmaster und, nach Freischaltung, Eventfrog. Die
        Metadaten werden zwischengespeichert und können lückenhaft oder veraltet
        sein.
      </p>
      <h2>Welche Konzerte sind enthalten?</h2>
      <p>
        Wir durchsuchen den Ticketmaster-Katalog im gewählten Umkreis bis zu
        1.000 km Luftlinie, auch über Landesgrenzen hinweg. Startorte liegen
        derzeit in Deutschland. Clubshows und andere Ticketanbieter sind nicht
        vollständig abgedeckt. Bei sehr vielen Terminen berücksichtigen wir bis
        zu 800 nach Ticketmaster-Relevanz sortierte Termine im gewählten
        Zeitraum. Bei mehr Terminen durchsuchen wir zusätzlich bis zu vier
        getrennte Zeitabschnitte mit jeweils bis zu 800 Terminen. So können
        weitere Konzerte erscheinen; eine vollständige Abdeckung ist weiterhin
        nicht garantiert. Zusätzlich suchen wir gezielt nach bis zu acht
        Favoriten, abwechselnd aus euren Profilen. Zusätzlich laden wir bis zu
        600 Termine für jede der drei am besten vertretenen Musikrichtungen
        eurer Gruppe. Dadurch verdrängen große allgemeine Kategorien nicht alle
        passenden Acts. Tourtermine erscheinen gemeinsam in einem Treffer: Über
        „Termine & Orte“ wählt ihr den konkreten Termin für Tickets und
        Merkliste. Die Auswahl bleibt begrenzt; fehlende Treffer bedeuten nicht,
        dass es keine Tour gibt.
      </p>
      <p>
        Entfernungen sind Luftlinien ab dem Zentrum des gewählten Startorts,
        keine Fahrstrecken und keine Entfernung von deiner Adresse. Bei
        Konzerten im selben Ort steht deshalb nur „in Hamburg“ beziehungsweise
        euer Startort. Preise erscheinen, wenn der Anbieter sie meldet. Gebühren
        und Verfügbarkeit können abweichen. Prüft deshalb den verlinkten
        Originaltermin vor einer Buchung.
      </p>
      <p>
        Der Ticketmaster-Katalog enthält auch Links zu TicketWeb und anderen
        Ticketplattformen. Ein Verkaufsstatus ist keine Bestätigung verfügbarer
        Tickets: Ausverkaufte Termine können weiterhin im Katalog stehen.
      </p>
      <h2>Merkliste und Abstimmung</h2>
      <p>
        Reservix ergänzt die Suche mit Konzertangeboten aus unserem täglich
        aktualisierten Partnerfeed. Der Feed enthält nicht immer ein bestätigtes
        Künstler-Line-up; dann nutzen wir die gemeldeten Musikrichtungen und
        erfinden keine Künstlernamen. Bei einer länger ausbleibenden
        Aktualisierung blenden wir den Feed vorübergehend aus. Verfügbarkeit und
        Preise bestätigt der Ticketanbieter. Über Reservix-Werbelinks können wir
        bei vergütbaren Käufen eine Provision erhalten. Diese verändert die
        Matchpunkte und die Konzertreihenfolge nicht. Bei mehreren
        Ticketangeboten steht Reservix zuerst.
      </p>
      <p>
        Merkt euch interessante Konzerte. Auf der Merkliste könnt ihr pro Person
        „Bin dabei“, „Vielleicht“ oder „Eher nicht“ wählen. Bei deiner
        persönlichen Suche ist die Merkliste für dich; erst durch Hinzufügen
        oder Einladen einer Person entsteht eine gemeinsame Auswahl. Ein
        Kalendereintrag merkt den Tag vor; Uhrzeit und Änderungen bestätigt der
        Ticketanbieter.
      </p>
      <h2>Datenschutz und Speicherung</h2>
      <p>
        Es gibt kein öffentliches Profil und keine Personensuche. Der
        Einladungslink öffnet eure Runde, also teilt ihn gezielt. Die Gruppe
        läuft nach 90 Tagen ab. Der Browser merkt eure Berechtigung über ein
        notwendiges Cookie. Löscht ihr dieses Cookie, braucht ihr einen neuen
        Einladungslink und legt gegebenenfalls ein neues Profil an.
      </p>
      <nav className="legal-links" aria-label="Weitere Informationen">
        <a href="/datenschutz">Daten exportieren oder löschen</a>
        <a href="/impressum">Kontakt</a>
      </nav>
    </main>
  );
}
