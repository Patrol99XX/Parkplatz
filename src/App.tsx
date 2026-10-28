import { useEffect } from 'react'
import { usePfad } from './navigation'
import { HamburgSkyline } from './hamburg'
import { useAktiveRunde } from './db/hooks'
import { Uebersicht } from './seiten/Uebersicht'
import { Rundgang } from './seiten/Rundgang'
import { Erfassen } from './seiten/Erfassen'
import { Fahrzeug } from './seiten/Fahrzeug'
import { RundenErgebnis } from './seiten/RundenErgebnis'
import { Sicherung } from './seiten/Sicherung'
import { Einstellungen } from './seiten/Einstellungen'

export function App() {
  const pfad = usePfad()
  const runde = useAktiveRunde()

  useEffect(() => {
    // Bittet Safari, die Daten nicht automatisch zu löschen, wenn Speicher knapp wird.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const [seite, id] = pfad
  let inhalt
  switch (seite) {
    case 'rundgang':
      inhalt = <Rundgang abschluss={id === 'abschluss'} />
      break
    case 'erfassen':
      inhalt = <Erfassen key={id} vorschlag={id ? decodeURIComponent(id) : ''} />
      break
    case 'fahrzeug':
      inhalt = <Fahrzeug key={id} id={id} />
      break
    case 'runde':
      inhalt = <RundenErgebnis id={id} />
      break
    case 'sicherung':
      inhalt = <Sicherung />
      break
    case 'einstellungen':
      inhalt = <Einstellungen />
      break
    default:
      inhalt = <Uebersicht />
  }

  return (
    <>
      <HamburgSkyline className="hintergrund-skyline" />
      <main className="seite">{inhalt}</main>
      <nav className="reiter">
        <a href="#/" className={!seite || seite === 'fahrzeug' ? 'aktiv' : ''}>
          <span aria-hidden>🅿️</span>
          Übersicht
        </a>
        <a
          href="#/rundgang"
          className={seite === 'rundgang' || seite === 'erfassen' || seite === 'runde' ? 'aktiv' : ''}
        >
          <span aria-hidden>📋</span>
          Rundgang{runde && <i className="punkt" aria-label="läuft" />}
        </a>
        <a href="#/sicherung" className={seite === 'sicherung' ? 'aktiv' : ''}>
          <span aria-hidden>💾</span>
          Sicherung
        </a>
        <a href="#/einstellungen" className={seite === 'einstellungen' ? 'aktiv' : ''}>
          <span aria-hidden>⚙️</span>
          Einstellungen
        </a>
      </nav>
    </>
  )
}
