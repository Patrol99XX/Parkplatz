import { describe, expect, it } from 'vitest'
import { bereinigungPlanen } from './bereinigung'

const jetzt = new Date(2026, 10, 24, 6, 0)
const vorTagen = (tage: number) => new Date(jetzt.getTime() - tage * 24 * 60 * 60 * 1000).toISOString()
const fristen = { fotosTage: 30, vorgaengeTage: 90 }

const vorgang = (id: string, beendetVorTagen: number | null, fotos = 1) => ({
  id,
  offen: beendetVorTagen === null,
  beendetAm: beendetVorTagen === null ? null : vorTagen(beendetVorTagen),
  fotoIds: Array.from({ length: fotos }, (_, i) => `${id}-foto${i}`),
})

describe('bereinigungPlanen', () => {
  it('offene Fahrzeuge werden nie angetastet, auch nach Monaten', () => {
    const plan = bereinigungPlanen([vorgang('a', null)], [], new Map(), fristen, jetzt)
    expect(plan).toEqual({ vorgangIds: [], fotoVorgangIds: [], rundenIds: [] })
  })

  it('Fotos nach 30 Tagen, Vorgang bleibt', () => {
    const plan = bereinigungPlanen([vorgang('a', 29), vorgang('b', 31)], [], new Map(), fristen, jetzt)
    expect(plan.fotoVorgangIds).toEqual(['b'])
    expect(plan.vorgangIds).toEqual([])
  })

  it('Vorgang nach 90 Tagen komplett – dann nicht zusätzlich in der Fotoliste', () => {
    const plan = bereinigungPlanen([vorgang('a', 89), vorgang('b', 91)], [], new Map(), fristen, jetzt)
    expect(plan.vorgangIds).toEqual(['b'])
    expect(plan.fotoVorgangIds).toEqual(['a'])
  })

  it('Vorgang ohne Fotos landet nicht in der Fotoliste', () => {
    const plan = bereinigungPlanen([vorgang('a', 40, 0)], [], new Map(), fristen, jetzt)
    expect(plan.fotoVorgangIds).toEqual([])
  })

  it('eigene Fristen werden beachtet', () => {
    const plan = bereinigungPlanen([vorgang('a', 10)], [], new Map(), { fotosTage: 7, vorgaengeTage: 30 }, jetzt)
    expect(plan.fotoVorgangIds).toEqual(['a'])
  })

  it('alte Runde wird gelöscht, wenn alle ihre Fahrzeuge gelöscht werden', () => {
    const runden = [
      { id: 'r1', gestartetAm: vorTagen(100), beendetAm: vorTagen(100) },
      { id: 'r2', gestartetAm: vorTagen(100), beendetAm: vorTagen(100) },
      { id: 'r3', gestartetAm: vorTagen(100), beendetAm: null }, // läuft noch (vergessen)
      { id: 'r4', gestartetAm: vorTagen(10), beendetAm: vorTagen(10) },
    ]
    const sichtungen = new Map([
      ['r1', ['alt']],
      ['r2', ['alt', 'offen']],
      ['r4', []],
    ])
    const plan = bereinigungPlanen([vorgang('alt', 95), vorgang('offen', null)], runden, sichtungen, fristen, jetzt)
    expect(plan.rundenIds).toEqual(['r1'])
  })
})
