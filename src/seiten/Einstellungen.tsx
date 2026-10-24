import { useState } from 'react'
import { Kopf, mitFehlermeldung } from '../komponenten'
import { useEinstellungen } from '../db/hooks'
import {
  ebeneAktivSetzen,
  ebeneHinzufuegen,
  ebeneLoeschen,
  ebeneUmbenennen,
  ebeneVerschieben,
} from '../db/aktionen'

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
    </>
  )
}
