"use client";
import { useEffect, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { ARTISTS, GENRES, normalize } from "@/lib/catalog";
import type { Artist } from "@/lib/types";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import HistoryImport from "./history-import";
import { Checkbox } from "@/components/ui/checkbox";
export type ProfileDraft = {
  name: string;
  artists: Artist[];
  genres: string[];
};
export default function ProfileEditor({
  value,
  onChange,
  index = 0,
  onRemove,
  spotify = false,
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  index?: number;
  onRemove?: () => void;
  spotify?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Artist[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (query.trim().length < 2) {
      setRemote([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(
      () =>
        fetch("/api/artists?q=" + encodeURIComponent(query), {
          signal: ac.signal,
        })
          .then((r) => r.json() as Promise<{ artists?: Artist[] }>)
          .then((d) => setRemote(d.artists || []))
          .catch(() => {}),
      300,
    );
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);
  const options = [...ARTISTS, ...remote].filter(
    (a, i, arr) =>
      arr.findIndex((b) => normalize(a.name) === normalize(b.name)) === i &&
      !value.artists.some((b) => normalize(a.name) === normalize(b.name)),
  );
  function add(a: Artist) {
    if (value.artists.length >= 50) return;
    onChange({ ...value, artists: [...value.artists, a] });
    setQuery("");
    setRevision((n) => n + 1);
  }
  return (
    <div className="profile-editor">
      <div className="profile-name">
        <span className={"person-dot person-" + (index % 4)}>{index + 1}</span>
        <input
          aria-label={"Name von Person " + (index + 1)}
          value={value.name}
          maxLength={40}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={"Person " + (index + 1)}
        />
        {onRemove && (
          <button
            type="button"
            className="icon-button"
            aria-label={value.name + " entfernen"}
            onClick={onRemove}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div className="artist-field">
        <div className="artist-chips">
          {value.artists.map((a) => (
            <span key={a.id} className="artist-chip">
              {a.name}
              <button
                type="button"
                aria-label={a.name + " entfernen"}
                onClick={() =>
                  onChange({
                    ...value,
                    artists: value.artists.filter((b) => b.id !== a.id),
                  })
                }
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <Combobox
          key={revision}
          items={options.map((a) => a.name)}
          value={null}
          onValueChange={(name) => {
            const a = options.find((a) => a.name === name);
            if (a) add(a);
          }}
          onInputValueChange={setQuery}
        >
          <ComboboxInput
            id={id}
            aria-label={"Lieblingskünstler für " + value.name}
            placeholder={
              value.artists.length
                ? "Weitere Künstler hinzufügen …"
                : "Künstler oder Band suchen …"
            }
            showTrigger={false}
          />
          <ComboboxContent>
            <ComboboxEmpty>
              Kein Vorschlag. Du kannst den Namen unten selbst hinzufügen.
            </ComboboxEmpty>
            <ComboboxList>
              {(name: string) => (
                <ComboboxItem key={name} value={name}>
                  {name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {query.trim().length >= 2 &&
          !value.artists.some(
            (a) => normalize(a.name) === normalize(query),
          ) && (
            <button
              type="button"
              className="text-link add-custom"
              onClick={() =>
                add({
                  id: "manual:" + normalize(query),
                  name: query.trim().slice(0, 100),
                  genres: [],
                })
              }
            >
              <Plus size={14} /> „{query.trim()}“ übernehmen
            </button>
          )}
        {!value.artists.length && !query && (
          <div className="artist-suggestions">
            <span>Zum Beispiel</span>
            {ARTISTS.slice(index === 0 ? 0 : 2, index === 0 ? 3 : 5).map(
              (a) => (
                <button type="button" key={a.id} onClick={() => add(a)}>
                  {a.name}
                </button>
              ),
            )}
          </div>
        )}
        {value.artists.some((a) => !a.genres.length) && (
          <details className="genre-details">
            <summary>Musikrichtungen ergänzen</summary>
            <p>
              Für Künstler ohne Genre-Daten helfen diese Angaben bei
              Entdeckungen.
            </p>
            <div className="genre-choices">
              {GENRES.map((g) => (
                <label key={g}>
                  <Checkbox
                    checked={value.genres.includes(g)}
                    onCheckedChange={(v) =>
                      onChange({
                        ...value,
                        genres: v
                          ? [...value.genres, g]
                          : value.genres.filter((x) => x !== g),
                      })
                    }
                  />
                  {g}
                </label>
              ))}
            </div>
          </details>
        )}
        <HistoryImport
          onImport={(artists) => onChange({ ...value, artists })}
        />
        {spotify && (
          <a
            className="text-link spotify-link"
            href="/api/spotify/start"
            onClick={() =>
              sessionStorage.setItem("cm_spotify_draft", JSON.stringify(value))
            }
          >
            Favoriten aus Spotify übernehmen
          </a>
        )}
      </div>
    </div>
  );
}
