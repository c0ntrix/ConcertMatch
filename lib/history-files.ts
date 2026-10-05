import { strFromU8, unzipSync } from "fflate";
import { historyAccumulator } from "./history-import";

const MB = 1024 * 1024;
export const HISTORY_LIMITS = {
  input: 100 * MB,
  file: 50 * MB,
  expanded: 200 * MB,
  files: 64,
};
export function isAudioHistory(path: string) {
  const name = path.replace(/\\/g, "/").split("/").pop() || "";
  return (
    !path.startsWith("__MACOSX/") &&
    !name.startsWith(".") &&
    /^(Streaming_History_Audio.*|StreamingHistory(?:_music)?(?:_?\d+)?)\.json$/i.test(
      name,
    )
  );
}
type HistoryFile = Pick<File, "name" | "size" | "arrayBuffer">;
export async function readHistoryFiles(
  files: HistoryFile[],
  progress: (text: string) => void = () => {},
) {
  if (
    files.length > HISTORY_LIMITS.files ||
    files.reduce((sum, file) => sum + file.size, 0) > HISTORY_LIMITS.input
  )
    throw new Error(
      "Bitte höchstens 100 MB oder 64 Dateien auswählen. Bei großen Exporten kannst du einzelne Audio-JSON-Dateien verwenden.",
    );
  const accumulator = historyAccumulator();
  let expanded = 0,
    count = 0;
  function check(size: number) {
    expanded += size;
    count++;
    if (
      size > HISTORY_LIMITS.file ||
      expanded > HISTORY_LIMITS.expanded ||
      count > HISTORY_LIMITS.files
    )
      throw new Error(
        "Der Musik-Hörverlauf ist zu groß. Bitte einzelne Audio-JSON-Dateien wählen (höchstens 50 MB je Datei und 200 MB entpackt).",
      );
  }
  for (const file of files) {
    progress("Musikdateien werden im Browser gelesen …");
    if (/\.zip$/i.test(file.name)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let entries;
      try {
        entries = unzipSync(bytes, {
          filter: (entry) => {
            if (!isAudioHistory(entry.name)) return false;
            check(entry.originalSize);
            return true;
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("zu groß"))
          throw error;
        throw new Error(
          "Die ZIP-Datei konnte nicht geöffnet werden. Bitte den unveränderten Spotify-Datenexport wählen.",
        );
      }
      for (const name of Object.keys(entries).sort()) {
        progress("Audio-Hörverlauf wird ausgewertet …");
        accumulator.add(strFromU8(entries[name]));
        delete entries[name];
      }
    } else if (/\.json$/i.test(file.name)) {
      if (/Streaming_History_Video/i.test(file.name)) continue;
      check(file.size);
      accumulator.add(strFromU8(new Uint8Array(await file.arrayBuffer())));
    } else
      throw new Error(
        "Bitte eine Spotify-ZIP oder Audio-JSON-Dateien auswählen.",
      );
  }
  if (!count)
    throw new Error(
      "Keine Audio-Hörverlaufsdateien in dieser ZIP gefunden. Bitte den Spotify-Export mit dem Musik-Hörverlauf wählen.",
    );
  return accumulator.result();
}
