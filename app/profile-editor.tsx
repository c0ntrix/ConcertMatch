"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ARTISTS, STARTER_ARTISTS, GENRES, normalize } from "@/lib/catalog";
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
}: {
  value: ProfileDraft;
  onChange: (v: ProfileDraft) => void;
  index?: number;
  onRemove?: () => void;
  spotify?: boolean;
}) {
  const id = useId();
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
    }, 450);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, retry]);
  const local = (query ? ARTISTS : STARTER_ARTISTS).filter(
    (a) =>
      normalize(a.name).includes(normalize(query)) &&
      !remote.some((b) => normalize(a.name) === normalize(b.name)),
  );
  const options = [...remote, ...local]
    .filter(
      (a, i, arr) =>
        arr.findIndex((b) => a.id === b.id) === i &&
        !value.artists.some((b) => sameArtist(a, b)),
    )
    .slice(0, query ? 20 : 6);
  function add(a: Artist) {
    if (
      value.artists.length >= 50 ||
      value.artists.some((b) => sameArtist(a, b))
    )
      return;
    onChange({ ...value, artists: [...value.artists, a] });
    setQuery("");
    setOpen(true);
    setAdded(a.name + " hinzugefügt. Du kannst direkt weitersuchen.");
    input.current?.focus();
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
            id={id}
            maxLength={100}
            disabled={value.artists.length >= 50}
            aria-label={"Lieblingskünstler für " + value.name}
            placeholder={
              value.artists.length
                ? "Weitere Künstler hinzufügen …"
                : "Künstler oder Band suchen …"
            }
            showTrigger={false}
          />
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
                    <small>
                      {[
                        artist.description,
                        artist.genres.slice(0, 2).join(" · "),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Künstler / Band"}
                    </small>
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
              <Plus size={14} /> „{query.trim()}“ übernehmen
            </button>
          )}
        {!value.artists.length && !query && (
          <div className="artist-suggestions">
            <span>Zum Beispiel</span>
            {STARTER_ARTISTS.slice(
              index % 2 === 0 ? 0 : 3,
              index % 2 === 0 ? 3 : 6,
            ).map((a) => (
              <button type="button" key={a.id} onClick={() => add(a)}>
                {a.name}
              </button>
            ))}
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
        {spotify && (
          <a
            className="text-link spotify-link"
            href="/api/spotify/start"
            onClick={() => {
              sessionStorage.setItem("cm_spotify_draft", JSON.stringify(value));
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
    </div>
  );
}
