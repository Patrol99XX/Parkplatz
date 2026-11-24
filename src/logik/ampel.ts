// Ampel und Eskalation (CLAUDE.md, Abschnitt „Ampel und Eskalation“).
//
// Die Farbe wird nie gespeichert, sondern immer aus den Daten berechnet:
// Sichtungen, neueste Klärung und Kategorie. Vorteile: Es kann keinen Widerspruch
// zwischen gespeicherter Farbe und Daten geben, und geänderte Schwellen wirken sofort.
//
// Bezugszeitpunkt ist die letzte Sichtung, nicht die aktuelle Uhrzeit. Die Ampel
// ändert sich also nur durch eine Kontrolle oder eine Klärung – so genau, wie die
// Rundgänge eben sind. Reine Funktion ohne Datenbankzugriff, damit sie sich testen lässt.
import {
  KLAERUNG_TEXT,
  type Einstellungen,
  type Kategorie,
  type Klaerung,
  type MassnahmeTyp,
  type Schwellen,
  type Sichtung,
} from '../db/typen'
import { kalendertageZwischen } from './zeit'

export type AmpelFarbe = 'gruen' | 'gelb' | 'rot'

export interface Ampel {
  farbe: AmpelFarbe
  /** kurze Begründung für die Anzeige, z. B. „am Folgetag noch da“ */
  grund: string
  /** gehört auf die Klärungsliste nach der Runde */
  aufKlaerungsliste: boolean
  /** Maßnahme, die die App vorschlägt (oder null) */
  vorschlag: MassnahmeTyp | null
}

export const STANDARD_SCHWELLEN: Schwellen = {
  ohneKlaerungRotAbTag: 1,
  abholfristGelbStunden: 24,
  abholfristRotStunden: 48,
  klaerungRotAbTag: 3,
  antreffenGelb: 2,
  antreffenRot: 3,
}

/** Eingestellte Schwellen, fehlende Werte mit dem Standard aufgefüllt. */
export function schwellenVon(e: Pick<Einstellungen, 'schwellen'> | undefined): Schwellen {
  return { ...STANDARD_SCHWELLEN, ...e?.schwellen }
}

type SichtungKurz = Pick<Sichtung, 'zeitpunkt' | 'ergebnis'>

export interface AmpelEingabe {
  ersterfasstAm: string
  kategorie: Kategorie
  /** alle Sichtungen dieses Vorgangs */
  sichtungen: SichtungKurz[]
  /**
   * Sichtungen früherer Vorgänge mit demselben Kennzeichen (letzte 30 Tage).
   * Zählen nur bei Fremdparkern und Mitarbeitern mit („Antreffen“).
   */
  fruehereSichtungen?: SichtungKurz[]
  /** neueste Klärung oder null */
  klaerung: Pick<Klaerung, 'grund' | 'eingetragenAm'> | null
  schwellen: Schwellen
}

const STUNDE = 60 * 60 * 1000

/** Sichtungen, bei denen das Fahrzeug da war („neu“ oder „noch da“). */
function anwesend(sichtungen: SichtungKurz[]): SichtungKurz[] {
  return sichtungen.filter((s) => s.ergebnis !== 'weg')
}

