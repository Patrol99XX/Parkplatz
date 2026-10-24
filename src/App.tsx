import { useEffect } from 'react'
import { usePfad } from './navigation'
import { useAktiveRunde } from './db/hooks'
import { Uebersicht } from './seiten/Uebersicht'
import { Rundgang } from './seiten/Rundgang'
import { Erfassen } from './seiten/Erfassen'
import { Fahrzeug } from './seiten/Fahrzeug'
import { RundenErgebnis } from './seiten/RundenErgebnis'
import { Sicherung } from './seiten/Sicherung'
import { Einstellungen } from './seiten/Einstellungen'

/** Schlichtes Strich-Symbol; übernimmt die Textfarbe (schwarz bzw. rot im aktiven Reiter). */
function Symbol({ pfad }: { pfad: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={pfad} />
    </svg>
  )
}

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
      inhalt = <Erfassen />
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
      <main className="seite">{inhalt}</main>
      <nav className="reiter">
        <a href="#/" className={!seite || seite === 'fahrzeug' ? 'aktiv' : ''}>
          <Symbol pfad="M5 3h14v18H5zM10 17V7h3.5a3 3 0 0 1 0 6H10" />
          Übersicht
        </a>
        <a
          href="#/rundgang"
          className={seite === 'rundgang' || seite === 'erfassen' || seite === 'runde' ? 'aktiv' : ''}
        >
          <Symbol pfad="M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12l2.5 2.5L16 9" />
          Rundgang{runde && <i className="punkt" aria-label="läuft" />}
        </a>
        <a href="#/sicherung" className={seite === 'sicherung' ? 'aktiv' : ''}>
          <Symbol pfad="M12 4v11M7 10l5 5 5-5M5 20h14" />
          Sicherung
        </a>
        <a href="#/einstellungen" className={seite === 'einstellungen' ? 'aktiv' : ''}>
          <Symbol pfad="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M18 5v4M6 15v4M10 15v4" />
          Einstellungen
        </a>
      </nav>
    </>
  )
}
