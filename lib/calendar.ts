import type { Concert } from "./types";
const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
export function calendarContent(c: Concert) {
  const day = c.date.replaceAll("-", "");
  const next = new Date(c.date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TiCore//ConcertMatch//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + escapeText(c.id) + "@concertmatch",
    "DTSTAMP:" +
      new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, ""),
    "DTSTART;VALUE=DATE:" + day,
    "DTEND;VALUE=DATE:" + next.toISOString().slice(0, 10).replaceAll("-", ""),
    "SUMMARY:" + escapeText(c.title),
    "LOCATION:" + escapeText(c.venue + ", " + c.city),
    "DESCRIPTION:" +
      escapeText(
        (c.time
          ? "Beginn laut Anbieter: " + c.time.slice(0, 5) + " Uhr (Ortszeit). "
          : "") +
          "Termin und Uhrzeit beim Anbieter prüfen. " +
          c.url,
      ),
    "URL:" + c.url,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        const segments = [];
        let current = "";
        for (const char of line) {
          if (new TextEncoder().encode(current + char).length > 73) {
            segments.push(current);
            current = " " + char;
          } else current += char;
        }
        segments.push(current);
        return segments.join("\r\n");
      })
      .join("\r\n") + "\r\n"
  );
}
export function calendarFile(c: Concert) {
  const url = URL.createObjectURL(
    new Blob([calendarContent(c)], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "concertmatch-" + c.date + ".ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
