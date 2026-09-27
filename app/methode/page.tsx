import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Wie das Matching funktioniert · ConcertMatch",
};
export default function Methode() {
  return (
    <main className="legal-content">
      <a className="back-link" href="/">
        ← Zur Konzertsuche
      </a>
      <h1>Ein guter Abend für alle.</h1>
      <p>
        Ihr müsst nicht dieselben Playlists haben. ConcertMatch sucht Konzerte,
        die zu eurer ganzen Runde passen – für zwei bis acht Personen.
      </p>
      <h2>Erst die Musik, dann der Termin</h2>
      <p>
        Wählt ein paar Lieblingskünstler oder importiert euren
        Spotify-Hörverlauf. Drei bis fünf Künstler sind ein guter Start. Jede
        Person kann über den Einladungslink selbst mitmachen. Ihr könnt auch
        mehrere Profile an einem Gerät anlegen.
      </p>
      <h2>So entstehen Matchpunkte</h2>
      <p>
        Wir vergleichen jeden auftretenden Künstler mit jeder Person in der
        Gruppe. Ein Lieblingskünstler bringt dieser Person 100 Punkte. Passende
        Musikrichtungen bringen 45 bis 75 Punkte. Fehlen passende oder
        ausreichende Daten, gibt es 0 Punkte – das heißt nicht, dass euch die
        Musik nicht gefallen könnte.
      </p>
      <p className="method-formula">
        Gruppenwert = 65 % niedrigster Einzelwert + 35 % Durchschnitt
      </p>
      <p>
        Ein Beispiel: Ein Konzert mit 100 und 0 Punkten bekommt zusammen 18
        Punkte. Ein Konzert, das für beide bei 70 liegt, bekommt 70 Punkte. So
        dominiert niemand die gemeinsame Auswahl.
      </p>
      <h2>Entdeckungen sind begründete Vermutungen</h2>
      <p>
        Ein Künstler ist „neu für euch“, wenn er in keiner eurer Auswahlen
        vorkommt. Seine Musikrichtungen können trotzdem gut passen. Diese
        Empfehlungen beruhen auf Genre-Nähe, nicht auf einer Analyse von
        Audiodateien oder einem trainierten KI-Modell. Im aufklappbaren Ergebnis
        steht die Einschätzung für jede Person.
      </p>
      <p>
        Breite Genres können ungenau sein. Ein Indie-Label allein sagt wenig
        über die Energie einer Liveshow. Hört deshalb kurz rein und nutzt eure
        Abstimmung. Matchpunkte sind keine Prozentwahrscheinlichkeit.
      </p>
      <h2>Hörverlauf statt Gedächtnis</h2>
      <p>
        Standard- und erweiterte Spotify-Hörverlaufsdateien werden direkt in
        eurem Browser ausgewertet. Wir sortieren Künstler nach gesamter Hörzeit,
        lassen Podcasts und Wiedergaben unter 30 Sekunden weg und schlagen bis
        zu 30 Künstler vor. Ihr bestätigt und bearbeitet die Auswahl selbst. Der
        direkte Spotify-Import ist optional und nur verfügbar, wenn die
        Anbindung freigeschaltet ist.
      </p>
      <h2>Welche Konzerte sind enthalten?</h2>
      <p>
        Aktuell durchsuchen wir den Ticketmaster-Katalog in Deutschland, für bis
        zu 300 km Luftlinie um euren Startort. Clubshows und andere
        Ticketanbieter sind nicht vollständig abgedeckt. Bei sehr vielen
        Terminen berücksichtigen wir die nächsten 800 im gewählten Zeitraum und
        zeigen dies an.
      </p>
      <p>
        Die Entfernung ist keine Fahrstrecke. Die Preisgrenze berücksichtigt
        verfügbare Euro-Preise; Termine ohne Preisangabe werden bei gesetztem
        Budget ausgeblendet. Gebühren und Verfügbarkeit können abweichen. Prüft
        deshalb den verlinkten Originaltermin vor einer Buchung.
      </p>
      <h2>Gemeinsam entscheiden</h2>
      <p>
        Merkt euch interessante Konzerte. Auf der Merkliste könnt ihr pro Person
        „Bin dabei“, „Vielleicht“ oder „Eher nicht“ wählen. Ein Kalendereintrag
        merkt den Tag vor; Uhrzeit und Änderungen bestätigt der Ticketanbieter.
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
