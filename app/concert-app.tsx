"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Bookmark,
  Link as LinkIcon,
  SlidersHorizontal,
  CalendarPlus,
  RefreshCw,
  ChevronDown,
  ArrowLeft,
  Check,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import ProfileEditor, { type ProfileDraft } from "./profile-editor";
import AiDebug from "./ai-debug";
import SearchMode from "./search-mode";
import SearchLoading from "./search-loading";
import { defaultPreferences } from "@/lib/catalog";
import { SearchFields } from "./search-fields";
import {
  distanceLabel,
  groupTourMatches,
  matchConcert,
  rankConcerts,
} from "@/lib/matching";
import type {
  Artist,
  Concert,
  Group,
  Match,
  Preferences,
  Recommendations,
  RecommendationDebug,
} from "@/lib/types";
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
import { calendarFile } from "@/lib/calendar";
import { SearchResultCache, type SearchResults } from "@/lib/search-cache";
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
    artistMetadata?: Artist[];
    recommendations?: Recommendations;
    debug?: RecommendationDebug;
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
function SoundMark({ active = false }: { active?: boolean }) {
  return (
    <span
      className={"sound-mark" + (active ? " is-playing" : "")}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
export default function ConcertApp() {
  const [group, setGroup] = useState<Group | null>(null),
    [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<ProfileDraft[]>([
    emptyProfile("Du"),
  ]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [artistMetadata, setArtistMetadata] = useState<Artist[]>([]);
  const [providers, setProviders] = useState<ProviderState>({
    ticketmaster: false,
    spotify: false,
  });
  const [initializing, setInitializing] = useState(true),
    [busy, setBusy] = useState(false),
    [searching, setSearching] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendations>();
  const [refining, setRefining] = useState(false);
  const [recommendationNotice, setRecommendationNotice] = useState("");
  const [recommendationDebug, setRecommendationDebug] =
    useState<RecommendationDebug>();
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
  const [editingSelection, setEditingSelection] = useState(false);
  const [selectionMemberIds, setSelectionMemberIds] = useState<string[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [visible, setVisible] = useState(15),
    [checkedAt, setCheckedAt] = useState("");
  const [searchEpoch, setSearchEpoch] = useState(0);
  const viewRevision = useRef(0);
  const searchRevision = useRef(0);
  const resultCache = useRef(new SearchResultCache());
  const loadState = useCallback(async (id?: string) => {
    const revision = ++viewRevision.current;
    searchRevision.current++;
    setEvents([]);
    setArtistMetadata([]);
    setRecommendations(undefined);
    setRefining(false);
    setRecommendationNotice("");
    setRecommendationDebug(undefined);
    setNotice("");
    setCheckedAt("");
    setSearching(false);
    setTab("all");
    try {
      const d = await api(
        "/api/state" + (id ? "?group=" + encodeURIComponent(id) : ""),
      );
      if (revision !== viewRevision.current) return;
      setGroups(d.groups);
      setProviders(d.providers);
      setGroup(d.group);
      setEditingSelection(false);
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
      sessionStorage.setItem(
        "cm_join",
        JSON.stringify({ groupId: join, invite: invitation }),
      );
      history.replaceState(null, "", "/?join=" + encodeURIComponent(join));
    }
    const spotifyReturn = url.searchParams.has("spotify");
    const spotifyGroup = spotifyReturn
      ? sessionStorage.getItem("cm_spotify_group")
      : null;
    // Restore only an explicitly selected search, including an intentional Spotify return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState(
      url.searchParams.get("group") || spotifyGroup || undefined,
    ).then((restored) => {
      if (spotifyReturn) sessionStorage.removeItem("cm_spotify_group");
      if (restored?.group && url.searchParams.get("edit") === "1") {
        setSelectionMemberIds(restored.group.members.map((m) => m.id));
        setProfiles(
          restored.group.members.map((m) => ({
            name: m.name,
            artists: m.artists,
            genres: m.genres,
          })),
        );
        setPrefs(restored.group.preferences);
        setEditingSelection(true);
      }
      try {
        const draft = JSON.parse(
          sessionStorage.getItem("cm_return_draft") || "null",
        ) as {
          path?: string;
          profiles?: ProfileDraft[];
          prefs?: Preferences;
          expires?: number;
        } | null;
        sessionStorage.removeItem("cm_return_draft");
        if (
          draft?.path === url.pathname + url.search &&
          (draft.expires || 0) > Date.now() &&
          !spotifyReturn &&
          (!restored?.group || url.searchParams.get("edit") === "1") &&
          Array.isArray(draft.profiles) &&
          draft.profiles.length >= 1 &&
          draft.profiles.length <= 8 &&
          draft.prefs
        ) {
          setProfiles(draft.profiles);
          setPrefs(draft.prefs);
        }
      } catch {
        sessionStorage.removeItem("cm_return_draft");
      }
      if (join && /^[a-f0-9]{64}$/.test(invitation)) {
        setJoining({ groupId: join, invite: invitation });
        setProfiles([
          emptyProfile(
            "Person " + ((restored?.group?.members.length || 1) + 1),
          ),
        ]);
      }
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
              setProfiles([imported]);
              setEdit(false);
            }
            toast.success(
              "Spotify-Favoriten übernommen. Prüfe die Auswahl vor dem Speichern.",
            );
          })
          .catch((e) => toast.error(e.message));
        history.replaceState(
          null,
          "",
          restored?.group ? "/?group=" + restored.group.id : "/",
        );
      } else if (url.searchParams.get("spotify") === "error") {
        toast.error(
          "Spotify konnte nicht verbunden werden. Nutze die Künstlerauswahl oder versuche es erneut.",
        );
        history.replaceState(
          null,
          "",
          restored?.group ? "/?group=" + restored.group.id : "/",
        );
      }
    });
  }, [loadState]);
  const search = useCallback(async (g: Group, force = false) => {
    const request = ++searchRevision.current;
    const revision = viewRevision.current;
    const isCurrent = () =>
      request === searchRevision.current && revision === viewRevision.current;
    let storage: Storage | undefined;
    try {
      storage = sessionStorage;
    } catch {}
    const publish = (result: SearchResults) => {
      setEvents(result.events);
      setArtistMetadata(result.artistMetadata);
      setRecommendations(result.recommendations);
      setRecommendationDebug(result.recommendationDebug);
      setRecommendationNotice(result.recommendationNotice);
      setNotice(result.notice);
      setCheckedAt(result.checkedAt);
    };
    const restored = !force && resultCache.current.get(g, storage);
    if (restored) {
      publish({
        ...restored,
        recommendationDebug: restored.recommendationDebug
          ? {
              ...restored.recommendationDebug,
              status: "results-cache",
              durationMs: 0,
            }
          : undefined,
      });
      setSearching(false);
      setRefining(false);
      setError("");
      return;
    }
    setEvents([]);
    setArtistMetadata([]);
    setRecommendations(undefined);
    setRefining(false);
    setRecommendationNotice("");
    setRecommendationDebug(undefined);
    setNotice("");
    setCheckedAt("");
    setSearching(true);
    setError("");
    setVisible(15);
    setTab("all");
    try {
      const d = await api("/api/concerts?group=" + g.id);
      if (!isCurrent()) return;
      const result: SearchResults = {
        events: d.events,
        artistMetadata: d.artistMetadata || [],
        notice: d.notice || "",
        checkedAt: d.checkedAt || "",
        recommendationNotice: "",
      };
      if (g.preferences.aiSearch && d.events.length) {
        setRefining(true);
        try {
          const refined = await api("/api/recommendations", {
            groupId: g.id,
          });
          if (!isCurrent()) return;
          result.recommendations = refined.recommendations;
          result.recommendationDebug = refined.debug;
          result.recommendationNotice =
            refined.notice ||
            "KI-Bewertungen ergänzen den Abgleich nach Favoriten und Musikstilen.";
        } catch {
          if (isCurrent()) {
            result.recommendationDebug = { status: "request-error" };
            result.recommendationNotice =
              "Die KI ist gerade nicht verfügbar. Deine Ergebnisse beruhen auf Favoriten und Musikstilen.";
          }
        } finally {
          if (isCurrent()) setRefining(false);
        }
      }
      if (!isCurrent()) return;
      // Publish the completed search once, after optional AI assessment.
      resultCache.current.put(g, result, storage);
      publish(result);
    } catch (e) {
      if (!isCurrent()) return;
      setError((e as Error).message);
      setEvents([]);
    } finally {
      if (isCurrent()) setSearching(false);
    }
  }, []);
  const solo = group?.members.length === 1;
  const soloDraft = profiles.length === 1;
  const groupId = group?.id;
  const prefsKey = group ? JSON.stringify(group.preferences) : "";
  const tasteKey = group
    ? JSON.stringify(group.members.map((m) => [m.id, m.artists, m.genres]))
    : "";
  const invalidateSearch = useCallback(() => {
    searchRevision.current++;
  }, []);
  useEffect(() => {
    // Starting an external fetch updates its loading state; keys avoid fetching on unrelated group changes.
    if (groupId && group && !editingSelection)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void search(group);
    return invalidateSearch;
    // Group names, bookmarks and votes do not invalidate the search identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    groupId,
    prefsKey,
    tasteKey,
    searchEpoch,
    search,
    invalidateSearch,
    editingSelection,
    group?.preferences.aiSearch,
  ]);
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
      if (d.deleted || d.left) {
        try {
          resultCache.current.remove(group.id, sessionStorage);
        } catch {
          resultCache.current.remove(group.id);
        }
      }
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
    const selected = (inviteOnly ? [profiles[0]] : profiles).map((p, i) => ({
      ...p,
      name: p.name.trim() || (i === 0 ? "Du" : "Person " + (i + 1)),
    }));
    if (selected.some((p) => !p.artists.length)) {
      setError(
        selected.length === 1
          ? "Wähle mindestens einen Lieblingskünstler aus."
          : "Wählt für jede Person mindestens einen Lieblingskünstler aus.",
      );
      return;
    }
    if (editingSelection && group) {
      const d = await action({
        action: "selection",
        profiles: selected.flatMap((profile, i) =>
          group.members.some((m) => m.id === selectionMemberIds[i] && m.mine)
            ? [{ memberId: selectionMemberIds[i], profile }]
            : [],
        ),
        preferences: prefs,
      });
      if (d?.group) {
        setEditingSelection(false);
        setError("");
        history.replaceState(null, "", "/?group=" + d.group.id);
        window.scrollTo({ top: 0, behavior: "instant" });
        toast.success("Auswahl gespeichert. Die Merkliste bleibt erhalten.");
      }
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
          name: (selected.length === 1
            ? "Meine Konzerte in " + prefs.city
            : selected.map((p) => p.name).join(" & ")
          ).slice(0, 60),
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
      window.scrollTo({ top: 0, behavior: "instant" });
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
    const p = {
      ...profiles[0],
      name:
        profiles[0].name.trim() ||
        (editingMember ? "Du" : "Person " + ((group?.members.length || 0) + 1)),
    };
    if (!p.artists.length) {
      toast.error("Wähle mindestens einen Lieblingskünstler aus.");
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
  const matchingMembers = useMemo(() => {
    const metadata = new Map(artistMetadata.map((a) => [a.id, a]));
    return (
      group?.members.map((m) => ({
        ...m,
        artists: m.artists.map((a) => metadata.get(a.id) || a),
      })) || []
    );
  }, [group, artistMetadata]);
  const ranked = useMemo(
    () =>
      group
        ? rankConcerts(
            events,
            matchingMembers,
            group.preferences,
            recommendations,
          )
        : [],
    [events, group, matchingMembers, recommendations],
  );
  const shown = useMemo(
    () =>
      !group
        ? []
        : tab === "saved"
          ? group.saved.map((c) =>
              matchConcert(
                c,
                matchingMembers,
                group.preferences,
                recommendations,
              ),
            )
          : groupTourMatches(ranked),
    [ranked, group, tab, matchingMembers, recommendations],
  );
  async function changeGroup(id: string) {
    setInvite("");
    setEvents([]);
    history.replaceState(null, "", "/?group=" + id);
    await loadState(id);
  }
  function beginSelection(target = group) {
    if (!target) return;
    setSelectionMemberIds(target.members.map((m) => m.id));
    setProfiles(
      target.members.map((m) => ({
        name: m.name,
        artists: m.artists,
        genres: m.genres,
      })),
    );
    setPrefs(target.preferences);
    setEditingSelection(true);
    setEdit(false);
    setFilters(false);
    setError("");
    history.replaceState(null, "", "/?group=" + target.id + "&edit=1");
    window.scrollTo({ top: 0 });
  }
  function returnToResults() {
    setEditingSelection(false);
    setError("");
    if (group) history.replaceState(null, "", "/?group=" + group.id);
    window.scrollTo({ top: 0 });
  }
  function reset() {
    setEditingSelection(false);
    setJoining(null);
    sessionStorage.removeItem("cm_join");
    sessionStorage.removeItem("cm_return_draft");
    viewRevision.current++;
    searchRevision.current++;
    setEvents([]);
    setArtistMetadata([]);
    setRecommendations(undefined);
    setRefining(false);
    setRecommendationNotice("");
    setRecommendationDebug(undefined);
    setNotice("");
    setCheckedAt("");
    setSearching(false);
    setLoadError("");
    setGroup(null);
    setProfiles([emptyProfile("Du")]);
    setPrefs(defaultPreferences());
    setTab("all");
    setError("");
    setInvite("");
    setEdit(false);
    history.replaceState(null, "", "/");
  }
  useEffect(() => {
    sessionStorage.setItem(
      "cm_return_to_search",
      groupId
        ? "/?group=" + groupId + (editingSelection ? "&edit=1" : "")
        : "/",
    );
  }, [groupId, editingSelection]);
  useEffect(() => {
    function rememberDraft(event: MouseEvent) {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        anchor &&
        ["/datenschutz", "/impressum", "/methode"].includes(
          new URL(anchor.href).pathname,
        ) &&
        (!groupId || editingSelection) &&
        !joining
      ) {
        sessionStorage.setItem(
          "cm_return_draft",
          JSON.stringify({
            path: location.pathname + location.search,
            profiles,
            prefs,
            expires: Date.now() + 30 * 60000,
          }),
        );
      }
    }
    document.addEventListener("click", rememberDraft, true);
    return () => document.removeEventListener("click", rememberDraft, true);
  }, [groupId, editingSelection, joining, profiles, prefs]);
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
      <a className="skip-link" href="#main">
        Zur Suche springen
      </a>
      <header className="site-header">
        <Link
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            if (group && !joining) beginSelection();
            else reset();
          }}
        >
          <SoundMark /> ConcertMatch
        </Link>
        <nav className="header-links" aria-label="Hauptnavigation">
          {groups.length > 0 && (
            <Select value={group?.id || ""} onValueChange={changeGroup}>
              <SelectTrigger
                aria-label="Gespeicherte Konzertsuche"
                className="group-picker"
              >
                <SelectValue placeholder="Meine Suchen">
                  {group
                    ? (
                        groups.find((g) => g.id === group.id)?.name ||
                        "Meine Suchen"
                      ).replace(
                        /^Meine Konzerte\s+\u00b7\s+/,
                        "Meine Konzerte in ",
                      )
                    : "Meine Suchen"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name.replace(
                      /^Meine Konzerte\s+\u00b7\s+/,
                      "Meine Konzerte in ",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <a href="/methode">
            So funktioniert’s <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={
          "main-content " +
          (group && !joining && !editingSelection ? "has-results" : "")
        }
      >
        {!group || joining || editingSelection ? (
          <>
            {editingSelection && (
              <p className="back-link selection-back">
                <button
                  className="navigation-button"
                  onClick={returnToResults}
                  disabled={busy}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  {solo
                    ? "Zurück zu deinen Konzerten"
                    : "Zurück zu euren Konzerten"}
                </button>
              </p>
            )}
            <div className="landing-grid">
              <section className="intro">
                <h1>
                  {joining ? (
                    "Der Gruppe beitreten"
                  ) : (
                    <>
                      {soloDraft ? "Konzerte" : "Gemeinsam Konzerte"}
                      <br /> finden.
                    </>
                  )}
                </h1>
                <p>
                  {joining
                    ? "Füge deine Lieblingskünstler zur gemeinsamen Suche hinzu."
                    : soloDraft
                      ? "Wähle Lieblingskünstler, Suchort und Zeitraum."
                      : "Wählt eure Lieblingskünstler, einen Suchort und Zeitraum."}
                </p>
                <div className="hero-photo" aria-hidden="true">
                  {/* The original concert photograph keeps the visual rooted in real live music. */}
                  <picture>
                    <source media="(min-width: 781px)" srcSet="/crowd.webp" />
                    <img
                      src="/crowd-preview.webp"
                      alt=""
                      fetchPriority="high"
                      width={3000}
                      height={4000}
                    />
                  </picture>
                  <span className="photo-corner">
                    <SoundMark />
                  </span>
                </div>
              </section>
              <form
                className={
                  "start-form" +
                  (soloDraft &&
                  !joining &&
                  !editingSelection &&
                  profiles[0]?.name === "Du"
                    ? " solo-search"
                    : "")
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  void start();
                }}
              >
                {loadError && (
                  <div className="message error" role="alert">
                    {loadError}{" "}
                    <button type="button" onClick={() => void loadState()}>
                      Erneut versuchen
                    </button>
                  </div>
                )}
                <div className="form-section-title">
                  <span className="section-number" aria-hidden="true">
                    01
                  </span>
                  <h2>{soloDraft ? "Deine Musik" : "Eure Musik"}</h2>
                </div>
                {profiles.map((p, i) =>
                  editingSelection &&
                  !group?.members.some(
                    (m) => m.id === selectionMemberIds[i] && m.mine,
                  ) ? (
                    <div className="shared-profile" key={selectionMemberIds[i]}>
                      <strong>{p.name}</strong>
                      <p>{p.artists.map((a) => a.name).join(", ")}</p>
                      <span>Wird von dieser Person selbst bearbeitet.</span>
                    </div>
                  ) : (
                    <ProfileEditor
                      key={i}
                      index={i}
                      showName={
                        !soloDraft ||
                        !!joining ||
                        (!!group && group.members.length > 1)
                      }
                      value={p}
                      onChange={(v) =>
                        setProfiles((ps) => ps.map((x, j) => (j === i ? v : x)))
                      }
                      onRemove={
                        !editingSelection && profiles.length > 1 && i > 0
                          ? () =>
                              setProfiles((ps) => ps.filter((_, j) => j !== i))
                          : undefined
                      }
                      spotify={providers.spotify && i === 0}
                    />
                  ),
                )}
                {!joining && (
                  <>
                    {!editingSelection && (
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
                          <Plus size={16} />
                          {soloDraft
                            ? "Mit Freunden suchen"
                            : "Person hinzufügen"}
                        </button>
                        {profiles[0]?.artists.length > 0 && (
                          <button
                            type="button"
                            className="text-link muted-link"
                            disabled={busy}
                            onClick={() => void start(true)}
                          >
                            <LinkIcon size={14} aria-hidden="true" /> Per Link
                            einladen
                          </button>
                        )}
                      </div>
                    )}
                    <div className="form-section-title location-title">
                      <span className="section-number" aria-hidden="true">
                        02
                      </span>
                      <h2>Wo & wann?</h2>
                    </div>
                    <SearchFields value={prefs} onChange={setPrefs} />
                    <SearchMode
                      enabled={!!prefs.aiSearch}
                      onChange={(aiSearch) => setPrefs({ ...prefs, aiSearch })}
                    />
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
                        : editingSelection
                          ? "Auswahl speichern & suchen"
                          : "Konzerte finden"}
                    {busy ? (
                      <SoundMark active />
                    ) : (
                      <ArrowRight size={18} aria-hidden="true" />
                    )}
                  </button>
                  {editingSelection ? (
                    <button
                      type="button"
                      className="text-link"
                      onClick={returnToResults}
                      disabled={busy}
                    >
                      Abbrechen
                    </button>
                  ) : (
                    <span>
                      <Check size={13} aria-hidden="true" /> Ohne Konto
                    </span>
                  )}
                </div>
                <p className="form-privacy">
                  {editingSelection
                    ? "Deine Merkliste und Einladungen bleiben erhalten."
                    : joining
                      ? "Deine Auswahl wird mit der Gruppe geteilt und 90 Tage gespeichert."
                      : soloDraft
                        ? "Deine Suche bleibt 90 Tage gespeichert. Beitritt nur per Einladungslink."
                        : "Eure Suche bleibt 90 Tage gespeichert. Beitritt nur per Einladungslink."}{" "}
                  <a href="/datenschutz">Datenschutz</a>
                </p>
              </form>
            </div>
          </>
        ) : (
          <>
            <section className="result-intro">
              <div>
                <p className="back-link result-navigation">
                  <button
                    className="navigation-button"
                    onClick={() => beginSelection()}
                  >
                    <ArrowLeft size={18} aria-hidden="true" /> Auswahl
                    bearbeiten
                  </button>
                  <button className="navigation-button" onClick={reset}>
                    <Plus size={18} aria-hidden="true" /> Neue Suche
                  </button>
                </p>
                <h1>{solo ? "Suchergebnisse" : "Gemeinsame Suchergebnisse"}</h1>
                <p className="result-summary">
                  <span>{group.members.map((m) => m.name).join(", ")}</span>
                  <span>
                    {group.preferences.city} im Umkreis von{" "}
                    {group.preferences.radius} km
                  </span>
                </p>
              </div>
              {group.owner && (
                <button className="secondary" onClick={share} disabled={busy}>
                  <LinkIcon size={16} />{" "}
                  {solo ? "Freunde einladen" : "Einladen"}
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
                aria-expanded={filters}
                aria-controls="search-filters"
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
                id="search-filters"
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
                <SearchFields value={prefs} onChange={setPrefs} />
                <SearchMode
                  enabled={!!prefs.aiSearch}
                  onChange={(aiSearch) => setPrefs({ ...prefs, aiSearch })}
                />
                <label className="checkbox-label">
                  <Checkbox
                    checked={prefs.discovery}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, discovery: !!v })
                    }
                  />{" "}
                  Auch ähnliche Künstler entdecken
                </label>
                <p className="small-note">Umkreis in Luftlinie.</p>
                <button className="primary small" disabled={busy}>
                  Filter anwenden
                </button>
              </form>
            )}
            <p className="sr-only" role="status">
              {searching && tab !== "saved"
                ? "Passende Konzerte werden gesucht."
                : `${shown.length} ${shown.length === 1 ? "Konzert" : "Konzerte"} gefunden.`}
            </p>
            <div aria-busy={searching && tab !== "saved"}>
              {searching && tab !== "saved" ? (
                <SearchLoading refining={refining} />
              ) : error && tab !== "saved" ? (
                <div className="message error">
                  {error}
                  <button onClick={() => void search(group, true)}>
                    <RefreshCw size={14} /> Erneut versuchen
                  </button>
                </div>
              ) : (
                <>
                  {shown.length > 0 ? (
                    <>
                      <div className="result-count">
                        {shown.length}{" "}
                        {shown.length === 1 ? "Konzert" : "Konzerte"}
                        {tab !== "saved" &&
                          (solo
                            ? " nach deinem Musikgeschmack"
                            : " nach gemeinsamem Musikgeschmack")}
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
                          ? "Noch keine Konzerte gemerkt"
                          : "Keine passenden Konzerte gefunden"}
                      </h2>
                      <p>
                        {tab === "saved"
                          ? solo
                            ? "Merke interessante Konzerte mit dem Lesezeichen. Hier findest du sie später wieder."
                            : "Merkt euch Konzerte mit dem Lesezeichen. Hier könnt ihr gemeinsam abstimmen."
                          : group.preferences.budget
                            ? "Für diese Auswahl sind keine passenden Euro-Preise gemeldet. Ohne Budgetfilter kannst du auch Termine ohne Preisangabe ansehen."
                            : "Versuche einen größeren Umkreis oder Zeitraum."}
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
              {tab !== "saved" && (
                <p role="status">{!searching && recommendationNotice}</p>
              )}
              {notice && <p>{notice}</p>}
              <p>
                Matchpunkte beschreiben musikalische Nähe, keine
                Erfolgswahrscheinlichkeit. <a href="/methode">So rechnen wir</a>
              </p>
              {checkedAt && (
                <p>
                  Konzertdaten von Ticketmaster, Stand{" "}
                  {new Date(checkedAt).toLocaleString("de-DE")}. Preise und
                  Verfügbarkeit bitte beim Anbieter prüfen.
                </p>
              )}
              {tab !== "saved" && (
                <AiDebug debug={recommendationDebug} pending={refining} />
              )}
            </div>
            {group.owner && (
              <button
                className="text-link delete-group"
                onClick={() => setConfirmDelete(true)}
              >
                {solo ? "Suche löschen" : "Gruppe löschen"}
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
            showName={!editingMember || (!!group && group.members.length > 1)}
            onChange={(v) => setProfiles([v])}
            spotify={providers.spotify}
          />
          <button className="primary" disabled={busy} onClick={saveProfile}>
            Speichern
          </button>
          {editingMember && group && group.members.length > 1 && (
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
          <AlertDialogTitle>
            {solo ? "Diese Suche löschen?" : "Diese Gruppe löschen?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {solo
              ? "Dein Profil und alle gemerkten Konzerte dieser Suche werden entfernt."
              : "Alle Profile, gemerkten Konzerte und Abstimmungen dieser Gruppe werden entfernt."}
            Das kann nicht rückgängig gemacht werden.
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
              {solo ? "Suche löschen" : "Gruppe löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function ConcertRow({
  match: result,
  group,
  busy,
  onAction,
}: {
  match: Match;
  group: Group;
  busy: boolean;
  onAction: (v: unknown) => Promise<unknown>;
}) {
  const detailId = useId();
  const datesId = useId();
  const [selectedDate, setSelectedDate] = useState(result.concert.id);
  const [datesOpen, setDatesOpen] = useState(false);
  const m =
    result.alternatives?.find((date) => date.concert.id === selectedDate) ||
    result;
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
          // Images use the validated provider proxy; this deployment has no image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"/api/image?url=" + encodeURIComponent(c.image)}
            alt=""
            loading="lazy"
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <span>{c.artists[0]?.name.slice(0, 1) || "♪"}</span>
        )}
      </div>
      <div className="concert-body">
        <div className="concert-meta">
          <span>{dateLabel}</span>
          {c.time && <span>{c.time.slice(0, 5)} Uhr</span>}
          {(c.status === "postponed" || c.status === "rescheduled") && (
            <span className="concert-status">
              {c.status === "postponed" ? "Verschoben" : "Neuer Termin"}
            </span>
          )}
        </div>
        <div className="concert-heading">
          <h2>{c.title}</h2>
          <a
            className="text-link concert-listen"
            href={
              "https://open.spotify.com/search/" +
              encodeURIComponent(c.artists[0]?.name || c.title)
            }
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              (c.artists[0]?.name || c.title) +
              " auf Spotify anhören (öffnet in neuem Tab)"
            }
          >
            Auf Spotify reinhören <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <p className="venue">
          {c.venue}
          {distanceLabel(m, group.preferences).startsWith("in ")
            ? ""
            : ", " + c.city}{" "}
          <span
            title={"Luftlinie ab dem Zentrum von " + group.preferences.city}
          >
            {distanceLabel(m, group.preferences)}
          </span>
        </p>
        <div className="concert-bottom">
          <button
            className={"match-label " + (m.score >= 65 ? "strong" : "")}
            onClick={() => setDetail(!detail)}
            aria-expanded={detail}
            aria-controls={detailId}
          >
            {m.score} Matchpunkte
            {m.discovery && (
              <span className="discovery-label">
                {group.members.length === 1 ? "Neu für dich" : "Neu für euch"}
              </span>
            )}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <div className="concert-ticket">
            {c.price !== undefined && (
              <span className="price">
                {"Ab " +
                  new Intl.NumberFormat("de-DE", {
                    style: "currency",
                    currency: c.currency || "EUR",
                    maximumFractionDigits: 2,
                  }).format(c.price)}
              </span>
            )}
            <a
              className="ticket-link"
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                "Tickets für " +
                c.title +
                " bei " +
                c.source +
                " ansehen (öffnet in neuem Tab)"
              }
              title={"Verfügbarkeit bei " + c.source + " prüfen"}
            >
              Tickets ansehen <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        {result.alternatives && (
          <div className="tour-dates">
            <button
              className="text-link tour-dates-toggle"
              aria-expanded={datesOpen}
              aria-controls={datesId}
              onClick={() => setDatesOpen(!datesOpen)}
            >
              {result.alternatives.length} Termine & Orte{" "}
              <ChevronDown size={14} />
            </button>
            {datesOpen && (
              <div
                id={datesId}
                className="tour-date-options"
                role="group"
                aria-label={"Termin für " + c.artists[0]?.name + " auswählen"}
              >
                {result.alternatives.map((date) => (
                  <button
                    key={date.concert.id}
                    aria-pressed={c.id === date.concert.id}
                    onClick={() => {
                      setSelectedDate(date.concert.id);
                      setImageFailed(false);
                    }}
                  >
                    <span>
                      {date.concert.city},{" "}
                      {new Date(
                        date.concert.date + "T12:00:00Z",
                      ).toLocaleDateString("de-DE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                      {date.concert.time
                        ? " um " + date.concert.time.slice(0, 5) + " Uhr"
                        : ""}
                    </span>
                    <small>
                      {date.concert.venue},{" "}
                      {distanceLabel(date, group.preferences)}
                    </small>
                    {date.concert.id === c.id && (
                      <span className="selected-date-label">Ausgewählt</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
        <div className="match-detail" id={detailId}>
          <h3>Warum dieses Konzert?</h3>
          {m.members.map((p) => (
            <div className="person-score" key={p.id}>
              <span>{p.name}</span>
              <b>{p.score}/100</b>
              <p>{p.reason.replace(/\s+\u00b7\s+/g, ", ")}</p>
            </div>
          ))}
          <p className="small-note">
            {group.members.length === 1
              ? "Die Matchpunkte beziehen sich auf deinen eigenen Musikgeschmack."
              : "Die niedrigste persönliche Passung zählt besonders stark. So überstimmt eine große Fangruppe niemanden."}
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
            <button className="text-link" onClick={() => calendarFile(c)}>
              <CalendarPlus size={16} /> Im Kalender merken
            </button>
          </div>
          {saved && group.members.length > 1 && (
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
