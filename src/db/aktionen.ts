// Alle schreibenden Datenbankzugriffe an einer Stelle. Zusammengehörige Änderungen
// laufen in einer Transaktion: Entweder wird alles gespeichert oder nichts.
import { db } from './db'
import type { Einstellungen, Kategorie, MassnahmeTyp, Runde, Schwellen, StellplatzBereich, RundenTyp, SichtungsErgebnis, Vorgang } from './typen'
import { jetztIso, neueId } from '../logik/uuid'
import { istOhneKennzeichen, normalisiereKennzeichen } from '../logik/kennzeichen'
import { kategorieNachKlaerung, klaerungPruefen, type KlaerungEingabe } from '../logik/klaerung'
import { massnahmePruefen } from '../logik/massnahme'
import { bereinigungPlanen } from '../logik/bereinigung'

// ---------- Einstellungen ----------

export async function einstellungenAendern(aenderung: (e: Einstellungen) => void) {
  await db.transaction('rw', db.einstellungen, async () => {
    const e = await db.einstellungen.get('app')
    if (!e) return
    aenderung(e)
    e.geaendertAm = jetztIso()
    await db.einstellungen.put(e)
  })
}

export async function ebeneHinzufuegen(name: string) {
  await einstellungenAendern((e) => {
    e.ebenen.push({ id: neueId(), name: name.trim(), aktiv: true })
  })
}

export async function ebeneUmbenennen(id: string, name: string) {
  await einstellungenAendern((e) => {
    const ebene = e.ebenen.find((x) => x.id === id)
    if (ebene) ebene.name = name.trim()
  })
}

export async function ebeneVerschieben(id: string, richtung: -1 | 1) {
  await einstellungenAendern((e) => {
    const i = e.ebenen.findIndex((x) => x.id === id)
    const j = i + richtung
    if (i < 0 || j < 0 || j >= e.ebenen.length) return
    ;[e.ebenen[i], e.ebenen[j]] = [e.ebenen[j], e.ebenen[i]]
  })
}

export async function ebeneAktivSetzen(id: string, aktiv: boolean) {
  await einstellungenAendern((e) => {
    const ebene = e.ebenen.find((x) => x.id === id)
    if (ebene) ebene.aktiv = aktiv
  })
}

/** Löschen nur, wenn die Ebene nie benutzt wurde – sonst fehlt in der Historie der Name. */
export async function ebeneLoeschen(id: string): Promise<boolean> {
  const benutzt = await db.vorgaenge.filter((v) => v.ebeneId === id).count()
  if (benutzt > 0) return false
  await einstellungenAendern((e) => {
    e.ebenen = e.ebenen.filter((x) => x.id !== id)
  })
  return true
}

export async function ebeneStellplaetzeSetzen(id: string, bereich: StellplatzBereich | null) {
  await einstellungenAendern((e) => {
    const ebene = e.ebenen.find((x) => x.id === id)
    if (ebene) ebene.stellplaetze = bereich
  })
}

export async function platzHochzaehlenSetzen(an: boolean) {
  await einstellungenAendern((e) => {
    e.platzHochzaehlen = an
  })
}

export async function berichtEmpfaengerSetzen(adresse: string) {
  await einstellungenAendern((e) => {
    e.berichtEmpfaenger = adresse.trim()
  })
}

/** Eine Ampel-Schwelle ändern. Nur geänderte Werte werden gespeichert, der Rest bleibt Standard. */
export async function schwelleSetzen(name: keyof Schwellen, wert: number) {
  await einstellungenAendern((e) => {
    e.schwellen = { ...e.schwellen, [name]: wert }
  })
}

/** Alle Ampel-Schwellen auf die Standardwerte zurücksetzen. */
export async function schwellenZuruecksetzen() {
  await einstellungenAendern((e) => {
    delete e.schwellen
  })
}

export async function aufbewahrungSetzen(fotosTage: number, vorgaengeTage: number) {
  await einstellungenAendern((e) => {
    e.aufbewahrung = { fotosTage, vorgaengeTage }
  })
}

// ---------- Aufbewahrung ----------

