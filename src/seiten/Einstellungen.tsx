import { useState } from 'react'
import { Kopf, mitFehlermeldung } from '../komponenten'
import { useEinstellungen } from '../db/hooks'
import {
  berichtEmpfaengerSetzen,
  ebeneAktivSetzen,
  ebeneHinzufuegen,
  ebeneLoeschen,
  ebeneStellplaetzeSetzen,
  ebeneUmbenennen,
  ebeneVerschieben,
  platzHochzaehlenSetzen,
} from '../db/aktionen'
import type { Ebene } from '../db/typen'
import { platzText } from '../logik/stellplatz'

export function Einstellungen() {
  const einstellungen = useEinstellungen()
  const [neu, setNeu] = useState('')

  if (!einstellungen) return null
  const ebenen = einstellungen.ebenen

  return (
    <>
      <Kopf titel="Einstellungen" />
      <section className="karte">
        <h2>Ebenen und Flächen</h2>
        <p className="klein">
          Reihenfolge wie beim Rundgang. Ebenen, auf denen schon Fahrzeuge erfasst wurden, lassen
          sich nicht löschen, nur ausblenden – sonst fehlt der Name in der Historie.
        </p>
        <ul className="ebenen-liste">
          {ebenen.map((e, i) => (
            <li key={e.id} className={e.aktiv ? '' : 'ausgeblendet'}>
              <input
                aria-label="Name der Ebene"
                defaultValue={e.name}
                onBlur={(ev) => {
                  const name = ev.target.value.trim()
                  if (!name) ev.target.value = e.name
                  else if (name !== e.name) ebeneUmbenennen(e.id, name)
                }}
              />
              <div className="ebene-knoepfe">
                <button
                  type="button"
                  className="knopf klein-knopf"
                  disabled={i === 0}
                  aria-label="Nach oben"
                  onClick={() => ebeneVerschieben(e.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf"
                  disabled={i === ebenen.length - 1}
                  aria-label="Nach unten"
                  onClick={() => ebeneVerschieben(e.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf"
                  onClick={() => ebeneAktivSetzen(e.id, !e.aktiv)}
                >
                  {e.aktiv ? 'Ausblenden' : 'Einblenden'}
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf gefahr"
                  onClick={async () => {
                    if (!confirm(`Ebene „${e.name}“ löschen?`)) return
                    const ok = await mitFehlermeldung(() => ebeneLoeschen(e.id))
                    if (ok === false) {
                      alert('Auf dieser Ebene wurden schon Fahrzeuge erfasst. Sie kann nur ausgeblendet werden.')
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
              <Stellplaetze ebene={e} />
            </li>
          ))}
        </ul>
        <form
          className="zeile"
          onSubmit={async (ev) => {
            ev.preventDefault()
            if (!neu.trim()) return
            await ebeneHinzufuegen(neu)
            setNeu('')
          }}
        >
          <input placeholder="Neue Ebene oder Fläche" value={neu} onChange={(ev) => setNeu(ev.target.value)} />
          <button type="submit" className="knopf" disabled={!neu.trim()}>
            Hinzufügen
          </button>
        </form>
      </section>

      <section className="karte">
        <h2>Erfassen</h2>
        <label className="schalter">
          <input
            type="checkbox"
            checked={einstellungen.platzHochzaehlen !== false}
            onChange={(ev) => platzHochzaehlenSetzen(ev.target.checked)}
          />
          <span>
            Platznummer automatisch hochzählen
            <br />
            <span className="klein">Nach dem Speichern von 0.05 ist 0.06 vorgeschlagen.</span>
          </span>
        </label>
      </section>

      <section className="karte">
        <h2>Bericht per E-Mail</h2>
        <p className="klein">
          An diese Adresse geht der Bericht nach einer Kontrolle (Fahrzeuge, die seit gestern oder
          länger stehen). Mehrere Adressen mit Komma trennen.
        </p>
        <input
          type="email"
          multiple
          aria-label="E-Mail-Empfänger"
          placeholder="name@firma.de"
          defaultValue={einstellungen.berichtEmpfaenger ?? ''}
          autoCapitalize="off"
          autoCorrect="off"
          onBlur={(ev) => {
            if (ev.target.value.trim() !== (einstellungen.berichtEmpfaenger ?? '')) {
              berichtEmpfaengerSetzen(ev.target.value)
            }
          }}
        />
      </section>
    </>
  )
}

/** Nummernbereich einer Ebene, z. B. Präfix „0.“, Plätze 1 bis 20 → 0.01–0.20 */
function Stellplaetze({ ebene }: { ebene: Ebene }) {
  const b = ebene.stellplaetze
  if (!b) {
    return (
      <button
        type="button"
        className="text-knopf"
        onClick={() => ebeneStellplaetzeSetzen(ebene.id, { praefix: '', von: 1, bis: 20 })}
      >
        Stellplätze nummerieren
      </button>
    )
  }
  const zahl = (wert: string, alt: number) => {
    const n = Number(wert)
    return Number.isInteger(n) && n >= 0 ? n : alt
  }
  return (
    <div className="stellplatz-bereich">
      <span className="klein">
        Stellplätze {platzText(b, b.von)} bis {platzText(b, b.bis)}
      </span>
      <div className="zeile">
        <label>
          <span className="klein">Präfix</span>
          <input
            defaultValue={b.praefix}
            key={`p-${b.praefix}`}
            onBlur={(ev) => ev.target.value !== b.praefix && ebeneStellplaetzeSetzen(ebene.id, { ...b, praefix: ev.target.value.trim() })}
          />
        </label>
        <label>
          <span className="klein">von</span>
          <input
            inputMode="numeric"
            defaultValue={b.von}
            key={`v-${b.von}`}
            onBlur={(ev) => {
              const von = zahl(ev.target.value, b.von)
              if (von !== b.von && von <= b.bis) ebeneStellplaetzeSetzen(ebene.id, { ...b, von })
              else ev.target.value = String(b.von)
            }}
          />
        </label>
        <label>
          <span className="klein">bis</span>
          <input
            inputMode="numeric"
            defaultValue={b.bis}
            key={`b-${b.bis}`}
            onBlur={(ev) => {
              const bis = zahl(ev.target.value, b.bis)
              if (bis !== b.bis && bis >= b.von) ebeneStellplaetzeSetzen(ebene.id, { ...b, bis })
              else ev.target.value = String(b.bis)
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="text-knopf"
        onClick={() => confirm(`Nummerierung für „${ebene.name}“ entfernen?`) && ebeneStellplaetzeSetzen(ebene.id, null)}
      >
        Keine Nummerierung
      </button>
    </div>
  )
}
