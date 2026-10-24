import { describe, expect, it } from 'vitest'
import { pruefeSicherung, sicherungFaellig, sicherungsDateiname, TABELLEN } from './sicherung'

describe('sicherungFaellig', () => {
  const jetzt = new Date(2026, 9, 24, 12)
  it('noch nie gesichert', () => expect(sicherungFaellig(null, jetzt)).toBe(true))
  it('vor 3 Tagen gesichert', () =>
    expect(sicherungFaellig(new Date(2026, 9, 21, 12).toISOString(), jetzt)).toBe(false))
  it('vor genau 7 Tagen gesichert', () =>
    expect(sicherungFaellig(new Date(2026, 9, 17, 12).toISOString(), jetzt)).toBe(false))
  it('vor 8 Tagen gesichert', () =>
    expect(sicherungFaellig(new Date(2026, 9, 16, 12).toISOString(), jetzt)).toBe(true))
})

describe('sicherungsDateiname', () => {
  it('mit Datum und Uhrzeit', () =>
    expect(sicherungsDateiname(new Date(2026, 2, 5, 7, 9))).toBe('parkplatz-sicherung-2026-03-05-0709.json'))
})

describe('pruefeSicherung', () => {
  const gueltig = () => ({
    format: 'parkplatz-kontrolle',
    version: 1,
    exportiertAm: '',
    daten: Object.fromEntries(TABELLEN.map((t) => [t, t === 'einstellungen' ? [{ id: 'app' }] : []])),
  })

  it('akzeptiert eine gültige Sicherung', () => expect(pruefeSicherung(gueltig())).toBeNull())
  it('lehnt fremde Dateien ab', () => {
    expect(pruefeSicherung(null)).toMatch(/keine Sicherungsdatei/)
    expect(pruefeSicherung({ foo: 1 })).toMatch(/keine Sicherungsdatei/)
  })
  it('lehnt neuere Versionen ab', () => expect(pruefeSicherung({ ...gueltig(), version: 99 })).toMatch(/neueren/))
  it('lehnt unvollständige Dateien ab', () => {
    const s = gueltig()
    delete (s.daten as Record<string, unknown>).fotos
    expect(pruefeSicherung(s)).toMatch(/unvollständig/)
  })
})
