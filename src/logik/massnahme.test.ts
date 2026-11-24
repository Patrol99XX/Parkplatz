import { describe, expect, it } from 'vitest'
import { MASSNAHMEN_ANGEBOT, massnahmePruefen } from './massnahme'

describe('massnahmePruefen', () => {
  it('Maßnahme ist Pflicht', () => {
    expect(massnahmePruefen(null, '')).toMatch(/wählen/)
  })

  it('„Sonstiges“ braucht eine Notiz', () => {
    expect(massnahmePruefen('sonstiges', ' ')).toMatch(/Notiz/)
    expect(massnahmePruefen('sonstiges', 'Schlüssel abgegeben')).toBeNull()
  })

  it('andere Maßnahmen ohne Notiz sind in Ordnung', () => {
    expect(massnahmePruefen('eskalation_leitung', '')).toBeNull()
  })

  it('Hinweiszettel wird nicht angeboten', () => {
    expect(MASSNAHMEN_ANGEBOT).not.toContain('hinweiszettel')
  })
})
