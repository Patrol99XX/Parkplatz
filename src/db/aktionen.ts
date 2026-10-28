// Alle schreibenden Datenbankzugriffe an einer Stelle. Zusammengehörige Änderungen
// laufen in einer Transaktion: Entweder wird alles gespeichert oder nichts.
import { db } from './db'
import type { Einstellungen, Kategorie, Runde, StellplatzBereich, RundenTyp, SichtungsErgebnis, Vorgang } from './typen'
import { jetztIso, neueId } from '../logik/uuid'
import { normalisiereKennzeichen } from '../logik/kennzeichen'

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
  await db.transaction('rw', db.vorgaenge, db.sichtungen, db.fotos, async () => {
    const doppelt = await db.vorgaenge
      .where('kennzeichen')
      .equals(vorgang.kennzeichen)
      .filter((v) => v.offen)
      .first()
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
      if (v.offen && neu.kennzeichen !== v.kennzeichen) {
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
    await db.fotos.delete(fotoId)
    await db.vorgaenge.update(vorgangId, {
      fotoIds: v.fotoIds.filter((x) => x !== fotoId),
      geaendertAm: jetztIso(),
    })
  })
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
