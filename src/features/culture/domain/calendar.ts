import type { CulturalEvent, EventText, Place } from "./types"

const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
const stamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")

/** Fold by UTF-8 octets (RFC 5545), without splitting accented characters. */
function fold(line: string): string {
  let output = "",
    length = 0
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length
    if (length + bytes > 75) {
      output += "\r\n "
      length = 1
    }
    output += char
    length += bytes
  }
  return output
}

export function eventCalendar(
  event: CulturalEvent,
  text: EventText,
  place: Place | undefined
): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mataro Cultura//Agenda//CA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@cultura`,
    `DTSTAMP:${stamp(event.updated_at)}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(event.ends_at)}`,
    `SUMMARY:${escape(text.title)}`,
    `DESCRIPTION:${escape([text.summary, event.schedule_notes].filter(Boolean).join("\n"))}`,
    `LOCATION:${escape(place ? `${place.name}, ${place.address}` : "")}`,
    `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n")
}