/**
 * Löscht abgelaufene Daten (Fristen aus den Einstellungen) und merkt sich das Ergebnis.
 * Läuft bei jedem App-Start; ist nichts abgelaufen, passiert nichts.
 * Alles in einer Transaktion: Bricht etwas ab, bleibt der alte Stand vollständig erhalten.
 */
export async function bereinigen(jetzt = new Date()) {
  const tabellen = [db.einstellungen, db.vorgaenge, db.sichtungen, db.runden, db.fotos, db.klaerungen, db.massnahmen]
  return db.transaction('rw', tabellen, async () => {
    const e = await db.einstellungen.get('app')
    if (!e) return null
    const vorgaenge = await db.vorgaenge.toArray()
    const runden = await db.runden.toArray()
    const rundenMitSichtungen = new Map<string, string[]>()
    await db.sichtungen.each((s) => {
      rundenMitSichtungen.set(s.rundeId, [...(rundenMitSichtungen.get(s.rundeId) ?? []), s.vorgangId])
    })
    const plan = bereinigungPlanen(vorgaenge, runden, rundenMitSichtungen, e.aufbewahrung, jetzt)

    if (plan.vorgangIds.length) {
      await db.sichtungen.where('vorgangId').anyOf(plan.vorgangIds).delete()
      await db.fotos.where('vorgangId').anyOf(plan.vorgangIds).delete()
      await db.klaerungen.where('vorgangId').anyOf(plan.vorgangIds).delete()
      await db.massnahmen.where('vorgangId').anyOf(plan.vorgangIds).delete()
      await db.vorgaenge.bulkDelete(plan.vorgangIds)
    }
    let fotos = 0
    if (plan.fotoVorgangIds.length) {
      fotos = await db.fotos.where('vorgangId').anyOf(plan.fotoVorgangIds).delete()
      const zeit = jetzt.toISOString()
      await db.vorgaenge
        .where('id')
        .anyOf(plan.fotoVorgangIds)
        .modify({ fotoIds: [], geaendertAm: zeit })
    }
    if (plan.rundenIds.length) await db.runden.bulkDelete(plan.rundenIds)

    const ergebnis = {
      am: jetzt.toISOString(),
      vorgaenge: plan.vorgangIds.length,
      fotos,
      runden: plan.rundenIds.length,
    }
    // Nur merken, wenn wirklich etwas gelöscht wurde – sonst stünde nach jedem Start „0“ da
    if (ergebnis.vorgaenge + ergebnis.fotos + ergebnis.runden > 0) {
      await db.einstellungen.update('app', { letzteBereinigung: ergebnis })
    }
    return ergebnis
  })
}

// ---------- Runden ----------

export async function aktiveRunde(): Promise<Runde | undefined> {
  return db.runden.filter((r) => r.beendetAm === null).first()
}

export async function rundeStarten(typ: RundenTyp, durchgefuehrtVon: string): Promise<Runde> {
  const jetzt = jetztIso()
  const runde: Runde = {
    id: neueId(),
    typ,
    gestartetAm: jetzt,
    beendetAm: null,
    durchgefuehrtVon: durchgefuehrtVon.trim(),
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  }
  await db.transaction('rw', db.runden, db.einstellungen, async () => {
    if (await aktiveRunde()) throw new Error('Es läuft bereits eine Kontrolle.')
    await db.runden.add(runde)
    await einstellungenAendern((e) => {
      e.letzterKontrolleur = runde.durchgefuehrtVon
    })
  })
  return runde
}

/** Offene Vorgänge, die in dieser Runde noch nicht gesehen wurden. */
export async function unentschiedeneVorgaenge(rundeId: string): Promise<Vorgang[]> {
  const gesehen = new Set(
    (await db.sichtungen.where('rundeId').equals(rundeId).toArray()).map((s) => s.vorgangId),
  )
  return db.vorgaenge.filter((v) => v.offen && !gesehen.has(v.id)).toArray()
}

