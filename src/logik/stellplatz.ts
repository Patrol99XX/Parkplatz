// Stellplatznummern im Parkhaus, z. B. Ebene 0: „0.01“–„0.20“, Ebene −1: „-1.01“–„-1.44“.
// Gespeichert wird nur die Nummer (5), angezeigt wird sie mit dem Präfix der Ebene („0.05“).
// So tippt man beim Erfassen nur „5“ auf dem Ziffernblock.
import type { StellplatzBereich, Vorgang } from '../db/typen'

/**
 * 5 → „0.05“ (zweistellig, bei mehr als 99 Plätzen entsprechend länger).
 * Ohne Präfix (z. B. Außenfläche 1–14) steht die Nummer so da, wie sie auf dem Boden steht: „5“.
 */
export function platzText(bereich: StellplatzBereich, nr: number): string {
  if (!bereich.praefix) return String(nr)
  const stellen = Math.max(2, String(bereich.bis).length)
  return `${bereich.praefix}${String(nr).padStart(stellen, '0')}`
}

export type PlatzEingabe = { nr: number | null } | { fehler: string }

/**
 * Liest eine Platz-Eingabe: „5“, „05“, „0.05“, „-1.05“ und „-1,05“ ergeben jeweils 5.
 * Leer = kein Platz angegeben (erlaubt).
 */
export function platzEinlesen(eingabe: string, bereich: StellplatzBereich): PlatzEingabe {
  const text = eingabe.trim()
  if (!text) return { nr: null }
  const letzterTeil = text.split(/[.,]/).pop() ?? ''
  if (!/^\d+$/.test(letzterTeil)) return { fehler: `„${text}“ ist keine Platznummer.` }
  const nr = Number(letzterTeil)
  if (nr < bereich.von || nr > bereich.bis) {
    return {
      fehler: `Platz ${platzText(bereich, nr)} gibt es auf dieser Ebene nicht (${platzText(bereich, bereich.von)}–${platzText(bereich, bereich.bis)}).`,
    }
  }
  return { nr }
}

/** Nächster Platz zum Vorschlagen beim Erfassen (man geht meist von Platz zu Platz). */
export function naechsterPlatz(nr: number, bereich: StellplatzBereich): number | null {
  return nr + 1 <= bereich.bis ? nr + 1 : null
}

/** Sortierung innerhalb einer Ebene: nach Platz, Fahrzeuge ohne Platz danach in Erfassungsreihenfolge. */
export function nachPlatz(a: Vorgang, b: Vorgang): number {
  const pa = a.stellplatz ?? Infinity
  const pb = b.stellplatz ?? Infinity
  if (pa !== pb) return pa - pb
  return a.ersterfasstAm.localeCompare(b.ersterfasstAm)
}
