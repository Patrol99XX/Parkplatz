// Aufbewahrung (Datenschutz): Kennzeichen und Fotos sind personenbezogene Daten und werden
// nur so lange gehalten wie nötig. Fristen laufen ab dem Ende des Vorgangs; Fahrzeuge, die
// noch auf dem Gelände stehen, werden nie gelöscht.
// Reine Funktion: Sie plant nur, was zu löschen ist. Ausgeführt wird in db/aktionen.ts.
import type { Runde, Vorgang } from '../db/typen'

const TAG = 24 * 60 * 60 * 1000

/**
 * Untergrenze für die Vorgangsfrist: Die Wiederholer-Erkennung schaut 30 Tage zurück und
 * braucht dafür die beendeten Vorgänge.
 */
export const MIN_VORGAENGE_TAGE = 30
export const MIN_FOTOS_TAGE = 1

export interface Fristen {
  fotosTage: number
  vorgaengeTage: number
}

export interface BereinigungsPlan {
  /** Vorgänge, die mit allem, was daran hängt, gelöscht werden */
  vorgangIds: string[]
  /** Vorgänge, die bleiben, deren Fotos aber gelöscht werden */
  fotoVorgangIds: string[]
  /** Runden ohne verbleibende Sichtungen, älter als die Vorgangsfrist */
  rundenIds: string[]
}

function abgelaufen(iso: string | null, tage: number, jetzt: Date): boolean {
  return iso !== null && new Date(iso).getTime() < jetzt.getTime() - tage * TAG
}

/**
 * @param rundenMitSichtungen Runde-ID → IDs der Vorgänge, die in dieser Runde gesehen wurden
 */
export function bereinigungPlanen(
  vorgaenge: Pick<Vorgang, 'id' | 'offen' | 'beendetAm' | 'fotoIds'>[],
  runden: Pick<Runde, 'id' | 'gestartetAm' | 'beendetAm'>[],
  rundenMitSichtungen: Map<string, string[]>,
  fristen: Fristen,
  jetzt: Date,
): BereinigungsPlan {
  const beendet = vorgaenge.filter((v) => !v.offen)
  const vorgangIds = beendet.filter((v) => abgelaufen(v.beendetAm, fristen.vorgaengeTage, jetzt)).map((v) => v.id)
  const geloescht = new Set(vorgangIds)
  const fotoVorgangIds = beendet
    .filter((v) => !geloescht.has(v.id) && v.fotoIds.length > 0 && abgelaufen(v.beendetAm, fristen.fotosTage, jetzt))
    .map((v) => v.id)
  // Runden nur, wenn sie abgeschlossen, alt genug und danach leer sind (laufende Runde nie)
  const rundenIds = runden
    .filter(
      (r) =>
        r.beendetAm !== null &&
        abgelaufen(r.gestartetAm, fristen.vorgaengeTage, jetzt) &&
        (rundenMitSichtungen.get(r.id) ?? []).every((id) => geloescht.has(id)),
    )
    .map((r) => r.id)
  return { vorgangIds, fotoVorgangIds, rundenIds }
}
