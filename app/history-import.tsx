"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Upload, FileArchive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  rankHistory,
  type HistoryData,
  type HistoryPeriod,
} from "@/lib/history-import";
import type { Artist } from "@/lib/types";
import HistoryWorker from "./history-worker?worker";

export default function HistoryImport({
  onImport,
}: {
  onImport: (artists: Artist[]) => number;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState(""),
    [progress, setProgress] = useState(""),
    [data, setData] = useState<HistoryData | null>(null),
    [period, setPeriod] = useState<HistoryPeriod>("recent"),
    [limit, setLimit] = useState(20);
  const input = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const result = data ? rankHistory(data, { period, limit }) : null;
  const years = data
    ? [
        ...new Set(
          data.buckets.filter((b) => b.day).map((b) => b.day.slice(0, 4)),
        ),
      ]
        .sort()
        .reverse()
    : [];
  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setData(null);
      setError("");
    }
  }
  function read(files: FileList | null) {
    if (!files?.length) return;
    worker.current?.terminate();
    setBusy(true);
    setError("");
    setData(null);
    setProgress("Dein Export wird geöffnet …");
    try {
      const reader = new HistoryWorker();
      worker.current = reader;
      reader.onmessage = (
        event: MessageEvent<{
          progress?: string;
          data?: HistoryData;
          error?: string;
        }>,
      ) => {
        if (event.data.progress) setProgress(event.data.progress);
        else {
          if (event.data.data) {
            setData(event.data.data);
            setPeriod("recent");
          }
          if (event.data.error) setError(event.data.error);
          setBusy(false);
          reader.terminate();
          worker.current = null;
        }
      };
      reader.onerror = () => {
        setError(
          "Der Import konnte nicht gestartet werden. Bitte lade die Seite neu und versuche es erneut.",
        );
        setBusy(false);
        reader.terminate();
        worker.current = null;
      };
      reader.postMessage(Array.from(files));
    } catch {
      setBusy(false);
      setError(
        "Der Import konnte nicht gestartet werden. Bitte versuche es in einem aktuellen Browser.",
      );
    }
    if (input.current) input.current.value = "";
  }
  return (
    <>
      <button
        type="button"
        className="text-link history-link"
        onClick={() => setOpen(true)}
      >
        <Upload size={15} aria-hidden="true" /> Spotify-Verlauf importieren
      </button>
      {summary && (
        <p className="import-summary" role="status">
          {summary} Du kannst die Auswahl oben bearbeiten.
        </p>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="history-dialog">
          <DialogTitle>Spotify-Hörverlauf importieren</DialogTitle>
          <DialogDescription>
            Wähle die ZIP-Datei deines Spotify-Datenexports.
          </DialogDescription>
          {!data && (
            <>
              <div className="history-setup">
                <h3>Hörverlauf bei Spotify anfordern</h3>
                <ol>
                  <li>
                    Öffne die{" "}
                    <a
                      href="https://www.spotify.com/account/privacy/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Datenschutzeinstellungen bei Spotify
                    </a>
                    .
                  </li>
                  <li>
                    Wähle unter „Deine Daten herunterladen“ den „Erweiterten
                    Streamingverlauf“ und fordere ihn an.
                  </li>
                  <li>
                    Bestätige die Anfrage per E-Mail. Spotify sendet dir einen
                    Download-Link, sobald die ZIP bereitsteht.
                  </li>
                </ol>
                <p className="small-note">
                  Die Bereitstellung kann ein paar Tage dauern. Du kannst
                  Künstler auch ohne Import auswählen.
                </p>
              </div>
              <div className="history-upload-hint">
                <h3>Datei importieren</h3>
              </div>
            </>
          )}
          <input
            ref={input}
            type="file"
            multiple
            accept=".zip,.json,application/zip,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => read(e.target.files)}
            aria-label="Spotify-ZIP oder Audio-JSON-Dateien"
          />
          {data && result && (
            <div className="history-preview">
              <div className="history-options">
                <label>
                  Zeitraum
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as HistoryPeriod)}
                  >
                    <option value="recent">Letzte 12 Monate</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                    <option value="all">Alle Jahre</option>
                  </select>
                </label>
                <label>
                  Künstler
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    {[10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                        {n === 20 ? " (empfohlen)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="small-note">
                Sortiert nach Hörzeit. Mit einer höheren Anzahl werden auch
                seltener gehörte Künstler übernommen.
              </p>
              <p role="status">
                {result.plays.toLocaleString("de-DE")} Wiedergaben aus{" "}
                {data.files} Audio-Datei{data.files !== 1 ? "en" : ""}
              </p>
              {result.artists.length ? (
                <div
                  className="history-artists"
                  aria-label="Künstler für den Import"
                >
                  {result.artists.map((a) => (
                    <span key={a.id}>{a.name}</span>
                  ))}
                </div>
              ) : (
                <p className="form-error">
                  In diesem Zeitraum gibt es keine Wiedergaben. Wähle ein
                  anderes Jahr oder „Alle Jahre“.
                </p>
              )}
              {result.undated > 0 && (
                <p className="small-note">
                  {result.undated.toLocaleString("de-DE")} Wiedergaben ohne
                  Datum werden nur bei „Alle Jahre“ berücksichtigt.
                </p>
              )}
            </div>
          )}
          <div className="history-actions">
            {result && (
              <button
                className="primary"
                type="button"
                disabled={!result.artists.length}
                onClick={() => {
                  const added = onImport(result.artists);
                  setSummary(
                    added +
                      " neue Künstler aus " +
                      result.plays.toLocaleString("de-DE") +
                      " Wiedergaben hinzugefügt." +
                      (added < result.artists.length
                        ? " Bereits vorhandene Künstler und das Limit von 50 wurden berücksichtigt."
                        : ""),
                  );
                  close(false);
                }}
              >
                {result.artists.length} Künstler übernehmen{" "}
                <Check size={16} aria-hidden="true" />
              </button>
            )}
            <button
              className={data ? "secondary" : "history-upload"}
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {data ? (
                "Andere Datei"
              ) : (
                <>
                  <span className="history-upload-icon" aria-hidden="true">
                    <FileArchive size={27} />
                  </span>
                  <span>
                    <strong>
                      {busy ? "Wird ausgewertet …" : "ZIP-Datei auswählen"}
                    </strong>
                    <small>Spotify-Datenexport als ZIP oder Audio-JSON</small>
                  </span>
                  <Upload size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
          <p className="import-local">
            Die Datei wird nicht hochgeladen. Gespeichert wird nur deine
            bestätigte Künstlerauswahl.
          </p>
          {busy && (
            <p role="status" className="small-note">
              {progress}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
