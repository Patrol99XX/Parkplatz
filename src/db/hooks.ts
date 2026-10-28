// Lesende Zugriffe für die Oberfläche. useLiveQuery liefert die Daten und
// aktualisiert die Anzeige automatisch, sobald sich in der Datenbank etwas ändert.
// Solange noch geladen wird, ist das Ergebnis „undefined“.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { aktiveRunde } from './aktionen'
import type { Einstellungen, Vorgang } from './typen'
import { platzText } from '../logik/stellplatz'

export function useEinstellungen() {
  return useLiveQuery(() => db.einstellungen.get('app'))
}

/** undefined = lädt noch, null = keine Kontrolle aktiv */
export function useAktiveRunde() {
  return useLiveQuery(async () => (await aktiveRunde()) ?? null)
}

export function ebenenName(e: Einstellungen | undefined, id: string): string {
  return e?.ebenen.find((x) => x.id === id)?.name ?? 'Unbekannte Ebene'
}

/** „0.05“ oder null, wenn das Fahrzeug keinen Platz hat bzw. die Ebene nicht nummeriert ist */
export function platzVon(e: Einstellungen | undefined, v: Pick<Vorgang, 'ebeneId' | 'stellplatz'>): string | null {
  const bereich = e?.ebenen.find((x) => x.id === v.ebeneId)?.stellplaetze
  return bereich && v.stellplatz != null ? platzText(bereich, v.stellplatz) : null
}

/** „Parkhaus Ebene 0 · Platz 0.05“ bzw. nur der Ebenenname */
export function ortText(e: Einstellungen | undefined, v: Pick<Vorgang, 'ebeneId' | 'stellplatz'>): string {
  const p = platzVon(e, v)
  return p ? `${ebenenName(e, v.ebeneId)} · Platz ${p}` : ebenenName(e, v.ebeneId)
}

/** Alle bisher eingegebenen Modelle, für die Vorschlagsliste beim Erfassen. */
export function useModellVorschlaege() {
  return useLiveQuery(async () => {
    const modelle = new Set<string>()
    await db.vorgaenge.each((v) => {
      if (v.modell) modelle.add(v.modell)
    })
    return [...modelle].sort((a, b) => a.localeCompare(b, 'de'))
  }, [])
}
