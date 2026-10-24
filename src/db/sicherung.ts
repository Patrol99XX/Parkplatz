// Datensicherung als JSON-Datei. Fotos werden dafür in Text (Base64) umgewandelt,
// damit alles in einer einzigen Datei steckt.
import { db } from './db'
import type { Foto } from './typen'
import { jetztIso } from '../logik/uuid'
import {
  pruefeSicherung,
  SICHERUNG_FORMAT,
  SICHERUNG_VERSION,
  sicherungsDateiname,
  TABELLEN,
  type SicherungsDatei,
} from '../logik/sicherung'

type FotoExport = Omit<Foto, 'blob'> & { blob: string }

function blobZuDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => fehler(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataUrlZuBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

export async function sicherungErstellen(): Promise<{ datei: File; anzahlVorgaenge: number }> {
  const daten = {} as SicherungsDatei['daten']
  await db.transaction('r', db.tables, async () => {
    for (const t of TABELLEN) daten[t] = await db.table(t).toArray()
  })
  daten.fotos = await Promise.all(
    (daten.fotos as Foto[]).map(async (f): Promise<FotoExport> => ({ ...f, blob: await blobZuDataUrl(f.blob) })),
  )
  const inhalt: SicherungsDatei = {
    format: SICHERUNG_FORMAT,
    version: SICHERUNG_VERSION,
    exportiertAm: jetztIso(),
    daten,
  }
  const datei = new File([JSON.stringify(inhalt)], sicherungsDateiname(new Date()), { type: 'application/json' })
  return { datei, anzahlVorgaenge: daten.vorgaenge.length }
}

/**
 * Gibt die Datei weiter. Auf dem iPhone/iPad öffnet sich das Teilen-Menü
 * („In Dateien sichern“, AirDrop, Mail …), am PC wird sie heruntergeladen.
 * Liefert false, wenn der Nutzer das Teilen abbricht.
 */
export async function dateiWeitergeben(datei: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: datei.name })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      throw e
    }
  }
  const url = URL.createObjectURL(datei)
  const a = document.createElement('a')
  a.href = url
  a.download = datei.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

export async function sicherungMerken() {
  await db.einstellungen.update('app', { letzteSicherungAm: jetztIso() })
}

/**
 * Löscht alle Kontrollen, Fahrzeuge, Fotos usw. – z. B. Testdaten vor dem echten Start.
 * Die Einstellungen (Ebenen, E-Mail-Empfänger) bleiben erhalten.
 */
export async function alleDatenLoeschen() {
  const tabellen = TABELLEN.filter((t) => t !== 'einstellungen').map((t) => db.table(t))
  await db.transaction('rw', tabellen, async () => {
    for (const t of tabellen) await t.clear()
  })
}

/**
 * Stellt eine Sicherung wieder her. Alle vorhandenen Daten werden dabei ersetzt –
 * so ist der Stand danach genau der der Sicherung, ohne Mischmasch.
 */
export async function sicherungEinlesen(datei: File): Promise<number> {
  let inhalt: unknown
  try {
    inhalt = JSON.parse(await datei.text())
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden.')
  }
  const fehler = pruefeSicherung(inhalt)
  if (fehler) throw new Error(fehler)
  const s = inhalt as SicherungsDatei

  // Fotos vor der Transaktion umwandeln: In einer Dexie-Transaktion darf nicht
  // auf andere asynchrone Vorgänge (wie fetch) gewartet werden.
  const fotos: Foto[] = await Promise.all(
    (s.daten.fotos as FotoExport[]).map(async (f) => ({ ...f, blob: await dataUrlZuBlob(f.blob) })),
  )

  await db.transaction('rw', db.tables, async () => {
    for (const t of TABELLEN) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(t === 'fotos' ? fotos : s.daten[t])
    }
  })
  return s.daten.vorgaenge.length
}
