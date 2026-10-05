import type { RecommendationDebug } from "@/lib/types";
import "./ai-debug.css";

const statuses: Record<RecommendationDebug["status"], string> = {
  live: "Modellantwort empfangen und geprüft",
  cache: "Gespeicherte Bewertung verwendet. Kein neuer Modellaufruf.",
  "results-cache":
    "Gespeicherte Suchergebnisse angezeigt. Kein neuer Modellaufruf.",
  "no-candidates": "Keine geeigneten Kandidaten für den KI-Abgleich",
  "missing-binding": "KI-Anbindung fehlt in dieser Umgebung",
  "in-progress": "Für diese Suche läuft bereits ein Modellaufruf",
  "budget-exhausted": "App-Tageslimit lässt keine weitere Reservierung zu",
  "invalid-output": "Modellantwort empfangen, aber bei der Prüfung abgelehnt",
  "provider-error": "Modellaufruf fehlgeschlagen oder Zeitlimit überschritten",
  "storage-error":
    "Speichern der Bewertung oder Verbrauchsabrechnung fehlgeschlagen",
  "request-error": "Anfrage an die KI-Suche fehlgeschlagen",
};
function pretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AiDebug({
  debug,
  pending,
}: {
  debug?: RecommendationDebug;
  pending: boolean;
}) {
  if (!debug && !pending) return null;
  return (
    <details className="ai-debug">
      <summary>KI-Debugging</summary>
      <p role="status">
        {pending
          ? "Modellantwort wird angefordert …"
          : debug && statuses[debug.status]}
      </p>
      {debug && (
        <>
          <dl>
            {debug.model && (
              <>
                <dt>Modell</dt>
                <dd>{debug.model}</dd>
              </>
            )}
            {debug.durationMs !== undefined && (
              <>
                <dt>Laufzeit dieser Anfrage</dt>
                <dd>{(debug.durationMs / 1000).toFixed(1)} s</dd>
              </>
            )}
            {debug.candidateCount !== undefined && (
              <>
                <dt>Kandidaten / geprüfte Bewertungen</dt>
                <dd>
                  {debug.candidateCount} / {debug.assessedCount ?? 0}
                </dd>
              </>
            )}
            {debug.budget && (
              <>
                <dt>App-Tageslimit bei dieser Anfrage</dt>
                <dd>
                  {debug.budget.used} / {debug.budget.limit} Einheiten. Eine
                  neue Anfrage reserviert {debug.budget.reservation}.
                </dd>
                <dt>Erneuerung</dt>
                <dd>
                  {new Date(debug.budget.resetsAt).toLocaleString("de-DE", {
                    timeZone: "Europe/Berlin",
                  })}{" "}
                  (Berlin)
                </dd>
              </>
            )}
          </dl>
          {debug.budget && (
            <p>
              Das ist die Verbrauchsschätzung der App, kein Live-Abgleich mit
              dem Cloudflare-Kontostand. Bei zwischengespeicherten Antworten ist
              der Tokenverbrauch historisch.
            </p>
          )}
          {debug.error && <p>Fehlerdetails: {debug.error}</p>}
          <h3>
            {debug.outputSource === "validated-cache"
              ? "Geprüfte Ausgabe aus älterem Cache (ohne ursprüngliche Rohantwort)"
              : "LLM-Ausgabe"}
          </h3>
          {debug.output !== undefined ? (
            <pre>{pretty(debug.output)}</pre>
          ) : (
            <p>Für diese Anfrage liegt keine Modellantwort vor.</p>
          )}
          {debug.usage && (
            <>
              <h3>Gemeldeter Modellverbrauch</h3>
              <pre>{JSON.stringify(debug.usage, null, 2)}</pre>
            </>
          )}
          {debug.input && (
            <details>
              <summary>
                An das Modell gesendete Musikdaten und Kandidaten-IDs
              </summary>
              <pre>{pretty(debug.input)}</pre>
            </details>
          )}
        </>
      )}
    </details>
  );
}