export async function rundeAbschliessen(rundeId: string) {
  await db.transaction('rw', db.runden, db.sichtungen, db.vorgaenge, async () => {
    const offen = await unentschiedeneVorgaenge(rundeId)
    if (offen.length > 0) {
      throw new Error(`${offen.length} Fahrzeuge sind noch nicht entschieden.`)
    }
    const jetzt = jetztIso()
    await db.runden.update(rundeId, { beendetAm: jetzt, geaendertAm: jetzt })
  })
}

/** Nur für versehentlich gestartete Kontrollen, in denen noch nichts erfasst wurde. */
export async function rundeVerwerfen(rundeId: string) {
  await db.transaction('rw', db.runden, db.sichtungen, async () => {
    const anzahl = await db.sichtungen.where('rundeId').equals(rundeId).count()
    if (anzahl > 0) throw new Error('In dieser Kontrolle wurde schon etwas erfasst.')
    await db.runden.delete(rundeId)
  })
}

// ---------- Sichtungen ----------

/**
 * Setzt das Ergebnis eines Fahrzeugs in der laufenden Runde. Pro Fahrzeug und Runde
 * gibt es genau eine Sichtung; ein zweiter Tipp ändert sie.
 * „weg“ beendet den Vorgang sofort, „noch da“ öffnet ihn wieder – so bleiben die Daten
 * auch dann stimmig, wenn die App mitten in der Runde geschlossen wird.
 */
export async function sichtungSetzen(
  rundeId: string,
  vorgangId: string,
  ergebnis: Exclude<SichtungsErgebnis, 'neu'>,
) {
  await db.transaction('rw', db.sichtungen, db.vorgaenge, async () => {
    const jetzt = jetztIso()
    const vorhanden = await db.sichtungen
      .where('rundeId')
      .equals(rundeId)
      .filter((s) => s.vorgangId === vorgangId)
      .first()

    if (vorhanden) {
      // Ein in dieser Runde neu erfasstes Fahrzeug bleibt „neu“, außer es wird als „weg“ markiert.
      const neuesErgebnis = vorhanden.ergebnis === 'neu' && ergebnis === 'noch_da' ? 'neu' : ergebnis
      await db.sichtungen.update(vorhanden.id, {
        ergebnis: neuesErgebnis,
        zeitpunkt: jetzt,
        geaendertAm: jetzt,
      })
    } else {
      await db.sichtungen.add({
        id: neueId(),
        vorgangId,
        rundeId,
        zeitpunkt: jetzt,
        ergebnis,
        erstelltAm: jetzt,
        geaendertAm: jetzt,
      })
    }

    if (ergebnis === 'weg') {
      await db.vorgaenge.update(vorgangId, {
        offen: false,
        beendetAm: jetzt,
        beendetInRundeId: rundeId,
        geaendertAm: jetzt,
      })
    } else {
      await db.vorgaenge.update(vorgangId, {
        offen: true,
        beendetAm: null,
        beendetInRundeId: null,
        geaendertAm: jetzt,
      })
    }
  })
}

/** Ein in dieser Runde neu erfasstes Fahrzeug war doch ein Irrtum und ist „weg“ → zurück auf „neu“. */
export async function wegRueckgaengig(rundeId: string, vorgangId: string) {
  const vorgang = await db.vorgaenge.get(vorgangId)
  if (!vorgang) return
  if (vorgang.ersterfasstInRundeId === rundeId) {
    await db.transaction('rw', db.sichtungen, db.vorgaenge, async () => {
      const jetzt = jetztIso()
      const s = await db.sichtungen
        .where('rundeId')
        .equals(rundeId)
        .filter((x) => x.vorgangId === vorgangId)
        .first()
      if (s) await db.sichtungen.update(s.id, { ergebnis: 'neu', zeitpunkt: jetzt, geaendertAm: jetzt })
      await db.vorgaenge.update(vorgangId, {
        offen: true,
        beendetAm: null,
        beendetInRundeId: null,
        geaendertAm: jetzt,
      })
    })
  } else {
    await sichtungSetzen(rundeId, vorgangId, 'noch_da')
  }
}

// ---------- Vorgänge ----------

