"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { ARTISTS, POPULAR_ARTISTS, normalize } from "@/lib/catalog";
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
import { sameArtist } from "@/lib/matching";
import ArtistListImport from "./artist-list-import";
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
  showName = false,
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  index?: number;
  onRemove?: () => void;
  spotify?: boolean;
  showName?: boolean;
}) {
  const id = useId();
  const nameId = id + "-name";
  const artistId = id + "-artists";
  const artistHintId = id + "-artist-hint";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [retry, setRetry] = useState(0);
  const [added, setAdded] = useState("");
  const [lookup, setLookup] = useState<{
    query: string;
    retry: number;
    artists: Artist[];
    notice: string;
    error: string;
  } | null>(null);
  const current = lookup?.query === query && lookup.retry === retry;
  const remote = current ? lookup.artists : [];
  const loading = query.trim().length >= 2 && !current;
  const searchError = current ? lookup.error : "";
  const searchNotice = current ? lookup.notice : "";
  useEffect(() => {
    if (query.trim().length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      void fetch("/api/artists?q=" + encodeURIComponent(query), {
        signal: ac.signal,
      })
        .then(async (r) => {
          const d = (await r.json()) as {
            artists: Artist[];
            notice?: string;
            error?: string;
          };
          if (!r.ok)
            throw new Error(
              d.error || "Die Suche ist gerade nicht erreichbar.",
            );
          if (!ac.signal.aborted)
            setLookup({
              query,
              retry,
              artists: d.artists,
              notice: d.notice || "",
              error: "",
            });
        })
        .catch((e) => {
          if (!ac.signal.aborted)
            setLookup({
              query,
              retry,
              artists: [],
              notice: "",
              error: e.message,
            });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, retry]);
  const local = (
    query ? [...ARTISTS, ...POPULAR_ARTISTS] : POPULAR_ARTISTS
  ).filter(
    (a) =>
      normalize(a.name).includes(normalize(query)) &&
      !remote.some((b) => normalize(a.name) === normalize(b.name)),
  );
  const options = [...remote, ...local]
    .filter(
      (a, i, arr) =>
        arr.findIndex((b) => normalize(a.name) === normalize(b.name)) === i &&
        !value.artists.some((b) => sameArtist(a, b)),
    )
    .slice(0, query ? 20 : 18);
  function add(a: Artist, keepSearching = true) {
    if (
      value.artists.length >= 50 ||
      value.artists.some((b) => sameArtist(a, b))
    )
      return;
    onChange({ ...value, artists: [...value.artists, a] });
    setQuery("");
    setOpen(keepSearching);
    setAdded(a.name + " hinzugefügt.");
    if (keepSearching) input.current?.focus();
  }
  return (
    <div className="profile-editor">
      {showName && (
        <div className="profile-name">
          <span
            className={"person-dot person-" + (index % 4)}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <div className="profile-name-field">
            <label htmlFor={nameId}>
              Rufname <span className="field-optional">optional</span>
            </label>
            <input
              id={nameId}
              aria-label={"Name von Person " + (index + 1)}
              value={value.name}
              maxLength={40}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={"Person " + (index + 1)}
            />
          </div>
          {onRemove && (
            <button
              type="button"
              className="icon-button"
              aria-label={value.name + " entfernen"}
              onClick={onRemove}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <div className="artist-field">
        <div className="artist-field-heading">
          <label htmlFor={artistId}>Lieblingskünstler</label>
          <span className="field-hint" id={artistHintId}>
            3–5 sind ein guter Anfang
          </span>
        </div>
        <Combobox
          multiple
          open={open}
          onOpenChange={(next, details) => {
            if (!next && details.reason === "item-press") {
              details.cancel();
              return;
            }
            setOpen(next);
          }}
          items={options}
          value={[] as Artist[]}
          inputValue={query}
          filter={null}
          itemToStringLabel={(a: Artist) => a.name}
          isItemEqualToValue={(a: Artist, b: Artist) => a.id === b.id}
          onValueChange={(items: Artist[]) => {
            const a = items[items.length - 1];
            if (a) add(a);
          }}
          onInputValueChange={(text, details) => {
            setQuery(text);
            if (details.reason === "input-change") setOpen(true);
          }}
        >
          <ComboboxInput
            ref={input}
            id={artistId}
            className="artist-search-input"
            maxLength={100}
            disabled={value.artists.length >= 50}
            aria-describedby={artistHintId}
            aria-label={"Lieblingskünstler für " + value.name}
            placeholder={
              value.artists.length
                ? "Weitere Künstler hinzufügen …"
                : "Künstler oder Band suchen …"
            }
            showTrigger={false}
          >
            <Search
              size={18}
              className="artist-search-icon"
              aria-hidden="true"
            />
          </ComboboxInput>
          <ComboboxContent>
            {loading && (
              <p className="artist-search-status" role="status">
                Musikkatalog wird durchsucht …
              </p>
            )}
            {searchError && (
              <div className="artist-search-status" role="alert">
                {searchError}{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Erneut versuchen
                </button>
              </div>
            )}
            <ComboboxEmpty>
              {loading
                ? ""
                : "Kein weiterer Treffer. Du kannst den Namen auch selbst hinzufügen."}
            </ComboboxEmpty>
            <ComboboxList>
              {(artist: Artist) => (
                <ComboboxItem
                  key={artist.id}
                  value={artist}
                  className="artist-result"
                >
                  <span>
                    <strong>{artist.name}</strong>
                    {artist.description && (
                      <small>
                        {artist.description.replace(/\s+\u00b7\s+/g, ", ")}
                      </small>
                    )}
                    {artist.genres.length > 0 && (
                      <small className="artist-result-styles">
                        {artist.genres.slice(0, 2).join(", ")}
                      </small>
                    )}
                  </span>
                  <Plus size={15} aria-hidden="true" />
                </ComboboxItem>
              )}
            </ComboboxList>
            {searchNotice && (
              <p className="artist-search-status">{searchNotice}</p>
            )}
          </ComboboxContent>
        </Combobox>
        {value.artists.length > 0 && (
          <div
            className="artist-chips"
            role="list"
            aria-label="Ausgewählte Lieblingskünstler"
          >
            {value.artists.map((a) => (
              <span key={a.id} className="artist-chip" role="listitem">
                <span className="artist-chip-text">{a.name}</span>
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
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <span className="sr-only" role="status">
          {added}
        </span>
        {value.artists.length >= 50 && (
          <p className="small-note">
            50 Künstler ausgewählt. Entferne einen, um einen anderen
            hinzuzufügen.
          </p>
        )}
        {query.trim().length >= 2 &&
          !loading &&
          !options.some((a) => normalize(a.name) === normalize(query)) &&
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
              <Plus size={14} aria-hidden="true" /> „{query.trim()}“ übernehmen
            </button>
          )}
        {!value.artists.length && !query && (
          <div className="artist-suggestions">
            <span>Beliebte Künstler</span>
            {POPULAR_ARTISTS.slice(0, 4).map((a) => (
              <button type="button" key={a.id} onClick={() => add(a, false)}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <details className="profile-imports">
          <summary>Liste oder Spotify-Verlauf importieren</summary>
          <div className="profile-import-options">
            <ArtistListImport
              onImport={(artists) =>
                onChange({
                  ...value,
                  artists: [
                    ...value.artists,
                    ...artists.filter(
                      (a) => !value.artists.some((b) => sameArtist(a, b)),
                    ),
                  ].slice(0, 50),
                })
              }
            />
            <HistoryImport
              onImport={(artists) => {
                const fresh = artists
                  .filter((a) => !value.artists.some((b) => sameArtist(a, b)))
                  .slice(0, Math.max(0, 50 - value.artists.length));
                onChange({
                  ...value,
                  artists: [...value.artists, ...fresh],
                });
                return fresh.length;
              }}
            />
            {spotify && (
              <a
                className="text-link spotify-link"
                href="/api/spotify/start"
                onClick={() => {
                  sessionStorage.setItem(
                    "cm_spotify_draft",
                    JSON.stringify(value),
                  );
                  sessionStorage.setItem(
                    "cm_spotify_group",
                    new URL(location.href).searchParams.get("group") || "",
                  );
                }}
              >
                Favoriten aus Spotify übernehmen
              </a>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
