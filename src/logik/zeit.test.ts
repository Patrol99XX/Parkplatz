import { describe, expect, it } from 'vitest'
import {
  formatDatum,
  formatDatumZeit,
  kalendertageZwischen,
  standdauerText,
  vorgeschlagenerRundenTyp,
} from './zeit'

const t = (monat: number, tag: number, stunde: number, minute = 0) =>
  new Date(2026, monat - 1, tag, stunde, minute)

describe('Formatierung', () => {
  it('deutsches Datum und Uhrzeit', () => {
    expect(formatDatum(t(3, 5, 7))).toBe('05.03.2026')
    expect(formatDatumZeit(t(3, 5, 7, 9))).toBe('05.03.2026, 07:09')
  })
})

describe('kalendertageZwischen', () => {
  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    expect(kalendertageZwischen(t(10, 23, 17), t(10, 24, 8))).toBe(1)
    expect(kalendertageZwischen(t(10, 24, 8), t(10, 24, 17))).toBe(0)
    expect(kalendertageZwischen(t(10, 20, 8), t(10, 24, 7))).toBe(4)
  })

  it('über die Zeitumstellung hinweg', () => {
    // Ende der Sommerzeit am 25.10.2026
    expect(kalendertageZwischen(t(10, 24, 12), t(10, 26, 12))).toBe(2)
    // Beginn der Sommerzeit am 29.03.2026
    expect(kalendertageZwischen(t(3, 28, 12), t(3, 30, 12))).toBe(2)
  })
})

describe('standdauerText', () => {
  const jetzt = t(10, 24, 15)
  it('heute', () => expect(standdauerText(t(10, 24, 8, 15).toISOString(), jetzt)).toBe('seit heute, 08:15'))
  it('gestern', () => expect(standdauerText(t(10, 23, 16, 40).toISOString(), jetzt)).toBe('seit gestern, 16:40'))
  it('mehrere Tage', () => expect(standdauerText(t(10, 21, 8).toISOString(), jetzt)).toBe('seit 3 Tagen (Mi., 21.10.)'))
})

describe('vorgeschlagenerRundenTyp', () => {
  it('vor 12 Uhr morgens, ab 12 Uhr nachmittags', () => {
    expect(vorgeschlagenerRundenTyp(t(10, 24, 7))).toBe('morgens')
    expect(vorgeschlagenerRundenTyp(t(10, 24, 11, 59))).toBe('morgens')
    expect(vorgeschlagenerRundenTyp(t(10, 24, 12))).toBe('nachmittags')
    expect(vorgeschlagenerRundenTyp(t(10, 24, 16))).toBe('nachmittags')
  })
})
