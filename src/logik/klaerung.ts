// Regeln zum Eintragen einer Klärung. Reine Funktionen, damit sie sich testen lassen.
import type { Kategorie, KlaerungsGrund } from '../db/typen'

/** Reihenfolge der Knöpfe im Formular: häufige Gründe zuerst. */
export const KLAERUNGS_GRUENDE: KlaerungsGrund[] = [
  'nicht_bearbeitet',
  'wartet_auf_teile',
  'in_bearbeitung_extern',
  'fertig_kunde_informiert',
  'fertig_kunde_nicht_erreicht',
  'kein_kunde',
  'sonstiges',
]

export interface KlaerungEingabe {
  grund: KlaerungsGrund | null
  serviceberater: string
  notiz: string
}

/**
 * Fehlermeldung oder null, wenn alles vollständig ist.
 * Der SB ist Pflicht (Grundlage für die Auswertung je SB in Stufe 3) – außer bei
 * „kein Kunde“, denn dann ist kein SB zuständig. „Sonstiges“ braucht eine Notiz.
 */
export function klaerungPruefen(e: KlaerungEingabe): string | null {
  if (!e.grund) return 'Bitte einen Grund wählen.'
  if (e.grund !== 'kein_kunde' && !e.serviceberater.trim()) return 'Bitte den Serviceberater eintragen.'
  if (e.grund === 'sonstiges' && !e.notiz.trim()) return 'Bei „Sonstiges“ bitte eine Notiz eintragen.'
  return null
}

/**
 * Kategorie des Fahrzeugs nach der Klärung.
 * - „kein Kunde“: die gewählte Kategorie (optional); ohne Auswahl wird aus „Kunde“ „Unbekannt“.
 * - jeder andere Grund heißt: Es ist ein Kundenauftrag. „Unbekannt“ und „Fremdparker“ werden
 *   zu „Kunde“. „Mitarbeiter“ bleibt, denn auch Mitarbeiterfahrzeuge kommen in die Werkstatt.
 */
export function kategorieNachKlaerung(
  grund: KlaerungsGrund,
  bisher: Kategorie,
  gewaehlt: Kategorie | null = null,
): Kategorie {
  if (grund === 'kein_kunde') {
    if (gewaehlt === 'fremdparker' || gewaehlt === 'mitarbeiter') return gewaehlt
    return bisher === 'kunde' ? 'unbekannt' : bisher
  }
  return bisher === 'unbekannt' || bisher === 'fremdparker' ? 'kunde' : bisher
}
