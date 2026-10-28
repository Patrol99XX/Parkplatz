import { describe, expect, it } from 'vitest'
import { istOhneKennzeichen, normalisiereKennzeichen, pruefeKennzeichen } from './kennzeichen'
import type { Vorgang } from '../db/typen'

describe('normalisiereKennzeichen', () => {
  it.each([
    ['HH-AB 123', 'HHAB123'],
    ['hh-ab 123', 'HHAB123'],
    ['  HH  AB-123 ', 'HHAB123'],
    ['M-XY 1234E', 'MXY1234E'],
    ['TÖL-A 5', 'TÖLA5'],
    ['mü ab 12h', 'MÜAB12H'],
    ['HHAB123', 'HHAB123'],
    ['', ''],
  ])('%j → %j', (eingabe, erwartet) => {
    expect(normalisiereKennzeichen(eingabe)).toBe(erwartet)
  })
})

// Zeitpunkte in Ortszeit, damit die Tests unabhängig von der Zeitzone des Rechners sind.
const t = (tag: number, stunde: number, minute = 0) => new Date(2026, 9, tag, stunde, minute)

function vorgang(teil: Partial<Vorgang> & { id: string }): Vorgang {
  return {
    kennzeichen: 'HHAB123',
    kennzeichenAnzeige: 'HH-AB 123',
    modell: '',
    ebeneId: 'e1',
    kategorie: 'unbekannt',
    fotoIds: [],
    ersterfasstAm: t(20, 8).toISOString(),
    ersterfasstInRundeId: 'r1',
    beendetAm: null,
    beendetInRundeId: null,
    offen: true,
    notiz: '',
    erstelltAm: '',
    geaendertAm: '',
    ...teil,
  }
}

describe('pruefeKennzeichen', () => {
  it('ohne Vorgeschichte: keine Hinweise', () => {
    const b = pruefeKennzeichen([], t(24, 8))
    expect(b).toEqual({ offenerVorgang: null, vermutlichZurueck: false, fruehere: [] })
  })

  it('findet den offenen Vorgang', () => {
    const offen = vorgang({ id: 'a' })
    const b = pruefeKennzeichen([offen], t(24, 8))
    expect(b.offenerVorgang?.id).toBe('a')
    expect(b.fruehere).toEqual([])
  })

  it('am selben Tag beendet → vermutlich zurück aus der Werkstatt', () => {
    const v = vorgang({
      id: 'a',
      ersterfasstAm: t(24, 8).toISOString(),
      offen: false,
      beendetAm: t(24, 9).toISOString(),
    })
    const b = pruefeKennzeichen([v], t(24, 15))
    expect(b.vermutlichZurueck).toBe(true)
    expect(b.offenerVorgang).toBeNull()
  })

  it('am Vortag beendet → kein „vermutlich zurück“', () => {
    const v = vorgang({ id: 'a', offen: false, beendetAm: t(23, 16).toISOString() })
    expect(pruefeKennzeichen([v], t(24, 8)).vermutlichZurueck).toBe(false)
  })

  it('Wiederholer: zählt beendete Vorgänge der letzten 30 Tage, neueste zuerst', () => {
    const alt = vorgang({
      id: 'alt',
      ersterfasstAm: t(1, 8).toISOString(),
      offen: false,
      beendetAm: t(1, 9).toISOString(),
    })
    const neu = vorgang({
      id: 'neu',
      ersterfasstAm: t(20, 8).toISOString(),
      offen: false,
      beendetAm: t(21, 9).toISOString(),
    })
    const zuAlt = vorgang({
      id: 'zuAlt',
      ersterfasstAm: new Date(2026, 8, 1, 8).toISOString(),
      offen: false,
      beendetAm: new Date(2026, 8, 2, 8).toISOString(),
    })
    const b = pruefeKennzeichen([alt, zuAlt, neu], t(24, 8))
    expect(b.fruehere.map((v) => v.id)).toEqual(['neu', 'alt'])
  })

  it('lässt den eigenen Vorgang aus (Anzeige am bestehenden Vorgang)', () => {
    const frueher = vorgang({
      id: 'frueher',
      ersterfasstAm: t(24, 8).toISOString(),
      offen: false,
      beendetAm: t(24, 9).toISOString(),
    })
    const aktuell = vorgang({ id: 'aktuell', ersterfasstAm: t(24, 14).toISOString() })
    const b = pruefeKennzeichen([frueher, aktuell], t(24, 14), 'aktuell')
    expect(b.offenerVorgang).toBeNull()
    expect(b.vermutlichZurueck).toBe(true)
    expect(b.fruehere.map((v) => v.id)).toEqual(['frueher'])
  })

  it('Vorgänge nach dem Bezugszeitpunkt zählen nicht', () => {
    const spaeter = vorgang({
      id: 'spaeter',
      ersterfasstAm: t(25, 8).toISOString(),
      offen: false,
      beendetAm: t(25, 9).toISOString(),
    })
    const b = pruefeKennzeichen([spaeter], t(24, 8))
    expect(b.fruehere).toEqual([])
    expect(b.vermutlichZurueck).toBe(false)
  })
})

describe('Fahrzeuge ohne Kennzeichen („OHNE“)', () => {
  it.each(['OHNE', 'ohne', ' Ohne ', 'OH-NE'])('%j gilt als ohne Kennzeichen', (e) => {
    expect(istOhneKennzeichen(e)).toBe(true)
  })
  it.each(['OHNE1', 'HH-OH 1', ''])('%j nicht', (e) => {
    expect(istOhneKennzeichen(e)).toBe(false)
  })

  it('werden nie abgeglichen: kein offener Vorgang, kein Wiederholer, kein „vermutlich zurück“', () => {
    const offen = vorgang({ id: 'a', kennzeichen: 'OHNE', kennzeichenAnzeige: 'OHNE' })
    const heuteWeg = vorgang({
      id: 'b',
      kennzeichen: 'OHNE',
      kennzeichenAnzeige: 'OHNE',
      ersterfasstAm: t(24, 8).toISOString(),
      offen: false,
      beendetAm: t(24, 9).toISOString(),
    })
    expect(pruefeKennzeichen([offen, heuteWeg], t(24, 15))).toEqual({
      offenerVorgang: null,
      vermutlichZurueck: false,
      fruehere: [],
    })
  })
})
