# Rechtlicher und technischer Stand am 1. Oktober 2026

Die öffentliche Oberfläche wurde mit der tatsächlichen Datenverarbeitung abgeglichen. Dies ist eine technische Bestandsaufnahme; sie bestätigt keine allgemeine Abmahnsicherheit.

## In dieser Änderung erledigt

- Ticketmaster-Datenschutz auf die aktuelle deutsche Erklärung verlinkt.
- Größere Rücksprunglinks auf Datenschutz, Impressum und Methodenseite; bestehende Suche und kurzfristig zwischengespeicherte Formulare bleiben beim Rücksprung erreichbar.
- Persönliche Suche benötigt keinen Namen. Für mehrere Profile sind Rufnamen freiwillig; Standardbezeichnungen reichen aus.
- KI erst nach bewusster Auswahl. Das Formular weist auf Cloudflare hin. Die Datenschutzerklärung nennt optionalen KI-Abgleich, Modellantwort-Cache, ZIP-Verarbeitung und Sitzungsspeicher.
- Vollständige Spotify-Exporte werden nur lokal in einem Browser-Worker gelesen. Nur bestätigte Künstler gelangen mit dem Suchprofil zum Dienst. Audio-Dateien werden aus ZIPs gezielt ausgewählt; Video, PDF, Konto- und Podcastdaten werden nicht übernommen.
- Datenexport und Löschung existieren; die Löschung entfernt auch zurückgelassene lokale Entwürfe und Rücksprungziele.
- Impressum enthält den bereits vom Betreiber angegebenen Namen, die Anschrift und E-Mail-Adresse. Anbieterangaben sind als § 5 DDG gekennzeichnet; Datenquellen wurden vervollständigt.
- Keine eigenen Analyse-/Werbetracker und keine extern geladenen Schriftarten im geprüften Code. Konzertbilder laufen über den eigenen Server. Sitzungs-Cookie ist HttpOnly, SameSite und auf HTTPS Secure. CSRF-, Eigentums- und Löschprüfungen sind durch Integrationstests abgedeckt.

## Vom Betreiber noch sachlich bzw. rechtlich zu prüfen

1. **Unternehmensangaben:** Ist TiCore die Geschäftsbezeichnung eines Einzelunternehmers? Falls eine Gesellschaft, Registereintragung oder Umsatzsteuer-ID besteht, müssen die anwendbaren Zusatzangaben ins Impressum. Keine davon wurde ohne Nachweis erfunden.
2. **Cloudflare-Vertrag und Drittlandtransfer:** Den tatsächlich geltenden Auftragsverarbeitungsvertrag, Vertragspartner, Unterauftragnehmer und Übermittlungsmechanismus im eigenen Konto dokumentieren. Der öffentliche DPA-Link erklärt die möglichen Garantien, belegt aber allein nicht die Annahme des Vertrags für dieses Konto. Keine Vertragsannahme wurde ausgeführt.
3. **Anbieter-/Bildrechte:** Ticketmaster-API-Bedingungen und erlaubte Darstellung der gelieferten Bilder, Metadaten und Verlinkungen für diesen Dienst prüfen. Bei späteren Affiliate-Links die kommerzielle Beziehung kenntlich machen. Im geprüften Suchcode sind derzeit keine eigenen Affiliate-Trackingparameter vorhanden.
4. **Betrieb:** Tatsächliche Cloudflare-Protokoll-/Backupfristen und Auskunftsverfahren dokumentieren. Die Datenbank bereinigt abgelaufene Datensätze bei Dienstaufrufen, nicht durch einen täglichen Löschjob; die Erklärung benennt das. Ein D1-Standorthinweis allein garantiert keine ausschließliche EU-Verarbeitung.

## Grundlagen

- [§ 5 DDG: Anbieterinformationen](https://www.gesetze-im-internet.de/ddg/__5.html)
- [Art. 13 DSGVO: Informationen zur Verarbeitung](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32016R0679)
- [§ 25 TDDDG: Speicherung auf Endgeräten](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Workers AI: Datenverwendung](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [Ticketmaster-Datenschutzerklärung](https://privacy.ticketmaster.de/de/privacy-policy)

Die Rechtsgrundlagen und Anbieterbedingungen wurden anhand ihrer Primärquellen geprüft. Ob einzelne Anforderungen auf den konkreten Geschäftsbetrieb zutreffen, erfordert zusätzliche Betreiberangaben bzw. juristische Prüfung.
