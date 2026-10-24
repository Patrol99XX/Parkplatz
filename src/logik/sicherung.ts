// Reine Hilfsfunktionen zur Datensicherung (ohne Datenbankzugriff, daher testbar).

export const SICHERUNG_FORMAT = 'parkplatz-kontrolle'
export const SICHERUNG_VERSION = 1
export const SICHERUNG_ERINNERUNG_TAGE = 7

/** Hinweis anzeigen, wenn noch nie oder vor mehr als 7 Tagen gesichert wurde. */
export function sicherungFaellig(letzteSicherungAm: string | null, jetzt: Date): boolean {
  if (!letzteSicherungAm) return true
  const alter = jetzt.getTime() - new Date(letzteSicherungAm).getTime()
  return alter > SICHERUNG_ERINNERUNG_TAGE * 24 * 60 * 60 * 1000
}

/** z. B. parkplatz-sicherung-2026-10-24-1530.json */
export function sicherungsDateiname(jetzt: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `parkplatz-sicherung-${jetzt.getFullYear()}-${z(jetzt.getMonth() + 1)}-${z(jetzt.getDate())}-${z(jetzt.getHours())}${z(jetzt.getMinutes())}.json`
}

export const TABELLEN = ['runden', 'vorgaenge', 'sichtungen', 'klaerungen', 'massnahmen', 'fotos', 'einstellungen'] as const
export type TabellenName = (typeof TABELLEN)[number]

export interface SicherungsDatei {
  format: typeof SICHERUNG_FORMAT
  version: number
  exportiertAm: string
  daten: Record<TabellenName, unknown[]>
}

/** Prüft grob, ob eine eingelesene Datei eine Sicherung dieser App ist. Liefert eine Fehlermeldung oder null. */
export function pruefeSicherung(inhalt: unknown): string | null {
  const s = inhalt as Partial<SicherungsDatei> | null
  if (!s || typeof s !== 'object' || s.format !== SICHERUNG_FORMAT) {
    return 'Das ist keine Sicherungsdatei der Parkplatz-Kontrolle.'
  }
  if (typeof s.version !== 'number' || s.version > SICHERUNG_VERSION) {
    return 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.'
  }
  if (!s.daten || TABELLEN.some((t) => !Array.isArray(s.daten![t]))) {
    return 'Die Sicherungsdatei ist unvollständig.'
  }
  if (s.daten.einstellungen.length !== 1) return 'In der Sicherung fehlen die Einstellungen.'
  return null
}
