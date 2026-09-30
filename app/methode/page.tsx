import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Wie das Matching funktioniert · ConcertMatch",
};
export default function Methode() {
  return (
    <main className="legal-content">
      <Link className="back-link" href="/">
        ← Zur Konzertsuche
      </Link>
      <h1>Deine Musik. Dein nächstes Konzert.</h1>
      <p>
        ConcertMatch findet Konzerte für deinen Musikgeschmack. Du kannst allein
        suchen oder mit bis zu sieben weiteren Personen gemeinsame Favoriten
        finden. Ihr müsst dafür nicht dieselben Playlists haben.
      </p>
      <h2>Erst die Musik, dann der Termin</h2>
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
        Gruppe. Ein Lieblingskünstler bringt dieser Person 100 Punkte. Zunächst
        erscheinen Ergebnisse anhand von Favoriten und Genres. Danach beurteilt
        ein Sprachmodell musikalische Nähe, Klang, Szene und Energie für jede
        Person separat. Diese Einschätzung berücksichtigt bis zu 20 Favoriten
        pro Profil und bis zu 180 verschiedene Konzert-Line-ups. Bei sehr langen
        Eingaben fällt die Auswahl kleiner aus. Das Modell bewertet die bis zu
        16 geeignetsten Line-ups; Tourtermine desselben Line-ups teilen diese
        Einschätzung. Ohne Modellbewertung: Passende Grundrichtungen wie Pop
        oder Hip-Hop bringen höchstens 40 Punkte. Gemeinsame konkrete Stile wie
        Emo-Rap bringen bis zu 82 Punkte. Wir berücksichtigen die gesamte
        Künstlerauswahl einer Person: Die beste stilistische Verbindung zählt zu
        60 %, der Durchschnitt aller Verbindungen zu 40 %. Nebensächliche
        Genre-Tags zählen weniger als prägende Stilrichtungen. Support-Acts
        erhalten bei stilistischen Empfehlungen ein geringeres Gewicht als der
        erste angekündigte Act. Fehlen passende oder ausreichende Daten, gibt es
        0 Punkte – das heißt nicht, dass euch die Musik nicht gefallen könnte.
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
      <h2>Entdeckungen sind begründete Vermutungen</h2>
      <p>
        Ein Künstler ist „neu für euch“, wenn er in keiner eurer Auswahlen
        vorkommt. Seine Musikrichtungen können trotzdem gut passen. Diese
        Empfehlungen beruhen auf musikalischen Metadaten und dem Wissen des
        Sprachmodells Llama 3.3 bei Cloudflare Workers AI. Es werden keine
        Audiodateien analysiert und keine Termine vom Modell erzeugt. Im
        aufklappbaren Ergebnis steht die Einschätzung für jede Person.
      </p>
      <p>
        Breite Genres können ungenau sein. Ein Indie-Label allein sagt wenig
        über die Energie einer Liveshow. Hört deshalb kurz rein und nutzt eure
        Abstimmung. Matchpunkte sind keine Prozentwahrscheinlichkeit.
      </p>
      <p>
        Modellwerte reichen bis 92 Punkte; bei unsicherem Wissen höchstens bis
        45. Das Modell kann sich irren. Bei Ausfällen oder ausgeschöpftem
        Tageskontingent bleiben die Genre-Ergebnisse verfügbar und sind als
        vorläufig gekennzeichnet. Die genaue Bewertung erscheint nach dem ersten
        Laden; die Reihenfolge kann sich dabei ändern. Eure Favoriten bleiben
        unabhängig davon berücksichtigt.
      </p>
      <h2>Bekannte Acts und kleine Entdeckungen</h2>
      <p>
        Bei vergleichbarer musikalischer Passung bevorzugen wir bekannte Acts.
        Dafür verwenden wir verfügbare Hörerzahlen der ListenBrainz-Community
        ohne Sonderbonus für einzelne Künstlerlisten. Dieser Sortierbonus
        beträgt höchstens 12 Punkte und verändert die angezeigten Matchpunkte
        nicht. Eine deutlich passendere kleine Band kann deshalb vor einem
        großen Act stehen. Ohne musikalische Gemeinsamkeit wird ein Termin nicht
        allein wegen seiner Bekanntheit empfohlen.
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
      <h2>Top-Künstler ohne Wartezeit finden</h2>
      <p>
        Öffne in der Spotify-App über dein Profilbild die Hörstatistiken, sofern
        sie bei dir verfügbar sind. Dort kannst du deine Top-Künstler nachsehen.
        Du kannst mehrere Namen auf einmal bei uns einfügen. Ein Datenexport ist
        für die Konzertsuche nicht nötig.
      </p>
      <h2>Optional: vorhandenen Hörverlauf importieren</h2>
      <p>
        Standard- und erweiterte Spotify-Hörverlaufsdateien werden direkt in
        eurem Browser ausgewertet. Wir sortieren Künstler nach gesamter Hörzeit,
        lassen Podcasts und Wiedergaben unter 30 Sekunden weg und schlagen bis
        zu 30 Künstler vor. Ihr bestätigt und bearbeitet die Auswahl selbst. Der
        direkte Spotify-Import ist optional und nur verfügbar, wenn die
        Anbindung freigeschaltet ist.
      </p>
      <h2>Datenquellen</h2>
      <p>
        Künstlerdaten: <a href="https://musicbrainz.org/">MusicBrainz</a>, bei
        Ausfällen ergänzend <a href="https://music.apple.com/">Apple iTunes</a>.
        Hörerzahlen: <a href="https://listenbrainz.org/">ListenBrainz</a>.
        Konzerttermine: Ticketmaster. Die Metadaten werden zwischengespeichert
        und können lückenhaft oder veraltet sein.
      </p>
      <h2>Welche Konzerte sind enthalten?</h2>
      <p>
        Wir durchsuchen den Ticketmaster-Katalog im gewählten Umkreis bis zu
        1.000 km Luftlinie, auch über Landesgrenzen hinweg. Startorte liegen
        derzeit in Deutschland. Clubshows und andere Ticketanbieter sind nicht
        vollständig abgedeckt. Bei sehr vielen Terminen berücksichtigen wir bis
        zu 800 nach Ticketmaster-Relevanz sortierte Termine im gewählten
        Zeitraum. Zusätzlich suchen wir gezielt nach bis zu acht Favoriten,
        abwechselnd aus euren Profilen. Die Auswahl bleibt begrenzt; fehlende
        Treffer bedeuten nicht, dass es keine Tour gibt.
      </p>
      <p>
        Entfernungen sind Luftlinien ab dem Zentrum des gewählten Startorts,
        keine Fahrstrecken und keine Entfernung von deiner Adresse. Bei
        Konzerten im selben Ort steht deshalb nur „in Hamburg“ beziehungsweise
        euer Startort. Die Preisgrenze berücksichtigt verfügbare Euro-Preise;
        Termine ohne Preisangabe werden bei gesetztem Budget ausgeblendet.
        Gebühren und Verfügbarkeit können abweichen. Prüft deshalb den
        verlinkten Originaltermin vor einer Buchung.
      </p>
      <h2>Merken und entscheiden</h2>
      <p>
        Merkt euch interessante Konzerte. Auf der Merkliste könnt ihr pro Person
        „Bin dabei“, „Vielleicht“ oder „Eher nicht“ wählen. Bei deiner
        persönlichen Suche ist die Merkliste für dich; erst durch Hinzufügen
        oder Einladen einer Person entsteht eine gemeinsame Auswahl. Ein
        Kalendereintrag merkt den Tag vor; Uhrzeit und Änderungen bestätigt der
        Ticketanbieter.
      </p>
      <h2>Eure Daten bleiben überschaubar</h2>
      <p>
        Es gibt kein öffentliches Profil und keine Personensuche. Der
        Einladungslink öffnet eure Runde, also teilt ihn gezielt. Die Gruppe
        läuft nach 90 Tagen ab. Der Browser merkt eure Berechtigung über ein
        notwendiges Cookie. Löscht ihr dieses Cookie, braucht ihr einen neuen
        Einladungslink und legt gegebenenfalls ein neues Profil an.
      </p>
      <p>
        <a href="/datenschutz">Daten exportieren oder löschen</a> ·{" "}
        <a href="/impressum">Kontakt</a>
      </p>
    </main>
  );
}