export interface NeuesFahrzeug {
  kennzeichenAnzeige: string
  modell: string
  ebeneId: string
  stellplatz: number | null
  kategorie: Kategorie
  notiz: string
  fotos: Blob[]
}

export async function fahrzeugErfassen(rundeId: string, f: NeuesFahrzeug): Promise<Vorgang> {
  const jetzt = jetztIso()
  const vorgangId = neueId()
  const fotoIds = f.fotos.map(() => neueId())
  const vorgang: Vorgang = {
    id: vorgangId,
    kennzeichen: normalisiereKennzeichen(f.kennzeichenAnzeige),
    kennzeichenAnzeige: f.kennzeichenAnzeige.trim().toUpperCase(),
    modell: f.modell.trim(),
    ebeneId: f.ebeneId,
    stellplatz: f.stellplatz,
    kategorie: f.kategorie,
    fotoIds,
    ersterfasstAm: jetzt,
    ersterfasstInRundeId: rundeId,
    beendetAm: null,
    beendetInRundeId: null,
    offen: true,
    notiz: f.notiz.trim(),
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  }
  const ohne = istOhneKennzeichen(vorgang.kennzeichen)
  // Ohne Kennzeichen ist das Foto das einzige sichere Erkennungsmerkmal
  if (ohne && f.fotos.length === 0) throw new Error('Fahrzeuge ohne Kennzeichen brauchen ein Foto.')
  await db.transaction('rw', db.vorgaenge, db.sichtungen, db.fotos, async () => {
    const doppelt = ohne
      ? undefined
      : await db.vorgaenge.where('kennzeichen').equals(vorgang.kennzeichen).filter((v) => v.offen).first()
    if (doppelt) throw new Error('Für dieses Kennzeichen gibt es schon einen offenen Vorgang.')
    await db.vorgaenge.add(vorgang)
    await db.sichtungen.add({
      id: neueId(),
      vorgangId,
      rundeId,
      zeitpunkt: jetzt,
      ergebnis: 'neu',
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    })
    await db.fotos.bulkAdd(
      f.fotos.map((blob, i) => ({
        id: fotoIds[i],
        vorgangId,
        blob,
        aufgenommenAm: jetzt,
        erstelltAm: jetzt,
        geaendertAm: jetzt,
      })),
    )
  })
  return vorgang
}

export async function vorgangAendern(
  id: string,
  aenderung: Partial<
    Pick<Vorgang, 'modell' | 'ebeneId' | 'stellplatz' | 'kategorie' | 'notiz' | 'kennzeichenAnzeige'>
  >,
) {
  await db.transaction('rw', db.vorgaenge, async () => {
    const v = await db.vorgaenge.get(id)
    if (!v) return
    const neu: Partial<Vorgang> = { ...aenderung, geaendertAm: jetztIso() }
    // Andere Ebene ohne neue Platzangabe → alter Platz gilt nicht mehr
    if (aenderung.ebeneId !== undefined && aenderung.ebeneId !== v.ebeneId && aenderung.stellplatz === undefined) {
      neu.stellplatz = null
    }
    if (aenderung.kennzeichenAnzeige !== undefined) {
      neu.kennzeichenAnzeige = aenderung.kennzeichenAnzeige.trim().toUpperCase()
      neu.kennzeichen = normalisiereKennzeichen(aenderung.kennzeichenAnzeige)
      if (!neu.kennzeichen) throw new Error('Bitte ein Kennzeichen eingeben.')
      if (istOhneKennzeichen(neu.kennzeichen) && v.fotoIds.length === 0) {
        throw new Error('Fahrzeuge ohne Kennzeichen brauchen ein Foto. Bitte zuerst ein Foto hinzufügen.')
      }
      if (v.offen && neu.kennzeichen !== v.kennzeichen && !istOhneKennzeichen(neu.kennzeichen)) {
        const doppelt = await db.vorgaenge
          .where('kennzeichen')
          .equals(neu.kennzeichen)
          .filter((x) => x.offen && x.id !== id)
          .first()
        if (doppelt) throw new Error('Für dieses Kennzeichen gibt es schon einen offenen Vorgang.')
      }
    }
    await db.vorgaenge.update(id, neu)
  })
}

