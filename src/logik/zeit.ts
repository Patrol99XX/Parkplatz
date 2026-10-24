import type { RundenTyp } from '../db/typen'

const datumFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const zeitFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const kurzDatumFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

/** TT.MM.JJJJ */
export function formatDatum(iso: string | Date): string {
  return datumFormat.format(new Date(iso))
}

/** HH:MM */
export function formatZeit(iso: string | Date): string {
  return zeitFormat.format(new Date(iso))
}

/** TT.MM.JJJJ, HH:MM */
export function formatDatumZeit(iso: string | Date): string {
  return `${formatDatum(iso)}, ${formatZeit(iso)}`
}

export function istGleicherTag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Anzahl Kalendertage zwischen zwei Zeitpunkten (Ortszeit), z. B. gestern 17 Uhr → heute 8 Uhr = 1. */
export function kalendertageZwischen(von: Date, bis: Date): number {
  const a = new Date(von.getFullYear(), von.getMonth(), von.getDate())
  const b = new Date(bis.getFullYear(), bis.getMonth(), bis.getDate())
  // Runden gleicht die Zeitumstellung aus (Tage mit 23 oder 25 Stunden).
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/** „seit heute, 08:15“ / „seit gestern, 16:40“ / „seit 3 Tagen (Mo., 21.10.)“ */
export function standdauerText(ersterfasstAm: string, jetzt: Date): string {
  const start = new Date(ersterfasstAm)
  const tage = kalendertageZwischen(start, jetzt)
  if (tage <= 0) return `seit heute, ${formatZeit(start)}`
  if (tage === 1) return `seit gestern, ${formatZeit(start)}`
  return `seit ${tage} Tagen (${kurzDatumFormat.format(start)})`
}

/** Vor 12 Uhr wird die Morgenkontrolle vorgeschlagen, danach die Nachmittagskontrolle. */
export function vorgeschlagenerRundenTyp(jetzt: Date): RundenTyp {
  return jetzt.getHours() < 12 ? 'morgens' : 'nachmittags'
}
