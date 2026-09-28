"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Bookmark,
  Check,
  Link as LinkIcon,
  SlidersHorizontal,
  X,
  CalendarPlus,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import ProfileEditor, { type ProfileDraft } from "./profile-editor";
import { CITIES, defaultPreferences } from "@/lib/catalog";
import { matchConcert, rankConcerts } from "@/lib/matching";
import type { Concert, Group, Match, Preferences } from "@/lib/types";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarFile } from "@/lib/calendar";
type ProviderState = { ticketmaster: boolean; spotify: boolean };
const emptyProfile = (name: string): ProfileDraft => ({
  name,
  artists: [],
  genres: [],
});
async function api(path: string, body?: unknown, method = "POST") {
  const r = await fetch(
    path,
    body
      ? {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = (await r.json()) as {
    error?: string;
    group: Group;
    groups: { id: string; name: string }[];
    providers: ProviderState;
    artists: import("@/lib/types").Artist[];
    events: Concert[];
    notice?: string;
    checkedAt?: string;
    invite?: string;
    deleted?: boolean;
    left?: boolean;
  };
  if (!r.ok)
    throw new Error(
      d.error || "Das hat nicht geklappt. Bitte erneut versuchen.",
    );
  return d;
}
function LocationFields({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (p: Preferences) => void;
}) {
  return (
    <div className="location-fields">
      <div className="location-city">
        <label>In der Nähe von</label>
        <Combobox
          items={CITIES.map((c) => c.name)}
          value={value.city}
          onValueChange={(name) => {
            const c = CITIES.find((c) => c.name === name);
            if (c) onChange({ ...value, city: c.name, lat: c.lat, lng: c.lng });
          }}
        >
          <ComboboxInput aria-label="Startort" placeholder="Stadt auswählen" />
          <ComboboxContent>
            <ComboboxEmpty>Bitte eine Stadt in der Nähe wählen.</ComboboxEmpty>
            <ComboboxList>
              {(name: string) => (
                <ComboboxItem key={name} value={name}>
                  {name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div>
        <label>Entfernung</label>
        <Select
          value={String(value.radius)}
          onValueChange={(v) => onChange({ ...value, radius: Number(v) })}
        >
          <SelectTrigger aria-label="Maximale Entfernung">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 150, 200, 300].map((n) => (
              <SelectItem key={n} value={String(n)}>
                bis {n} km
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
export default function ConcertApp() {
  const [group, setGroup] = useState<Group | null>(null),
    [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<ProfileDraft[]>([
    emptyProfile("Du"),
    emptyProfile("Person 2"),
  ]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [providers, setProviders] = useState<ProviderState>({
    ticketmaster: false,
    spotify: false,
  });
  const [initializing, setInitializing] = useState(true),
    [busy, setBusy] = useState(false),
    [searching, setSearching] = useState(false);
  const [events, setEvents] = useState<Concert[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("all"),
    [filters, setFilters] = useState(false),
    [edit, setEdit] = useState(false),
    [invite, setInvite] = useState(""),
    [shareOpen, setShareOpen] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [joining, setJoining] = useState<{
    groupId: string;
    invite: string;
  } | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [visible, setVisible] = useState(15),
    [checkedAt, setCheckedAt] = useState("");
  const [searchEpoch, setSearchEpoch] = useState(0);
  const viewRevision = useRef(0);
  const searchRevision = useRef(0);
  const loadState = useCallback(async (id?: string) => {
    const revision = ++viewRevision.current;
    searchRevision.current++;
    setEvents([]);
    setNotice("");
    setCheckedAt("");
    setSearching(false);
    try {
      const d = await api(
        "/api/state" + (id ? "?group=" + encodeURIComponent(id) : ""),
      );
      if (revision !== viewRevision.current) return;
      setGroups(d.groups);
      setProviders(d.providers);
      setGroup(d.group);
      setSearchEpoch((value) => value + 1);
      if (d.group) setPrefs(d.group.preferences);
      setLoadError("");
      return d;
    } catch (e) {
      if (revision === viewRevision.current) setLoadError((e as Error).message);
    } finally {
      if (revision === viewRevision.current) setInitializing(false);
    }
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    const join = url.searchParams.get("join");
    let invitation = url.hash.slice(1);
    try {
      const pending = JSON.parse(sessionStorage.getItem("cm_join") || "null");
      if (!invitation && pending?.groupId === join) invitation = pending.invite;
    } catch {}
    if (join && /^[a-f0-9]{64}$/.test(invitation)) {
      setJoining({ groupId: join, invite: invitation });
      sessionStorage.setItem(
        "cm_join",
        JSON.stringify({ groupId: join, invite: invitation }),
      );
      setProfiles([emptyProfile("Dein Name")]);
      history.replaceState(null, "", "/?join=" + encodeURIComponent(join));
    }
    void loadState(url.searchParams.get("group") || undefined).then(
      (restored) => {
        if (url.searchParams.get("spotify") === "success") {
          void api("/api/spotify/import")
            .then((d) => {
              let draft: ProfileDraft = emptyProfile("Du");
              try {
                draft =
                  JSON.parse(
                    sessionStorage.getItem("cm_spotify_draft") || "null",
                  ) || draft;
              } catch {}
              sessionStorage.removeItem("cm_spotify_draft");
              const imported = { ...draft, artists: d.artists };
              if (restored?.group) {
                const member =
                  restored.group.members.find(
                    (m) => m.mine && m.name === draft.name,
                  ) || restored.group.members.find((m) => m.mine);
                setEditingMember(member?.id || null);
                setProfiles([imported]);
                setEdit(true);
              } else {
                setProfiles([imported, emptyProfile("Person 2")]);
                setEdit(false);
              }
              toast.success(
                "Spotify-Favoriten übernommen. Prüfe die Auswahl vor dem Speichern.",
              );
            })
            .catch((e) => toast.error(e.message));
          history.replaceState(null, "", "/");
        } else if (url.searchParams.get("spotify") === "error") {
          toast.error(
            "Spotify konnte nicht verbunden werden. Nutze die Künstlerauswahl oder versuche es erneut.",
          );
          history.replaceState(null, "", "/");
        }
      },
    );
  }, [loadState]);
  const search = useCallback(async (g: Group) => {
    const request = ++searchRevision.current;
    const revision = viewRevision.current;
    const isCurrent = () =>
      request === searchRevision.current && revision === viewRevision.current;
    setEvents([]);
    setNotice("");
    setCheckedAt("");
    setSearching(true);
    setError("");
    setVisible(15);
    try {
      const d = await api("/api/concerts?group=" + g.id);
      if (!isCurrent()) return;
      setEvents(d.events);
      setNotice(d.notice || "");
      setCheckedAt(d.checkedAt || "");
    } catch (e) {
      if (!isCurrent()) return;
      setError((e as Error).message);
      setEvents([]);
    } finally {
      if (isCurrent()) setSearching(false);
    }
  }, []);
  const groupId = group?.id;
  const prefsKey = group ? JSON.stringify(group.preferences) : "";
  useEffect(() => {
    if (group) void search(group);
    return () => {
      searchRevision.current++;
    };
  }, [groupId, prefsKey, searchEpoch, search]);
  useEffect(() => {
    if (!groupId) return;
    let active = true;
    const revision = viewRevision.current;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void api("/api/groups/" + groupId)
        .then((d) => {
          if (active && revision === viewRevision.current)
            setGroup((current) =>
              current?.id === groupId ? d.group : current,
            );
        })
        .catch(() => {});
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [groupId, searchEpoch]);
  async function action(input: unknown) {
    if (!group) return;
    const revision = viewRevision.current;
    setBusy(true);
    try {
      const d = await api("/api/groups/" + group.id, input);
      if (revision !== viewRevision.current) return;
      if (d.group) setGroup(d.group);
      return d;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function start(inviteOnly = false) {
    const selected = inviteOnly ? [profiles[0]] : profiles;
    if (selected.some((p) => !p.name.trim() || !p.artists.length)) {
      setError("Wählt für jede Person mindestens einen Lieblingskünstler aus.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let d;
      if (joining) {
        d = await api("/api/join", { ...joining, profile: selected[0] });
        setJoining(null);
        sessionStorage.removeItem("cm_join");
      } else {
        d = await api("/api/groups", {
          name: selected
            .map((p) => p.name)
            .join(" & ")
            .slice(0, 60),
          profiles: selected,
          preferences: prefs,
        });
      }
      setGroup(d.group);
      setPrefs(d.group.preferences);
      setGroups((gs) => [
        { id: d.group.id, name: d.group.name },
        ...gs.filter((g) => g.id !== d.group.id),
      ]);
      setEdit(false);
      history.replaceState(null, "", "/?group=" + d.group.id);
      if (d.invite) {
        setInvite(location.origin + "/?join=" + d.group.id + "#" + d.invite);
        if (inviteOnly) setShareOpen(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile() {
    const p = profiles[0];
    if (!p.name.trim() || !p.artists.length) {
      toast.error("Ein Name und mindestens ein Künstler fehlen noch.");
      return;
    }
    const d = await action(
      editingMember
        ? { action: "profile", memberId: editingMember, profile: p }
        : { action: "add", profile: p },
    );
    if (d) {
      setEdit(false);
      toast.success("Musikgeschmack gespeichert.");
    }
  }
  async function share() {
    if (!group) return;
    if (invite) {
      setShareOpen(true);
      return;
    }
    const d = await action({ action: "invite" });
    if (d?.invite) {
      setInvite(location.origin + "/?join=" + group.id + "#" + d.invite);
      setShareOpen(true);
    }
  }
  function editProfile(id?: string) {
    const m = group?.members.find((m) => m.id === id);
    setEditingMember(id || null);
    setProfiles([
      m
        ? { name: m.name, artists: m.artists, genres: m.genres }
        : emptyProfile("Person " + ((group?.members.length || 0) + 1)),
    ]);
    setEdit(true);
  }
  const ranked = useMemo(
    () => (group ? rankConcerts(events, group.members, group.preferences) : []),
    [events, group],
  );
  const shown = useMemo(
    () =>
      !group
        ? []
        : tab === "saved"
          ? group.saved.map((c) =>
              matchConcert(c, group.members, group.preferences),
            )
          : tab === "discovery"
            ? ranked.filter((m) => m.discovery)
            : ranked,
    [ranked, group, tab],
  );
  async function changeGroup(id: string) {
    setInvite("");
    setEvents([]);
    history.replaceState(null, "", "/?group=" + id);
    await loadState(id);
  }
  function reset() {
    viewRevision.current++;
    searchRevision.current++;
    setEvents([]);
    setNotice("");
    setCheckedAt("");
    setSearching(false);
    setLoadError("");
    setGroup(null);
    setProfiles([emptyProfile("Du"), emptyProfile("Person 2")]);
    setPrefs(defaultPreferences());
    setError("");
    setInvite("");
    setEdit(false);
    history.replaceState(null, "", "/");
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: unknown, o: { signal: AbortSignal }) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const ac = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_concert_matches",
            title: "Konzert-Matches lesen",
            description:
              "Liest die aktuell sichtbare Auswahl und die erklärten Musikgeschmack-Werte. Ändert keine Daten.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Keine Parameter erwartet.");
              return {
                group: group?.name || null,
                matches: shown.slice(0, visible).map((m) => ({
                  title: m.concert.title,
                  date: m.concert.date,
                  city: m.concert.city,
                  score: m.score,
                  reasons: m.members,
                })),
                loading: searching,
              };
            },
          },
          { signal: ac.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => ac.abort();
  }, [group, shown, visible, searching]);
  return (
    <>
      <Toaster position="bottom-center" richColors />
      <header className="site-header">
        <a href="/" className="brand">
          ConcertMatch<span>.</span>
        </a>
        <div className="header-links">
          {groups.length > 0 && (
            <Select value={group?.id || ""} onValueChange={changeGroup}>
              <SelectTrigger
                aria-label="Gespeicherte Gruppen"
                className="group-picker"
              >
                <SelectValue placeholder="Meine Gruppen" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <a href="/methode">Wie es funktioniert</a>
        </div>
      </header>
      <main
        className={"main-content " + (group && !joining ? "has-results" : "")}
      >
        {!group || joining ? (
          <>
            <section className="intro">
              <h1>
                {joining ? (
                  "Schön, dass du mitkommst."
                ) : (
                  <>
                    Ein Konzert, auf das
                    <br />
                    ihr alle Lust habt.
                  </>
                )}
              </h1>
              <p>
                {joining
                  ? "Ergänze deinen Musikgeschmack für eure gemeinsame Auswahl."
                  : "Was hört ihr gern? Wählt ein paar Künstler. Wir suchen die passenden Konzerte."}
              </p>
            </section>
            {loadError && (
              <div className="message error" role="alert">
                {loadError}{" "}
                <button onClick={() => void loadState()}>
                  Erneut versuchen
                </button>
              </div>
            )}
            <form
              className="start-form"
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              {profiles.map((p, i) => (
                <ProfileEditor
                  key={i}
                  index={i}
                  value={p}
                  onChange={(v) =>
                    setProfiles((ps) => ps.map((x, j) => (j === i ? v : x)))
                  }
                  onRemove={
                    profiles.length > 2
                      ? () => setProfiles((ps) => ps.filter((_, j) => j !== i))
                      : undefined
                  }
                  spotify={providers.spotify && i === 0}
                />
              ))}
              {!joining && (
                <>
                  <div className="add-person-line">
                    <button
                      type="button"
                      className="text-link"
                      disabled={profiles.length >= 8}
                      onClick={() =>
                        setProfiles((p) => [
                          ...p,
                          emptyProfile("Person " + (p.length + 1)),
                        ])
                      }
                    >
                      <Plus size={16} /> Weitere Person
                    </button>
                    <button
                      type="button"
                      className="text-link muted-link"
                      disabled={busy || !profiles[0]?.artists.length}
                      onClick={() => void start(true)}
                    >
                      Lieber per Link einladen
                    </button>
                  </div>
                  <LocationFields value={prefs} onChange={setPrefs} />
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="submit-line">
                <button
                  className="primary"
                  disabled={busy || initializing}
                  type="submit"
                >
                  {busy
                    ? "Wird gespeichert …"
                    : joining
                      ? "Der Gruppe beitreten"
                      : "Konzerte finden"}
                  <ArrowRight size={18} />
                </button>
                <span>Kein Konto nötig.</span>
              </div>
              <p className="form-privacy">
                Eure Auswahl wird für 90 Tage gespeichert. Mit dem Gruppenlink
                teilt ihr eure Lieblingskünstler.{" "}
                <a href="/datenschutz">Mehr zum Datenschutz</a>
              </p>
            </form>
          </>
        ) : (
          <>
            <section className="result-intro">
              <div>
                <p className="back-link">
                  <button onClick={reset}>Neue Runde starten</button>
                </p>
                <h1>Eure Konzerte.</h1>
                <p>
                  {group.members.map((m) => m.name).join(", ")} ·{" "}
                  {group.preferences.city} + {group.preferences.radius} km
                </p>
              </div>
              {group.owner && (
                <button className="secondary" onClick={share} disabled={busy}>
                  <LinkIcon size={16} /> Einladen
                </button>
              )}
            </section>
            <div className="group-strip">
              {group.members.map((m, i) => (
                <button
                  className="member-pill"
                  key={m.id}
                  disabled={!m.mine}
                  onClick={() => editProfile(m.id)}
                  title={
                    m.mine
                      ? "Musikgeschmack bearbeiten"
                      : "Dieses Profil gehört einem anderen Gruppenmitglied"
                  }
                >
                  <span className={"person-dot person-" + (i % 4)}>
                    {m.name.slice(0, 1)}
                  </span>
                  {m.name}
                  <span className="artist-count">{m.artists.length}</span>
                </button>
              ))}
              {group.members.length < 8 && (
                <button className="text-link" onClick={() => editProfile()}>
                  <Plus size={15} /> Person
                </button>
              )}
            </div>
            {group.members.length === 1 && (
              <p className="message">
                Noch bist du allein in der Runde. Lade jemanden ein oder ergänze
                ein zweites Profil für gemeinsame Matches.
              </p>
            )}
            <div className="results-tools">
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v);
                  setVisible(15);
                }}
              >
                <TabsList className="view-tabs">
                  <TabsTrigger value="all">Konzerte</TabsTrigger>
                  <TabsTrigger value="discovery">Entdeckungen</TabsTrigger>
                  <TabsTrigger value="saved">
                    Merkliste{" "}
                    {group.saved.length > 0 && "(" + group.saved.length + ")"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <button
                className={
                  "text-link filter-toggle " + (filters ? "is-active" : "")
                }
                onClick={() => {
                  setPrefs(group.preferences);
                  setFilters(!filters);
                }}
              >
                <SlidersHorizontal size={16} /> Filter
              </button>
            </div>
            {filters && (
              <form
                className="filters"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = await action({
                    action: "preferences",
                    preferences: prefs,
                  });
                  if (d) setFilters(false);
                }}
              >
                <LocationFields value={prefs} onChange={setPrefs} />
                <div className="date-fields">
                  <label>
                    Ab
                    <input
                      type="date"
                      value={prefs.from}
                      required
                      onChange={(e) =>
                        setPrefs({ ...prefs, from: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Bis
                    <input
                      type="date"
                      value={prefs.to}
                      min={prefs.from}
                      required
                      onChange={(e) =>
                        setPrefs({ ...prefs, to: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Budget pro Person
                    <Select
                      value={String(prefs.budget)}
                      onValueChange={(v) =>
                        setPrefs({ ...prefs, budget: Number(v) })
                      }
                    >
                      <SelectTrigger aria-label="Budget">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 30, 50, 75, 100, 150, 250].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n ? "bis " + n + " €" : "Beliebig"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <label className="checkbox-label">
                  <Checkbox
                    checked={prefs.discovery}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, discovery: !!v })
                    }
                  />{" "}
                  Auch neue Künstler vorschlagen
                </label>
                <p className="small-note">
                  Kilometer sind Luftlinie. Bei einem Budget werden Konzerte
                  ohne verlässliche Euro-Preise ausgeblendet. Termine: maximal
                  ein Jahr.
                </p>
                <button className="primary small" disabled={busy}>
                  Filter anwenden
                </button>
              </form>
            )}
            <div aria-live="polite">
              {searching && tab !== "saved" ? (
                <div className="loading-results">
                  <p>Wir schauen nach passenden Konzerten …</p>
                  {[1, 2, 3].map((n) => (
                    <Skeleton key={n} className="result-skeleton" />
                  ))}
                </div>
              ) : error && tab !== "saved" ? (
                <div className="message error">
                  {error}
                  <button onClick={() => void search(group)}>
                    <RefreshCw size={14} /> Erneut versuchen
                  </button>
                </div>
              ) : (
                <>
                  {notice && tab !== "saved" && (
                    <p className="source-note">{notice}</p>
                  )}
                  {shown.length > 0 ? (
                    <>
                      <div className="result-count">
                        {shown.length}{" "}
                        {shown.length === 1 ? "Konzert" : "Konzerte"}
                        {tab !== "saved" &&
                          " · nach gemeinsamem Musikgeschmack"}
                      </div>
                      <div className="concert-list">
                        {shown.slice(0, visible).map((m) => (
                          <ConcertRow
                            key={m.concert.id}
                            match={m}
                            group={group}
                            busy={busy}
                            onAction={action}
                          />
                        ))}
                      </div>
                      {shown.length > visible && (
                        <button
                          className="secondary load-more"
                          onClick={() => setVisible((v) => v + 15)}
                        >
                          Weitere Konzerte anzeigen
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="empty-results">
                      <h2>
                        {tab === "saved"
                          ? "Was kommt in die engere Auswahl?"
                          : tab === "discovery"
                            ? "Gerade keine neuen Entdeckungen."
                            : "Hier ist es gerade still."}
                      </h2>
                      <p>
                        {tab === "saved"
                          ? "Merkt euch Konzerte mit dem Lesezeichen. Hier könnt ihr gemeinsam abstimmen."
                          : "Versucht einen größeren Umkreis oder Zeitraum. Auch weniger enge Preisfilter können helfen."}
                      </p>
                      <button
                        className="text-link"
                        onClick={() =>
                          tab === "saved" ? setTab("all") : setFilters(true)
                        }
                      >
                        {tab === "saved"
                          ? "Konzerte ansehen"
                          : "Filter anpassen"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="results-footnote">
              <p>
                Matchpunkte beschreiben musikalische Nähe, keine
                Erfolgswahrscheinlichkeit. <a href="/methode">So rechnen wir</a>
              </p>
              {checkedAt && (
                <p>
                  Konzertdaten: {new Date(checkedAt).toLocaleString("de-DE")} ·
                  Ticketmaster. Preise und Verfügbarkeit bitte beim Anbieter
                  prüfen.
                </p>
              )}
            </div>
            {group.owner && (
              <button
                className="text-link delete-group"
                onClick={() => setConfirmDelete(true)}
              >
                Gruppe löschen
              </button>
            )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>ConcertMatch von TiCore</span>
        <nav>
          <a href="/methode">Über das Matching</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="/impressum">Impressum</a>
        </nav>
      </footer>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="profile-dialog">
          <DialogTitle>
            {editingMember ? "Musikgeschmack bearbeiten" : "Person hinzufügen"}
          </DialogTitle>
          <DialogDescription>
            Mit drei bis fünf Künstlern werden die Vorschläge aussagekräftiger.
          </DialogDescription>
          <ProfileEditor
            value={profiles[0] || emptyProfile("Du")}
            onChange={(v) => setProfiles([v])}
            spotify={providers.spotify}
          />
          <button className="primary" disabled={busy} onClick={saveProfile}>
            Speichern
          </button>
          {editingMember && (
            <button
              className="text-link"
              disabled={busy}
              onClick={async () => {
                const d = await action({
                  action: "remove",
                  memberId: editingMember,
                });
                if (d) {
                  setEdit(false);
                  await loadState();
                }
              }}
            >
              Dieses Profil entfernen
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogTitle>Zusammen hingehen</DialogTitle>
          <DialogDescription>
            Schicke diesen Link an deine Begleitung. Wer ihn hat, kann beitreten
            und eure Lieblingskünstler, Merkliste und Stimmen sehen.
          </DialogDescription>
          <input
            className="share-input"
            aria-label="Einladungslink"
            value={invite}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite);
                toast.success("Link kopiert.");
              } catch {
                toast.error("Bitte den Link im Feld markieren und kopieren.");
              }
            }}
          >
            Link kopieren
          </button>
          {typeof navigator !== "undefined" && !!navigator.share && (
            <button
              className="secondary"
              onClick={() =>
                navigator
                  .share({
                    title: "Unser nächstes Konzert",
                    text: "Welche Konzerte passen zu uns?",
                    url: invite,
                  })
                  .catch(() => {})
              }
            >
              Teilen …
            </button>
          )}
          <p className="small-note">
            Teile den Link nur mit Menschen, die du einladen möchtest.
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogTitle>Diese Gruppe löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle Profile, gemerkten Konzerte und Abstimmungen dieser Gruppe
            werden entfernt. Das kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Behalten</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const d = await action({ action: "delete" });
                if (d?.deleted) {
                  reset();
                  await loadState();
                }
              }}
            >
              Gruppe löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function ConcertRow({
  match: m,
  group,
  busy,
  onAction,
}: {
  match: Match;
  group: Group;
  busy: boolean;
  onAction: (v: unknown) => Promise<unknown>;
}) {
  const [detail, setDetail] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const c = m.concert;
  const saved = group.saved.some((x) => x.id === c.id);
  const date = new Date(c.date + "T12:00:00Z");
  const dateLabel = date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <article className="concert-row">
      <div className="concert-art">
        {c.image && !imageFailed ? (
          <img
            src={"/api/image?url=" + encodeURIComponent(c.image)}
            alt=""
            loading="lazy"
            onError={(e) => {
              setImageFailed(true);
            }}
          />
        ) : (
          <span>{c.artists[0]?.name.slice(0, 1) || "♪"}</span>
        )}
      </div>
      <div className="concert-body">
        <div className="concert-meta">
          {dateLabel}
          {c.time ? " · " + c.time.slice(0, 5) + " Uhr" : ""}
          {c.status === "postponed"
            ? " · Verschoben"
            : c.status === "rescheduled"
              ? " · Neuer Termin"
              : ""}
        </div>
        <h2>
          <a href={c.url} target="_blank" rel="noopener noreferrer">
            {c.title}
          </a>
        </h2>
        <p className="venue">
          {c.venue}, {c.city} <span>· {m.distance} km</span>
        </p>
        <div className="concert-bottom">
          <button
            className={"match-label " + (m.score >= 65 ? "strong" : "")}
            onClick={() => setDetail(!detail)}
            aria-expanded={detail}
          >
            {m.score} Matchpunkte{m.discovery ? " · Neu für euch" : ""}
            <ChevronDown size={14} />
          </button>
          <span className="price">
            {c.price !== undefined
              ? new Intl.NumberFormat("de-DE", {
                  style: "currency",
                  currency: c.currency || "EUR",
                  maximumFractionDigits: 2,
                }).format(c.price) + " ab"
              : "Preis beim Anbieter"}
          </span>
        </div>
      </div>
      <button
        className={"bookmark-button " + (saved ? "saved" : "")}
        aria-label={
          saved ? c.title + " von der Merkliste entfernen" : c.title + " merken"
        }
        aria-pressed={saved}
        onClick={() => void onAction({ action: "save", eventId: c.id })}
        disabled={busy}
      >
        <Bookmark size={21} fill={saved ? "currentColor" : "none"} />
      </button>
      {detail && (
        <div className="match-detail">
          <h3>Warum dieses Konzert?</h3>
          {m.members.map((p) => (
            <div className="person-score" key={p.id}>
              <span>{p.name}</span>
              <b>{p.score}/100</b>
              <p>{p.reason}</p>
            </div>
          ))}
          <p className="small-note">
            Die niedrigste persönliche Passung zählt besonders stark. So
            überstimmt eine große Fangruppe niemanden.
          </p>
          <div className="detail-actions">
            <a
              className="secondary small"
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Termin & Tickets <ArrowUpRight size={15} />
            </a>
            <a
              className="text-link"
              href={
                "https://open.spotify.com/search/" +
                encodeURIComponent(c.artists[0]?.name || c.title)
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Auf Spotify reinhören <ArrowUpRight size={14} />
            </a>
            <button className="text-link" onClick={() => calendarFile(c)}>
              <CalendarPlus size={16} /> Im Kalender merken
            </button>
          </div>
          {saved && (
            <div className="voting">
              <h3>Wer ist dabei?</h3>
              {group.members.map((member) => (
                <div className="vote-line" key={member.id}>
                  <span>{member.name}</span>
                  <div>
                    {(["yes", "maybe", "no"] as const).map((v, i) => (
                      <button
                        key={v}
                        aria-pressed={group.votes.some(
                          (x) =>
                            x.eventId === c.id &&
                            x.memberId === member.id &&
                            x.value === v,
                        )}
                        disabled={!member.mine || busy}
                        onClick={() =>
                          void onAction({
                            action: "vote",
                            eventId: c.id,
                            memberId: member.id,
                            value: v,
                          })
                        }
                      >
                        {["Bin dabei", "Vielleicht", "Eher nicht"][i]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