export async function fotoHinzufuegen(vorgangId: string, blob: Blob) {
  await db.transaction('rw', db.vorgaenge, db.fotos, async () => {
    const v = await db.vorgaenge.get(vorgangId)
    if (!v) return
    const jetzt = jetztIso()
    const id = neueId()
    await db.fotos.add({ id, vorgangId, blob, aufgenommenAm: jetzt, erstelltAm: jetzt, geaendertAm: jetzt })
    await db.vorgaenge.update(vorgangId, { fotoIds: [...v.fotoIds, id], geaendertAm: jetzt })
  })
}

export async function fotoLoeschen(vorgangId: string, fotoId: string) {
  await db.transaction('rw', db.vorgaenge, db.fotos, async () => {
    const v = await db.vorgaenge.get(vorgangId)
    if (!v) return
    if (istOhneKennzeichen(v.kennzeichen) && v.fotoIds.length <= 1) {
      throw new Error('Das letzte Foto eines Fahrzeugs ohne Kennzeichen kann nicht gelöscht werden.')
    }
    await db.fotos.delete(fotoId)
    await db.vorgaenge.update(vorgangId, {
      fotoIds: v.fotoIds.filter((x) => x !== fotoId),
      geaendertAm: jetztIso(),
    })
  })
}

// ---------- Klärungen ----------

/**
 * Neue Klärung zu einem Vorgang. Ältere Klärungen bleiben als Verlauf erhalten; es gilt
 * immer die neueste. Die Kategorie des Fahrzeugs wird passend nachgezogen.
 */
export async function klaerungEintragen(
  vorgangId: string,
  eingabe: KlaerungEingabe,
  kategorie: Kategorie | null = null,
) {
  const fehler = klaerungPruefen(eingabe)
  if (fehler || !eingabe.grund) throw new Error(fehler ?? 'Bitte einen Grund wählen.')
  const grund = eingabe.grund
  await db.transaction('rw', db.vorgaenge, db.klaerungen, async () => {
    const v = await db.vorgaenge.get(vorgangId)
    if (!v) throw new Error('Das Fahrzeug gibt es nicht mehr.')
    const jetzt = jetztIso()
    await db.klaerungen.add({
      id: neueId(),
      vorgangId,
      grund,
      serviceberater: eingabe.serviceberater.trim(),
      eingetragenAm: jetzt,
      notiz: eingabe.notiz.trim(),
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    })
    const neueKategorie = kategorieNachKlaerung(grund, v.kategorie, kategorie)
    if (neueKategorie !== v.kategorie) {
      await db.vorgaenge.update(vorgangId, { kategorie: neueKategorie, geaendertAm: jetzt })
    }
  })
}

// ---------- Maßnahmen ----------

export async function massnahmeEintragen(vorgangId: string, typ: MassnahmeTyp | null, notiz = '') {
  const fehler = massnahmePruefen(typ, notiz)
  if (fehler || !typ) throw new Error(fehler ?? 'Bitte eine Maßnahme wählen.')
  const jetzt = jetztIso()
  await db.massnahmen.add({
    id: neueId(),
    vorgangId,
    typ,
    zeitpunkt: jetzt,
    notiz: notiz.trim(),
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  })
}

/** Nur für Fehleingaben, z. B. versehentlich getippt. */
export async function massnahmeLoeschen(id: string) {
  await db.massnahmen.delete(id)
}

/** Für Fehleingaben: entfernt den Vorgang mit allem, was daran hängt. */
export async function vorgangLoeschen(id: string) {
  await db.transaction(
    'rw',
    [db.vorgaenge, db.sichtungen, db.fotos, db.klaerungen, db.massnahmen],
    async () => {
      await db.sichtungen.where('vorgangId').equals(id).delete()
      await db.fotos.where('vorgangId').equals(id).delete()
      await db.klaerungen.where('vorgangId').equals(id).delete()
      await db.massnahmen.where('vorgangId').equals(id).delete()
      await db.vorgaenge.delete(id)
    },
  )
}
