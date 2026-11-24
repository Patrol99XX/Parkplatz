import { describe, expect, it } from 'vitest'
import { berechneAmpel, nachDringlichkeit, schwellenVon, STANDARD_SCHWELLEN, type AmpelEingabe } from './ampel'
import type { KlaerungsGrund, SichtungsErgebnis } from '../db/typen'

// Montag, 23.11.2026 als Erfassungstag. Ortszeit, damit Kalendertage stimmen.
const t = (tag: number, stunde: number, minute = 0) => new Date(2026, 10, tag, stunde, minute).toISOString()
const MO = 23
const DI = 24
const MI = 25
const DO = 26

const sicht = (zeitpunkt: string, ergebnis: SichtungsErgebnis = 'noch_da') => ({ zeitpunkt, ergebnis })

function eingabe(teil: Partial<AmpelEingabe> = {}): AmpelEingabe {
  return {
    ersterfasstAm: t(MO, 8),
    kategorie: 'unbekannt',
    sichtungen: [sicht(t(MO, 8), 'neu')],
    klaerung: null,
    schwellen: STANDARD_SCHWELLEN,
    ...teil,
  }
}

const klaerung = (grund: KlaerungsGrund, eingetragenAm: string) => ({ grund, eingetragenAm })

describe('ohne Klärung (Kunde oder unbekannt)', () => {
  it('grün: erstmals erfasst', () => {
    expect(berechneAmpel(eingabe()).farbe).toBe('gruen')
  })

  it('gelb: bei der nächsten Kontrolle am selben Tag noch da', () => {
    const a = berechneAmpel(eingabe({ sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MO, 14))] }))
    expect(a.farbe).toBe('gelb')
    expect(a.aufKlaerungsliste).toBe(false)
  })

  it('rot: bei der Morgenkontrolle des Folgetages noch da → Klärungsliste', () => {
    const a = berechneAmpel(
      eingabe({ sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MO, 14)), sicht(t(DI, 8))] }),
    )
    expect(a.farbe).toBe('rot')
    expect(a.aufKlaerungsliste).toBe(true)
  })

  it('rot auch bei Erfassung am Nachmittag und Sichtung am nächsten Morgen', () => {
    const a = berechneAmpel(
      eingabe({ ersterfasstAm: t(MO, 15), sichtungen: [sicht(t(MO, 15), 'neu'), sicht(t(DI, 8))] }),
    )
    expect(a.farbe).toBe('rot')
  })

  it('bleibt gelb, solange am Folgetag noch keine Kontrolle war (Uhrzeit zählt nicht)', () => {
    const a = berechneAmpel(eingabe({ sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MO, 14))] }))
    expect(a.farbe).toBe('gelb')
  })

  it('Kategorie „Kunde“ verhält sich wie „unbekannt“', () => {
    const a = berechneAmpel(eingabe({ kategorie: 'kunde', sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))] }))
    expect(a.farbe).toBe('rot')
  })

  it('„weg“-Sichtungen zählen nicht als Antreffen', () => {
    const a = berechneAmpel(eingabe({ sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MO, 14), 'weg')] }))
    expect(a.farbe).toBe('gruen')
  })

  it('alte Daten ohne Sichtung: grün', () => {
    expect(berechneAmpel(eingabe({ sichtungen: [] })).farbe).toBe('gruen')
  })
})

describe('Klärung fertig_* (Abholfrist ab Klärung)', () => {
  for (const grund of ['fertig_kunde_informiert', 'fertig_kunde_nicht_erreicht'] as const) {
    it(`${grund}: grün bis 24 h`, () => {
      const a = berechneAmpel(
        eingabe({ klaerung: klaerung(grund, t(MO, 10)), sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))] }),
      )
      expect(a.farbe).toBe('gruen')
      expect(a.aufKlaerungsliste).toBe(false)
    })

    it(`${grund}: gelb über 24 h → Kunde kontaktieren, Klärungsliste`, () => {
      const a = berechneAmpel(
        eingabe({ klaerung: klaerung(grund, t(MO, 10)), sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 14))] }),
      )
      expect(a).toMatchObject({ farbe: 'gelb', aufKlaerungsliste: true, vorschlag: 'kunde_kontaktiert' })
    })

    it(`${grund}: rot über 48 h → Eskalation an Leitung`, () => {
      const a = berechneAmpel(
        eingabe({ klaerung: klaerung(grund, t(MO, 10)), sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MI, 14))] }),
      )
      expect(a).toMatchObject({ farbe: 'rot', aufKlaerungsliste: true, vorschlag: 'eskalation_leitung' })
    })
  }

  it('Frist läuft ab der Klärung, nicht ab der Erfassung', () => {
    // seit Montag da, aber erst Mittwoch 10 Uhr fertig gemeldet → Donnerstag 8 Uhr noch grün
    const a = berechneAmpel(
      eingabe({
        klaerung: klaerung('fertig_kunde_informiert', t(MI, 10)),
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DO, 8))],
      }),
    )
    expect(a.farbe).toBe('gruen')
  })

  it('Klärung nach der letzten Sichtung: grün', () => {
    const a = berechneAmpel(
      eingabe({ klaerung: klaerung('fertig_kunde_informiert', t(DI, 10)), sichtungen: [sicht(t(MO, 8), 'neu')] }),
    )
    expect(a.farbe).toBe('gruen')
  })
})