function tagSchluessel(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function berechneAmpel(e: AmpelEingabe): Ampel {
  const da = anwesend(e.sichtungen)
  // Letzte Sichtung; ohne Sichtung (z. B. alte Daten) zählt die Ersterfassung.
  const letzte = new Date(
    da.reduce((max, s) => (s.zeitpunkt > max ? s.zeitpunkt : max), e.ersterfasstAm),
  )
  const s = e.schwellen
  const k = e.klaerung

  // Die neueste Information gewinnt: Gibt es eine Klärung, entscheidet sie.
  // Sonst entscheidet die Kategorie, die beim Erfassen gesetzt wurde.
  if (k?.grund === 'kein_kunde' || (!k && (e.kategorie === 'fremdparker' || e.kategorie === 'mitarbeiter'))) {
    return antreffenAmpel(e, da, s)
  }

  if (!k) {
    if (kalendertageZwischen(new Date(e.ersterfasstAm), letzte) >= s.ohneKlaerungRotAbTag) {
      return { farbe: 'rot', grund: 'am Folgetag noch da – Klärung beim SB erfragen', aufKlaerungsliste: true, vorschlag: null }
    }
    if (da.length >= 2) {
      return { farbe: 'gelb', grund: 'bei der nächsten Kontrolle noch da', aufKlaerungsliste: false, vorschlag: null }
    }
    return { farbe: 'gruen', grund: 'neu erfasst', aufKlaerungsliste: false, vorschlag: null }
  }

  const grundText = KLAERUNG_TEXT[k.grund]

  if (k.grund === 'fertig_kunde_informiert' || k.grund === 'fertig_kunde_nicht_erreicht') {
    // Abholfrist läuft ab der Klärung. Klärung nach der letzten Sichtung → noch 0 Stunden.
    const stunden = Math.max(0, (letzte.getTime() - new Date(k.eingetragenAm).getTime()) / STUNDE)
    if (stunden > s.abholfristRotStunden) {
      return {
        farbe: 'rot',
        grund: `${grundText}, Abholfrist über ${s.abholfristRotStunden} h`,
        aufKlaerungsliste: true,
        vorschlag: 'eskalation_leitung',
      }
    }
    if (stunden > s.abholfristGelbStunden) {
      return {
        farbe: 'gelb',
        grund: `${grundText}, Abholfrist über ${s.abholfristGelbStunden} h`,
        aufKlaerungsliste: true,
        vorschlag: 'kunde_kontaktiert',
      }
    }
    return { farbe: 'gruen', grund: `${grundText}, Abholfrist läuft`, aufKlaerungsliste: false, vorschlag: null }
  }

  // nicht_bearbeitet, wartet_auf_teile, in_bearbeitung_extern, sonstiges
  const tage = kalendertageZwischen(new Date(e.ersterfasstAm), letzte)
  if (tage >= s.klaerungRotAbTag) {
    return { farbe: 'rot', grund: `${grundText}, seit ${tage} Tagen`, aufKlaerungsliste: true, vorschlag: null }
  }
  // Erscheint jeden Tag erneut auf der Klärungsliste, sobald die Klärung von einem früheren Tag ist.
  const klaerungVonFrueher = kalendertageZwischen(new Date(k.eingetragenAm), letzte) >= 1
  return { farbe: 'gelb', grund: grundText, aufKlaerungsliste: klaerungVonFrueher, vorschlag: null }
}

/** Fremdparker und Mitarbeiter: gezählt werden Kalendertage, an denen das Kennzeichen gesehen wurde. */
function antreffenAmpel(e: AmpelEingabe, da: SichtungKurz[], s: Schwellen): Ampel {
  const tage = new Set([...da, ...anwesend(e.fruehereSichtungen ?? [])].map((x) => tagSchluessel(x.zeitpunkt)))
  // Ohne jede Sichtung (alte Daten) zählt die Ersterfassung als erstes Antreffen.
  const antreffen = Math.max(1, tage.size)
  const mitarbeiter = e.kategorie === 'mitarbeiter'
  const wer = mitarbeiter ? 'Mitarbeiter' : 'Fremdparker'
  const text = `${wer}, ${antreffen}. Antreffen`

  if (antreffen >= s.antreffenRot) {
    return { farbe: 'rot', grund: text, aufKlaerungsliste: true, vorschlag: 'eskalation_leitung' }
  }
  if (antreffen >= s.antreffenGelb) {
    // Fremdparker: keine Maßnahme (es gibt keine Hinweiszettel). Mitarbeiter: intern ansprechen.
    return mitarbeiter
      ? { farbe: 'gelb', grund: text, aufKlaerungsliste: true, vorschlag: 'intern_angesprochen' }
      : { farbe: 'gelb', grund: text, aufKlaerungsliste: false, vorschlag: null }
  }
  return { farbe: 'gruen', grund: text, aufKlaerungsliste: false, vorschlag: null }
}

const RANG: Record<AmpelFarbe, number> = { rot: 0, gelb: 1, gruen: 2 }

/** Sortierung der Klärungsliste: rot zuerst, dann gelb, dann grün; innerhalb längste Standdauer zuerst. */
export function nachDringlichkeit(
  a: { ampel: Ampel; ersterfasstAm: string },
  b: { ampel: Ampel; ersterfasstAm: string },
): number {
  return RANG[a.ampel.farbe] - RANG[b.ampel.farbe] || a.ersterfasstAm.localeCompare(b.ersterfasstAm)
}
