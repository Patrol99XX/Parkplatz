// Sammelt aus der Datenbank alles, was die Ampel braucht, und berechnet sie für viele
// Fahrzeuge auf einmal. Statt einer Abfrage pro Fahrzeug gibt es nur wenige Abfragen
// für alle zusammen („anyOf“) – bei ca. 150 Fahrzeugen merkt man den Unterschied.
import { db } from './db'
import type { Klaerung, Massnahme, Sichtung, Vorgang } from './typen'
import { berechneAmpel, nachDringlichkeit, schwellenVon, type Ampel } from '../logik/ampel'
import { istOhneKennzeichen, WIEDERHOLER_TAGE } from '../logik/kennzeichen'

const TAG = 24 * 60 * 60 * 1000

/** Neueste Klärung je Vorgang (es gilt immer die neueste). */
export function neuesteKlaerungen(klaerungen: Klaerung[]): Map<string, Klaerung> {
  const neueste = new Map<string, Klaerung>()
  for (const k of klaerungen) {
    const bisher = neueste.get(k.vorgangId)
    if (!bisher || k.eingetragenAm > bisher.eingetragenAm) neueste.set(k.vorgangId, k)
  }
  return neueste
}

function nachVorgang(sichtungen: Sichtung[]): Map<string, Sichtung[]> {
  const m = new Map<string, Sichtung[]>()
  for (const s of sichtungen) m.set(s.vorgangId, [...(m.get(s.vorgangId) ?? []), s])
  return m
}

export interface AmpelErgebnis {
  ampeln: Map<string, Ampel>
  klaerungen: Map<string, Klaerung>
  /** neueste Maßnahme je Vorgang */
  massnahmen: Map<string, Massnahme>
}

/** Ampel für die übergebenen (offenen) Vorgänge. Zum Aufruf innerhalb von useLiveQuery. */
export async function ampelnLaden(vorgaenge: Vorgang[]): Promise<AmpelErgebnis> {
  const schwellen = schwellenVon(await db.einstellungen.get('app'))
  const ids = vorgaenge.map((v) => v.id)
  const sichtungen = nachVorgang(await db.sichtungen.where('vorgangId').anyOf(ids).toArray())
  const klaerungen = neuesteKlaerungen(await db.klaerungen.where('vorgangId').anyOf(ids).toArray())
  const alleMassnahmen = new Map<string, Massnahme[]>()
  for (const m of await db.massnahmen.where('vorgangId').anyOf(ids).toArray()) {
    alleMassnahmen.set(m.vorgangId, [...(alleMassnahmen.get(m.vorgangId) ?? []), m])
  }

  // Frühere Aufenthalte zählen nur bei Fremdparkern/Mitarbeitern („Antreffen“).
  const zaehltAntreffen = (v: Vorgang) => {
    const k = klaerungen.get(v.id)
    return k ? k.grund === 'kein_kunde' : v.kategorie === 'fremdparker' || v.kategorie === 'mitarbeiter'
  }
  const mitAntreffen = vorgaenge.filter((v) => zaehltAntreffen(v) && !istOhneKennzeichen(v.kennzeichen))
  const fruehere = mitAntreffen.length
    ? await db.vorgaenge.where('kennzeichen').anyOf(mitAntreffen.map((v) => v.kennzeichen)).toArray()
    : []
  const fruehereSichtungen = nachVorgang(
    fruehere.length ? await db.sichtungen.where('vorgangId').anyOf(fruehere.map((v) => v.id)).toArray() : [],
  )

  const ampeln = new Map<string, Ampel>()
  for (const v of vorgaenge) {
    let frueher: Sichtung[] = []
    if (zaehltAntreffen(v) && !istOhneKennzeichen(v.kennzeichen)) {
      const grenze = new Date(new Date(v.ersterfasstAm).getTime() - WIEDERHOLER_TAGE * TAG).toISOString()
      frueher = fruehere
        .filter((f) => f.id !== v.id && f.kennzeichen === v.kennzeichen && f.ersterfasstAm >= grenze && f.ersterfasstAm < v.ersterfasstAm)
        .flatMap((f) => fruehereSichtungen.get(f.id) ?? [])
    }
    ampeln.set(
      v.id,
      berechneAmpel({
        ersterfasstAm: v.ersterfasstAm,
        kategorie: v.kategorie,
        sichtungen: sichtungen.get(v.id) ?? [],
        fruehereSichtungen: frueher,
        klaerung: klaerungen.get(v.id) ?? null,
        massnahmen: alleMassnahmen.get(v.id) ?? [],
        schwellen,
      }),
    )
  }
  const massnahmen = new Map<string, Massnahme>()
  for (const [id, liste] of alleMassnahmen) {
    massnahmen.set(id, liste.reduce((a, b) => (b.zeitpunkt > a.zeitpunkt ? b : a)))
  }
  return { ampeln, klaerungen, massnahmen }
}

export interface KlaerungsEintrag {
  vorgang: Vorgang
  ampel: Ampel
  klaerung: Klaerung | null
  massnahme: Massnahme | null
}

/**
 * Klärungsliste: alle offenen Fahrzeuge, die laut Ampel geklärt werden müssen,
 * rot zuerst, dann nach Standdauer. Wird immer aus dem aktuellen Stand berechnet.
 */
export async function klaerungslisteLaden(): Promise<KlaerungsEintrag[]> {
  const offene = await db.vorgaenge.filter((v) => v.offen).toArray()
  const { ampeln, klaerungen, massnahmen } = await ampelnLaden(offene)
  const aufListe = offene.filter((v) => ampeln.get(v.id)?.aufKlaerungsliste)
  return aufListe
    .map((v) => ({
      vorgang: v,
      ampel: ampeln.get(v.id)!,
      klaerung: klaerungen.get(v.id) ?? null,
      massnahme: massnahmen.get(v.id) ?? null,
      ersterfasstAm: v.ersterfasstAm,
    }))
    .sort(nachDringlichkeit)
}