describe('Klärung mit anderem Grund', () => {
  const gruende = ['nicht_bearbeitet', 'wartet_auf_teile', 'in_bearbeitung_extern', 'sonstiges'] as const

  for (const grund of gruende) {
    it(`${grund}: gelb, Erfassung Montag → rot erst ab Donnerstag`, () => {
      const bis = (tag: number) =>
        berechneAmpel(
          eingabe({ klaerung: klaerung(grund, t(MO, 10)), sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(tag, 8))] }),
        ).farbe
      expect(bis(DI)).toBe('gelb')
      expect(bis(MI)).toBe('gelb')
      expect(bis(DO)).toBe('rot')
    })
  }

  it('Klärung von heute: nicht erneut auf der Klärungsliste', () => {
    const a = berechneAmpel(
      eingabe({
        klaerung: klaerung('wartet_auf_teile', t(DI, 10)),
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8)), sicht(t(DI, 14))],
      }),
    )
    expect(a).toMatchObject({ farbe: 'gelb', aufKlaerungsliste: false })
  })

  it('Klärung von gestern: bei der nächsten Morgenkontrolle wieder auf der Klärungsliste', () => {
    const a = berechneAmpel(
      eingabe({
        klaerung: klaerung('wartet_auf_teile', t(DI, 10)),
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8)), sicht(t(MI, 8))],
      }),
    )
    expect(a).toMatchObject({ farbe: 'gelb', aufKlaerungsliste: true })
  })
})

describe('Fremdparker und Mitarbeiter (Antreffen = Kalendertage)', () => {
  it('Fremdparker: 1. Tag grün, auch bei zwei Kontrollen am selben Tag', () => {
    const a = berechneAmpel(
      eingabe({ kategorie: 'fremdparker', sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(MO, 14))] }),
    )
    expect(a.farbe).toBe('gruen')
  })

  it('Fremdparker: 2. Antreffen gelb, kein Vorschlag (keine Hinweiszettel)', () => {
    const a = berechneAmpel(eingabe({ kategorie: 'fremdparker', sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))] }))
    expect(a).toMatchObject({ farbe: 'gelb', vorschlag: null, aufKlaerungsliste: false })
  })

  it('Fremdparker: 3. Antreffen rot, Eskalation vorschlagen', () => {
    const a = berechneAmpel(
      eingabe({
        kategorie: 'fremdparker',
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8)), sicht(t(MI, 8))],
      }),
    )
    expect(a).toMatchObject({ farbe: 'rot', vorschlag: 'eskalation_leitung', aufKlaerungsliste: true })
  })

  it('frühere Aufenthalte derselben Nummer zählen mit', () => {
    // Montag und Dienstag schon da gewesen, jetzt Donnerstag wieder → 3. Antreffen
    const a = berechneAmpel(
      eingabe({
        kategorie: 'fremdparker',
        ersterfasstAm: t(DO, 8),
        sichtungen: [sicht(t(DO, 8), 'neu')],
        fruehereSichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8)), sicht(t(MI, 8), 'weg')],
      }),
    )
    expect(a.farbe).toBe('rot')
  })

  it('Mitarbeiter: 2. Antreffen gelb mit Vorschlag „intern angesprochen“', () => {
    const a = berechneAmpel(eingabe({ kategorie: 'mitarbeiter', sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))] }))
    expect(a).toMatchObject({ farbe: 'gelb', vorschlag: 'intern_angesprochen', aufKlaerungsliste: true })
  })

  it('Klärung „kein Kunde“ ohne Kategorie: Fremdparker-Regeln', () => {
    const a = berechneAmpel(
      eingabe({ klaerung: klaerung('kein_kunde', t(MO, 10)), sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))] }),
    )
    expect(a).toMatchObject({ farbe: 'gelb', vorschlag: null })
  })

  it('Klärung „kein Kunde“ mit Kategorie Mitarbeiter: Mitarbeiter-Regeln', () => {
    const a = berechneAmpel(
      eingabe({
        kategorie: 'mitarbeiter',
        klaerung: klaerung('kein_kunde', t(MO, 10)),
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8))],
      }),
    )
    expect(a.vorschlag).toBe('intern_angesprochen')
  })

  it('eine echte Klärung geht vor der Kategorie (neueste Information gewinnt)', () => {
    const a = berechneAmpel(
      eingabe({
        kategorie: 'fremdparker',
        klaerung: klaerung('fertig_kunde_informiert', t(DI, 9)),
        sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DI, 8)), sicht(t(MI, 8))],
      }),
    )
    expect(a.farbe).toBe('gruen')
  })
})

describe('Schwellen', () => {
  it('fehlende Einstellungen ergeben die Standardwerte', () => {
    expect(schwellenVon(undefined)).toEqual(STANDARD_SCHWELLEN)
    expect(schwellenVon({ schwellen: { klaerungRotAbTag: 5 } })).toEqual({ ...STANDARD_SCHWELLEN, klaerungRotAbTag: 5 })
  })

  it('geänderte Schwelle wirkt sofort', () => {
    const e = eingabe({
      klaerung: klaerung('wartet_auf_teile', t(MO, 10)),
      sichtungen: [sicht(t(MO, 8), 'neu'), sicht(t(DO, 8))],
      schwellen: { ...STANDARD_SCHWELLEN, klaerungRotAbTag: 5 },
    })
    expect(berechneAmpel(e).farbe).toBe('gelb')
  })
})

describe('nachDringlichkeit', () => {
  it('rot vor gelb vor grün, innerhalb länger stehende zuerst', () => {
    const z = (farbe: 'rot' | 'gelb' | 'gruen', ersterfasstAm: string, id: string) => ({
      id,
      ersterfasstAm,
      ampel: { farbe, grund: '', aufKlaerungsliste: true, vorschlag: null },
    })
    const liste = [z('gelb', t(MO, 8), 'a'), z('rot', t(DI, 8), 'b'), z('rot', t(MO, 8), 'c'), z('gruen', t(MO, 7), 'd')]
    expect(liste.sort(nachDringlichkeit).map((x) => x.id)).toEqual(['c', 'b', 'a', 'd'])
  })
})
