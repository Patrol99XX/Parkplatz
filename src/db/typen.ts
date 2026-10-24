// Datenmodell laut CLAUDE.md. Alle IDs sind UUIDs, alle Zeitpunkte ISO-Strings.
// Jeder Datensatz trägt erstelltAm/geaendertAm, damit später ein Abgleich
// mit einer zentralen Datenbank möglich ist.

export interface Zeitstempel {
  erstelltAm: string
  geaendertAm: string
}

export type RundenTyp = 'morgens' | 'nachmittags' | 'sonder'

export interface Runde extends Zeitstempel {
  id: string
  typ: RundenTyp
  gestartetAm: string
  beendetAm: string | null
  durchgefuehrtVon: string
}

export type Kategorie = 'kunde' | 'mitarbeiter' | 'fremdparker' | 'unbekannt'

export interface Vorgang extends Zeitstempel {
  id: string
  kennzeichen: string
  kennzeichenAnzeige: string
  modell: string
  ebeneId: string
  kategorie: Kategorie
  fotoIds: string[]
  ersterfasstAm: string
  ersterfasstInRundeId: string
  beendetAm: string | null
  beendetInRundeId: string | null
  offen: boolean
  notiz: string
}

export type SichtungsErgebnis = 'neu' | 'noch_da' | 'weg'

export interface Sichtung extends Zeitstempel {
  id: string
  vorgangId: string
  rundeId: string
  zeitpunkt: string
  ergebnis: SichtungsErgebnis
}

export type KlaerungsGrund =
  | 'nicht_bearbeitet'
  | 'wartet_auf_teile'
  | 'in_bearbeitung_extern'
  | 'fertig_kunde_informiert'
  | 'fertig_kunde_nicht_erreicht'
  | 'kein_kunde'
  | 'sonstiges'

// Klärungen und Maßnahmen werden erst in Stufe 2 benutzt. Die Tabellen gibt es
// trotzdem schon, damit die Datenbank später nicht umgebaut werden muss.
export interface Klaerung extends Zeitstempel {
  id: string
  vorgangId: string
  grund: KlaerungsGrund
  serviceberater: string
  eingetragenAm: string
  notiz: string
}

export type MassnahmeTyp =
  | 'hinweiszettel'
  | 'sb_angesprochen'
  | 'kunde_kontaktiert'
  | 'eskalation_leitung'
  | 'sonstiges'

export interface Massnahme extends Zeitstempel {
  id: string
  vorgangId: string
  typ: MassnahmeTyp
  zeitpunkt: string
  notiz: string
}

export interface Foto extends Zeitstempel {
  id: string
  vorgangId: string
  blob: Blob
  aufgenommenAm: string
}

export interface Ebene {
  id: string
  name: string
  aktiv: boolean
}

export interface Einstellungen extends Zeitstempel {
  id: 'app'
  ebenen: Ebene[] // Reihenfolge der Liste = Anzeigereihenfolge
  aufbewahrung: { fotosTage: number; vorgaengeTage: number }
  letzterKontrolleur: string
  letzteSicherungAm: string | null
  /** E-Mail-Adresse für den Bericht nach einer Kontrolle. Optional, weil ältere Datenbanken das Feld noch nicht haben. */
  berichtEmpfaenger?: string
}

export const RUNDEN_TYP_TEXT: Record<RundenTyp, string> = {
  morgens: 'Morgenkontrolle',
  nachmittags: 'Nachmittagskontrolle',
  sonder: 'Sonderkontrolle',
}

export const KATEGORIE_TEXT: Record<Kategorie, string> = {
  kunde: 'Kunde',
  mitarbeiter: 'Mitarbeiter',
  fremdparker: 'Fremdparker',
  unbekannt: 'Unbekannt',
}

export const ERGEBNIS_TEXT: Record<SichtungsErgebnis, string> = {
  neu: 'neu erfasst',
  noch_da: 'noch da',
  weg: 'weg',
}
