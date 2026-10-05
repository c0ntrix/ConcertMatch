"use client";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
export default function PrivacyControls() {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/privacy",
        remove
          ? {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            }
          : undefined,
      );
      const d = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(d.error || "Bitte später erneut versuchen.");
      if (remove) {
        for (const key of [
          "cm_return_to_search",
          "cm_return_draft",
          "cm_join",
          "cm_spotify_draft",
          "cm_spotify_group",
          "cm_search_results_v1",
        ])
          sessionStorage.removeItem(key);
        window.dispatchEvent(new Event("cm-data-deleted"));
        setMessage(
          "Deine Profile und von dir erstellten Gruppen wurden gelöscht.",
        );
      } else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "concertmatch-daten.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("Dein Datenexport wurde erstellt.");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="legal-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void run()}
        >
          Meine Daten exportieren
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          Meine Daten löschen
        </button>
      </div>
      <p role="status" className="small-note">
        {message}
      </p>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Deine ConcertMatch-Daten löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle von diesem Browser erstellten Gruppen werden mit ihren
            Mitgliedern und Abstimmungen gelöscht. In anderen Gruppen werden
            deine eigenen Profile entfernt. Dies kann nicht rückgängig gemacht
            werden.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run(true)}>
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
