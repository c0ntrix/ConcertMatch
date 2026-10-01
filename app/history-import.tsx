"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parseHistory } from "@/lib/history-import";
import type { Artist } from "@/lib/types";
export default function HistoryImport({
  onImport,
}: {
  onImport: (artists: Artist[]) => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function read(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const list = Array.from(files);
      if (
        list.some((f) => f.size > 15 * 1024 * 1024) ||
        list.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024
      )
        throw new Error(
          "Bitte höchstens 40 MB insgesamt und 15 MB pro Datei auswählen. Du kannst einzelne Hörverlaufsdateien aus dem Export verwenden.",
        );
      const texts = await Promise.all(list.map((f) => f.text()));
      const result = parseHistory(texts);
      onImport(result.artists);
      setSummary(
        result.artists.length +
          " Künstler aus " +
          result.plays.toLocaleString("de-DE") +
          " Wiedergaben übernommen.",
      );
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-link history-link"
        onClick={() => setOpen(true)}
      >
        <Upload size={13} aria-hidden="true" /> Spotify-Verlauf importieren
      </button>
      {summary && (
        <p className="import-summary" role="status">
          {summary} Du kannst die Auswahl oben bearbeiten.
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Deine meistgehörte Musik übernehmen</DialogTitle>
          <DialogDescription>
            Mit deinem Spotify-Datenexport musst du deine Lieblingskünstler
            nicht aus dem Kopf sammeln.
          </DialogDescription>
          <ol className="import-steps">
            <li>
              Fordere unter{" "}
              <a
                href="https://www.spotify.com/account/privacy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify → Datenschutz
              </a>{" "}
              deinen Hörverlauf an. Die Bereitstellung kann einige Tage dauern.
            </li>
            <li>
              Entpacke die ZIP-Datei und wähle die JSON-Dateien des
              Musik-Hörverlaufs aus.
            </li>
            <li>
              Wir übernehmen bis zu 30 Künstler nach Hörzeit. Danach kannst du
              die Auswahl ändern.
            </li>
          </ol>
          <p className="small-note">
            Standard- und erweiterter Spotify-Hörverlauf werden unterstützt. Die
            Dateien bleiben in deinem Browser. Wir speichern erst beim
            Bestätigen deine Künstlerauswahl; keine einzelnen Songs, Hörzeiten,
            IP-Adressen oder Standorte.
          </p>
          <input
            ref={input}
            type="file"
            multiple
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void read(e.target.files)}
            aria-label="Spotify-Hörverlaufsdateien"
          />
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Wird im Browser ausgewertet …" : "JSON-Dateien auswählen"}
          </button>
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
