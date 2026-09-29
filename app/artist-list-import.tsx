"use client";
import { useId, useState } from "react";
import { parseArtistList } from "@/lib/artist-list";
import type { Artist } from "@/lib/types";

export default function ArtistListImport({
  onImport,
}: {
  onImport: (artists: Artist[]) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  return (
    <details className="artist-help">
      <summary>Lieblingskünstler nicht im Kopf?</summary>
      <p>
        In der Spotify-App: Profilbild → „Hörstatistiken“ / „Listening stats“.
        Dort siehst du deine Top-Künstler der letzten vier Wochen, sofern die
        Funktion bei dir verfügbar ist. Auch dein letzter Wrapped-Rückblick
        hilft.{" "}
        <a
          href="https://newsroom.spotify.com/2025-11-06/spotify-new-feature-listening-stats/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Spotify-Anleitung ↗
        </a>
      </p>
      <label htmlFor={id}>Mehrere Künstler auf einmal</label>
      <textarea
        id={id}
        rows={4}
        maxLength={6000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage("");
        }}
        placeholder={"Juice WRLD\nLil Peep\nTyler, The Creator"}
      />
      <p className="small-note">
        Einen Namen pro Zeile. Drei bis fünf sind ein guter Anfang. Vorhandene
        Künstler bleiben erhalten.
      </p>
      <button
        type="button"
        className="secondary"
        disabled={!text.trim()}
        onClick={() => {
          try {
            const artists = parseArtistList(text);
            onImport(artists);
            setText("");
            setMessage("Liste übernommen. Prüfe deine Auswahl oben.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Liste übernehmen
      </button>
      {message && (
        <p className="small-note" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
