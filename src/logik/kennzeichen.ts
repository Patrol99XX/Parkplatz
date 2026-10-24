import type { Vorgang } from '../db/typen'
import { istGleicherTag } from './zeit'

/** „hh-ab 123“ → „HHAB123“. Die Anzeige behält die Schreibweise der Eingabe. */
export function normalisiereKennzeichen(eingabe: string): string {
  return eingabe.toUpperCase().replace(/[\s-]/g, '')
}

export const WIEDERHOLER_TAGE = 30

export interface KennzeichenBefund {
  /** Es gibt schon einen offenen Vorgang → keinen neuen anlegen. */
  offenerVorgang: Vorgang | null
  /** Am selben Tag wurde ein Vorgang beendet → vermutlich zurück aus der Werkstatt. */
  vermutlichZurueck: boolean
  /** Frühere Vorgänge in den letzten 30 Tagen, neueste zuerst. */
  fruehere: Vorgang[]
}

/**
 * Wertet die bisherigen Vorgänge eines Kennzeichens aus.
 * Reine Funktion ohne Datenbankzugriff, damit sie sich einfach testen lässt.
 *
 * @param vorgaenge alle Vorgänge mit diesem (normalisierten) Kennzeichen
 * @param bezug Zeitpunkt der (geplanten) Erfassung
 * @param eigeneId wird ausgelassen – für die Anzeige an einem bestehenden Vorgang
 */
export function pruefeKennzeichen(
  vorgaenge: Vorgang[],
  bezug: Date,
  eigeneId?: string,
): KennzeichenBefund {
  const andere = vorgaenge.filter((v) => v.id !== eigeneId)
  const grenze = bezug.getTime() - WIEDERHOLER_TAGE * 24 * 60 * 60 * 1000

  const offenerVorgang = andere.find((v) => v.offen) ?? null

  const vermutlichZurueck = andere.some(
    (v) =>
      v.beendetAm !== null &&
      new Date(v.beendetAm) <= bezug &&
      istGleicherTag(new Date(v.beendetAm), bezug),
  )

  const fruehere = andere
    .filter((v) => {
      const t = new Date(v.ersterfasstAm).getTime()
      return !v.offen && t >= grenze && t <= bezug.getTime()
    })
    .sort((a, b) => b.ersterfasstAm.localeCompare(a.ersterfasstAm))

  return { offenerVorgang, vermutlichZurueck, fruehere }
}
