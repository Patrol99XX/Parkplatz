import { describe, expect, it } from 'vitest'
import { kategorieNachKlaerung, klaerungPruefen } from './klaerung'

describe('klaerungPruefen', () => {
  it('Grund ist Pflicht', () => {
    expect(klaerungPruefen({ grund: null, serviceberater: 'Meier', notiz: '' })).toMatch(/Grund/)
  })

  it('Serviceberater ist Pflicht', () => {
    expect(klaerungPruefen({ grund: 'wartet_auf_teile', serviceberater: '  ', notiz: '' })).toMatch(/Serviceberater/)
  })

  it('bei „kein Kunde“ ist kein Serviceberater nötig', () => {
    expect(klaerungPruefen({ grund: 'kein_kunde', serviceberater: '', notiz: '' })).toBeNull()
  })

  it('„Sonstiges“ braucht eine Notiz', () => {
    expect(klaerungPruefen({ grund: 'sonstiges', serviceberater: 'Meier', notiz: '' })).toMatch(/Notiz/)
    expect(klaerungPruefen({ grund: 'sonstiges', serviceberater: 'Meier', notiz: 'Gutachter' })).toBeNull()
  })

  it('vollständige Klärung ist in Ordnung', () => {
    expect(klaerungPruefen({ grund: 'fertig_kunde_informiert', serviceberater: 'Meier', notiz: '' })).toBeNull()
  })
})

describe('kategorieNachKlaerung', () => {
  it('Kundengrund macht aus „unbekannt“ und „Fremdparker“ einen Kunden', () => {
    expect(kategorieNachKlaerung('wartet_auf_teile', 'unbekannt')).toBe('kunde')
    expect(kategorieNachKlaerung('nicht_bearbeitet', 'fremdparker')).toBe('kunde')
  })

  it('Mitarbeiter und Kunde bleiben bei Kundengrund', () => {
    expect(kategorieNachKlaerung('fertig_kunde_informiert', 'mitarbeiter')).toBe('mitarbeiter')
    expect(kategorieNachKlaerung('fertig_kunde_informiert', 'kunde')).toBe('kunde')
  })

  it('„kein Kunde“ übernimmt die gewählte Kategorie', () => {
    expect(kategorieNachKlaerung('kein_kunde', 'unbekannt', 'fremdparker')).toBe('fremdparker')
    expect(kategorieNachKlaerung('kein_kunde', 'kunde', 'mitarbeiter')).toBe('mitarbeiter')
  })

  it('„kein Kunde“ ohne Auswahl: aus Kunde wird unbekannt, sonst bleibt es', () => {
    expect(kategorieNachKlaerung('kein_kunde', 'kunde')).toBe('unbekannt')
    expect(kategorieNachKlaerung('kein_kunde', 'fremdparker')).toBe('fremdparker')
    expect(kategorieNachKlaerung('kein_kunde', 'unbekannt', 'unbekannt')).toBe('unbekannt')
  })
})
