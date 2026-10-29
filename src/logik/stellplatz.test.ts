import { describe, expect, it } from 'vitest'
import { naechsterPlatz, nachPlatz, platzEinlesen, platzText } from './stellplatz'
import type { Vorgang } from '../db/typen'

const ebene0 = { praefix: '0.', von: 1, bis: 20 }
const ebeneMinus1 = { praefix: '-1.', von: 1, bis: 44 }

describe('platzText', () => {
  it('mit Präfix und zweistellig', () => {
    expect(platzText(ebene0, 5)).toBe('0.05')
    expect(platzText(ebene0, 20)).toBe('0.20')
    expect(platzText(ebeneMinus1, 1)).toBe('-1.01')
    expect(platzText(ebeneMinus1, 44)).toBe('-1.44')
  })
  it('dreistellig bei mehr als 99 Plätzen', () => {
    expect(platzText({ praefix: 'A', von: 1, bis: 120 }, 7)).toBe('A007')
  })
  it('ohne Präfix ohne führende Null', () => {
    expect(platzText({ praefix: '', von: 1, bis: 14 }, 7)).toBe('7')
  })
})

describe('platzEinlesen', () => {
  it.each([
    ['5', 5],
    ['05', 5],
    ['0.05', 5],
    [' 0.20 ', 20],
  ])('Ebene 0: %j → %d', (eingabe, nr) => {
    expect(platzEinlesen(eingabe, ebene0)).toEqual({ nr })
  })

  it.each([
    ['44', 44],
    ['-1.05', 5],
    ['-1,05', 5],
    ['−1.12', 12],
  ])('Ebene −1: %j → %d', (eingabe, nr) => {
    expect(platzEinlesen(eingabe, ebeneMinus1)).toEqual({ nr })
  })

  it('leer = kein Platz', () => {
    expect(platzEinlesen('  ', ebene0)).toEqual({ nr: null })
  })

  it('außerhalb des Bereichs', () => {
    expect(platzEinlesen('21', ebene0)).toEqual({
      fehler: 'Platz 0.21 gibt es auf dieser Ebene nicht (0.01–0.20).',
    })
    expect(platzEinlesen('0', ebene0)).toHaveProperty('fehler')
  })

  it('keine Zahl', () => {
    expect(platzEinlesen('ab', ebene0)).toEqual({ fehler: '„ab“ ist keine Platznummer.' })
  })
})

describe('naechsterPlatz', () => {
  it('zählt hoch bis zum letzten Platz', () => {
    expect(naechsterPlatz(5, ebene0)).toBe(6)
    expect(naechsterPlatz(20, ebene0)).toBeNull()
  })
})

describe('nachPlatz', () => {
  const v = (id: string, stellplatz: number | null, ersterfasstAm: string) =>
    ({ id, stellplatz, ersterfasstAm }) as Vorgang
  it('nach Platz, ohne Platz am Ende in Erfassungsreihenfolge', () => {
    const liste = [
      v('ohne2', null, '2026-10-27T09:00:00Z'),
      v('p10', 10, '2026-10-27T08:00:00Z'),
      v('ohne1', null, '2026-10-27T07:00:00Z'),
      v('p2', 2, '2026-10-27T10:00:00Z'),
    ]
    expect(liste.sort(nachPlatz).map((x) => x.id)).toEqual(['p2', 'p10', 'ohne1', 'ohne2'])
  })
})
