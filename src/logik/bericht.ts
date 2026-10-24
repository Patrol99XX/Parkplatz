// Bericht nach einer Kontrolle, als Text für eine E-Mail.
// Reine Funktion ohne Datenbankzugriff, damit sie sich testen lässt.
import {
  KATEGORIE_TEXT,
  RUNDEN_TYP_TEXT,
  type Ebene,
  type Runde,
  type SichtungsErgebnis,
  type Vorgang,
} from '../db/typen'
import { formatDatum, formatDatumZeit, formatZeit, kalendertageZwischen, standdauerText } from './zeit'

/** In den Bericht kommen nur Fahrzeuge, die seit gestern oder länger stehen. */
export const BERICHT_AB_TAGEN = 1

export interface BerichtDaten {
  runde: Runde
  /** Zählung der Sichtungen dieser Runde */
  zahlen: Record<SichtungsErgebnis, number>
  /** aktuell offene Vorgänge */
  offene: Vorgang[]
  /** wie oft jeder Vorgang bisher gesehen wurde */
  gesehen: Map<string, number>
  ebenen: Ebene[]
  jetzt: Date
}

export function langeStehende(offene: Vorgang[], jetzt: Date): Vorgang[] {
  return offene
    .filter((v) => kalendertageZwischen(new Date(v.ersterfasstAm), jetzt) >= BERICHT_AB_TAGEN)
    .sort((a, b) => a.ersterfasstAm.localeCompare(b.ersterfasstAm))
}

export function berichtErstellen(d: BerichtDaten): { betreff: string; text: string } {
  const { runde, zahlen, jetzt } = d
  const lange = langeStehende(d.offene, jetzt)
  const typ = RUNDEN_TYP_TEXT[runde.typ]

  const betreff = `Parkplatz: ${typ} ${formatDatum(runde.gestartetAm)} – ${lange.length} ${
    lange.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'
  } seit gestern oder länger`

  const zeilen: string[] = []
  const ende = runde.beendetAm ? `–${formatZeit(runde.beendetAm)}` : ''
  zeilen.push(`${typ} am ${formatDatum(runde.gestartetAm)}, ${formatZeit(runde.gestartetAm)}${ende} (${runde.durchgefuehrtVon})`)
  zeilen.push(`Neu: ${zahlen.neu} · Noch da: ${zahlen.noch_da} · Weg: ${zahlen.weg}`)
  zeilen.push('')

  if (lange.length === 0) {
    zeilen.push(`Keine Fahrzeuge, die seit gestern oder länger stehen (Stand ${formatDatumZeit(jetzt)}).`)
  } else {
    zeilen.push(`Seit gestern oder länger: ${lange.length} (Stand ${formatDatumZeit(jetzt)})`)
    // Nach Ebenen in der Reihenfolge der Einstellungen, unbekannte Ebenen am Ende
    const ids = d.ebenen.map((e) => e.id)
    for (const v of lange) if (!ids.includes(v.ebeneId)) ids.push(v.ebeneId)
    for (const id of ids) {
      const hier = lange.filter((v) => v.ebeneId === id)
      if (hier.length === 0) continue
      zeilen.push('')
      zeilen.push((d.ebenen.find((e) => e.id === id)?.name ?? 'Unbekannte Ebene').toUpperCase())
      for (const v of hier) {
        const teile = [
          v.kennzeichenAnzeige,
          v.modell,
          standdauerText(v.ersterfasstAm, jetzt),
          v.kategorie !== 'unbekannt' ? KATEGORIE_TEXT[v.kategorie] : '',
          `${d.gesehen.get(v.id) ?? 0}× gesehen`,
          v.notiz ? `Notiz: ${v.notiz}` : '',
        ]
        zeilen.push(`• ${teile.filter(Boolean).join(' · ')}`)
      }
    }
  }

  zeilen.push('')
  zeilen.push('– gesendet aus der Parkplatz-Kontrolle')
  return { betreff, text: zeilen.join('\n') }
}

/** mailto-Link: öffnet die Mail-App mit Empfänger, Betreff und Text. */
export function mailtoLink(empfaenger: string, betreff: string, text: string): string {
  // E-Mail-Zeilenumbrüche sind CRLF
  const body = encodeURIComponent(text.replace(/\n/g, '\r\n'))
  // Mehrere Empfänger mit Komma; jede Adresse einzeln kodieren, „@“ und Komma bleiben lesbar
  const an = empfaenger
    .split(/[,;]/)
    .map((a) => encodeURIComponent(a.trim()).replace(/%40/g, '@'))
    .filter(Boolean)
    .join(',')
  return `mailto:${an}?subject=${encodeURIComponent(betreff)}&body=${body}`
}
