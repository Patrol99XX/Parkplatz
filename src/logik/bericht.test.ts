import { describe, expect, it } from 'vitest'
import { berichtErstellen, langeStehende, mailtoLink } from './bericht'
import type { Runde, Vorgang } from '../db/typen'

const t = (tag: number, stunde: number, minute = 0) => new Date(2026, 9, tag, stunde, minute)
const jetzt = t(24, 15)

function vorgang(id: string, ersterfasst: Date, teil: Partial<Vorgang> = {}): Vorgang {
  return {
    id,
    kennzeichen: id,
    kennzeichenAnzeige: id,
    modell: '',
    ebeneId: 'e1',
    kategorie: 'unbekannt',
    fotoIds: [],
    ersterfasstAm: ersterfasst.toISOString(),
    ersterfasstInRundeId: 'r0',
    beendetAm: null,
    beendetInRundeId: null,
    offen: true,
    notiz: '',
    erstelltAm: '',
    geaendertAm: '',
    ...teil,
  }
}

const runde: Runde = {
  id: 'r1',
  typ: 'nachmittags',
  gestartetAm: t(24, 14, 5).toISOString(),
  beendetAm: t(24, 14, 40).toISOString(),
  durchgefuehrtVon: 'Max',
  erstelltAm: '',
  geaendertAm: '',
}

const ebenen = [
  { id: 'e1', name: 'Parkhaus Ebene 0', aktiv: true },
  { id: 'e2', name: 'Fläche neu', aktiv: true },
]

describe('langeStehende', () => {
  it('nur Fahrzeuge seit gestern oder länger, älteste zuerst', () => {
    const heute = vorgang('HEUTE', t(24, 8))
    const gestern = vorgang('GESTERN', t(23, 17))
    const alt = vorgang('ALT', t(20, 8))
    expect(langeStehende([heute, gestern, alt], jetzt).map((v) => v.id)).toEqual(['ALT', 'GESTERN'])
  })
})

describe('berichtErstellen', () => {
  it('Betreff und Text mit Gruppen nach Ebene', () => {
    const { betreff, text } = berichtErstellen({
      runde,
      zahlen: { neu: 1, noch_da: 3, weg: 2 },
      offene: [
        vorgang('HH-AB 123', t(21, 8), { modell: 'Golf weiß', kategorie: 'kunde' }),
        vorgang('M-XY 99', t(23, 16, 40), { ebeneId: 'e2', notiz: 'Reifen platt' }),
        vorgang('HEUTE 1', t(24, 14, 10)),
      ],
      gesehen: new Map([['HH-AB 123', 6], ['M-XY 99', 2]]),
      ebenen,
      jetzt,
    })
    expect(betreff).toBe('Parkplatz: Nachmittagskontrolle 24.10.2026 – 2 Fahrzeuge seit gestern oder länger')
    expect(text).toBe(
      [
        'Nachmittagskontrolle am 24.10.2026, 14:05–14:40 (Max)',
        'Neu: 1 · Noch da: 3 · Weg: 2',
        '',
        'Seit gestern oder länger: 2 (Stand 24.10.2026, 15:00)',
        '',
        'PARKHAUS EBENE 0',
        '• HH-AB 123 · Golf weiß · seit 3 Tagen (Mi., 21.10.) · Kunde · 6× gesehen',
        '',
        'FLÄCHE NEU',
        '• M-XY 99 · seit gestern, 16:40 · 2× gesehen · Notiz: Reifen platt',
        '',
        '– gesendet aus der Parkplatz-Kontrolle',
      ].join('\n'),
    )
  })

  it('mit Stellplatz, innerhalb der Ebene nach Platz sortiert', () => {
    const { text } = berichtErstellen({
      runde,
      zahlen: { neu: 0, noch_da: 2, weg: 0 },
      offene: [
        vorgang('ZWEITER', t(20, 8), { stellplatz: 12 }),
        vorgang('ERSTER', t(22, 8), { stellplatz: 5 }),
      ],
      gesehen: new Map(),
      ebenen: [{ id: 'e1', name: 'Parkhaus Ebene 0', aktiv: true, stellplaetze: { praefix: '0.', von: 1, bis: 20 } }],
      jetzt,
    })
    expect(text).toContain(
      [
        'PARKHAUS EBENE 0',
        '• ERSTER · Platz 0.05 · seit 2 Tagen (Do., 22.10.) · 0× gesehen',
        '• ZWEITER · Platz 0.12 · seit 4 Tagen (Di., 20.10.) · 0× gesehen',
      ].join('\n'),
    )
  })

  it('ohne lange stehende Fahrzeuge', () => {
    const { betreff, text } = berichtErstellen({
      runde,
      zahlen: { neu: 1, noch_da: 0, weg: 0 },
      offene: [vorgang('HEUTE', t(24, 14, 10))],
      gesehen: new Map(),
      ebenen,
      jetzt,
    })
    expect(betreff).toMatch(/– 0 Fahrzeuge seit gestern/)
    expect(text).toContain('Keine Fahrzeuge, die seit gestern oder länger stehen (Stand 24.10.2026, 15:00).')
  })
})

describe('mailtoLink', () => {
  it('kodiert Betreff und Text, Zeilenumbrüche als CRLF', () => {
    expect(mailtoLink(' a@b.de ', 'Ä & B', 'x\ny')).toBe('mailto:a@b.de?subject=%C3%84%20%26%20B&body=x%0D%0Ay')
  })
  it('mehrere Empfänger, auch mit Semikolon getrennt', () => {
    expect(mailtoLink('a@b.de, c@d.de;e@f.de', 'x', 'y')).toMatch(/^mailto:a@b\.de,c@d\.de,e@f\.de\?/)
  })
  it('ohne Empfänger öffnet sich eine leere Mail', () => {
    expect(mailtoLink('', 'x', 'y')).toBe('mailto:?subject=x&body=y')
  })
})
