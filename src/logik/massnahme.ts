// Regeln zum Eintragen einer Maßnahme. Reine Funktionen, damit sie sich testen lassen.
import type { MassnahmeTyp } from '../db/typen'

/**
 * Maßnahmen, die im Formular angeboten werden. „Hinweiszettel“ fehlt bewusst:
 * Es werden keine Zettel verteilt (Entscheidung 24.11.2026), der Typ bleibt nur im Datenmodell.
 */
export const MASSNAHMEN_ANGEBOT: MassnahmeTyp[] = [
  'sb_angesprochen',
  'kunde_kontaktiert',
  'intern_angesprochen',
  'eskalation_leitung',
  'sonstiges',
]

/** Fehlermeldung oder null. „Sonstiges“ braucht eine Notiz, sonst weiß später niemand, was war. */
export function massnahmePruefen(typ: MassnahmeTyp | null, notiz: string): string | null {
  if (!typ) return 'Bitte eine Maßnahme wählen.'
  if (typ === 'sonstiges' && !notiz.trim()) return 'Bei „Sonstiges“ bitte eine Notiz eintragen.'
  return null
}
