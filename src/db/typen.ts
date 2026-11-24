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
  /** Stellplatznummer innerhalb der Ebene (5 = „0.05“), nur auf nummerierten Ebenen. Fehlt bei älteren Daten. */
  stellplatz?: number | null
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

// Ein Vorgang kann mehrere Klärungen haben; es gilt immer die neueste.
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
  | 'intern_angesprochen'
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

/** Nummerierte Stellplätze einer Ebene, z. B. Präfix „0.“, 1–20 → „0.01“–„0.20“ */
export interface StellplatzBereich {
  praefix: string
  von: number
  bis: number
}

/**
 * Schwellen der Ampel (siehe CLAUDE.md, Abschnitt „Ampel und Eskalation“).
 * Tage sind Kalendertage ab der Ersterfassung, 0 = am selben Tag.
 */
export interface Schwellen {
  /** ohne Klärung: rot, wenn das Fahrzeug so viele Kalendertage nach der Erfassung noch gesehen wird */
  ohneKlaerungRotAbTag: number
  /** fertig_*: gelb nach so vielen Stunden seit der Klärung */
  abholfristGelbStunden: number
  /** fertig_*: rot nach so vielen Stunden seit der Klärung */
  abholfristRotStunden: number
  /** andere Klärungsgründe: rot ab diesem Kalendertag nach der Erfassung (3 = Mo → Do) */
  klaerungRotAbTag: number
  /** Fremdparker/Mitarbeiter: gelb ab so vielen Tagen, an denen das Kennzeichen gesehen wurde */
  antreffenGelb: number
  /** Fremdparker/Mitarbeiter: rot ab so vielen Tagen */
  antreffenRot: number
}

export interface Ebene {
  id: string
  name: string
  aktiv: boolean
  /** null/fehlt = Ebene ohne nummerierte Stellplätze (z. B. Außenflächen) */
  stellplaetze?: StellplatzBereich | null
}

export interface Einstellungen extends Zeitstempel {
  id: 'app'
  ebenen: Ebene[] // Reihenfolge der Liste = Anzeigereihenfolge
  aufbewahrung: { fotosTage: number; vorgaengeTage: number }
  letzterKontrolleur: string
  letzteSicherungAm: string | null
  /** E-Mail-Adresse für den Bericht nach einer Kontrolle. Optional, weil ältere Datenbanken das Feld noch nicht haben. */
  berichtEmpfaenger?: string
  /** Platznummer beim Erfassen automatisch um eins hochzählen (Standard: an) */
  platzHochzaehlen?: boolean
  /** Ampel-Schwellen. Fehlt bei älteren Daten – dann gelten die Standardwerte (schwellenVon). */
  schwellen?: Partial<Schwellen>
  /** Letzte automatische Bereinigung, bei der etwas gelöscht wurde (Anzeige in den Einstellungen) */
  letzteBereinigung?: { am: string; vorgaenge: number; fotos: number; runden: number }
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

export const KLAERUNG_TEXT: Record<KlaerungsGrund, string> = {
  nicht_bearbeitet: 'Noch nicht bearbeitet',
  wartet_auf_teile: 'Wartet auf Teile',
  in_bearbeitung_extern: 'In Bearbeitung extern',
  fertig_kunde_informiert: 'Fertig, Kunde informiert',
  fertig_kunde_nicht_erreicht: 'Fertig, Kunde nicht erreicht',
  kein_kunde: 'Kein Kunde',
  sonstiges: 'Sonstiges',
}

export const MASSNAHME_TEXT: Record<MassnahmeTyp, string> = {
  hinweiszettel: 'Hinweiszettel',
  sb_angesprochen: 'SB angesprochen',
  kunde_kontaktiert: 'Kunde kontaktiert',
  eskalation_leitung: 'Eskalation an Leitung',
  intern_angesprochen: 'Intern angesprochen',
  sonstiges: 'Sonstiges',
}
