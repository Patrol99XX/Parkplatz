import { useEffect } from 'react'
import { usePfad } from './navigation'
import { useAktiveRunde } from './db/hooks'
import { Einstellungen } from './seiten/Einstellungen'

export function App() {
  const pfad = usePfad()
  const runde = useAktiveRunde()

  useEffect(() => {
    // Bittet Safari, die Daten nicht automatisch zu löschen, wenn Speicher knapp wird.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const [seite] = pfad
  let inhalt
  switch (seite) {
    case 'einstellungen':
      inhalt = <Einstellungen />
      break
    default:
      inhalt = <h1>Parkplatz-Kontrolle</h1>
  }

  return (
    <>
      <main className="seite">{inhalt}</main>
      <nav className="reiter">
        <a href="#/" className={!seite || seite === 'fahrzeug' ? 'aktiv' : ''}>
          <span aria-hidden>🅿️</span>Übersicht
        </a>
        <a
          href="#/rundgang"
          className={seite === 'rundgang' || seite === 'erfassen' || seite === 'runde' ? 'aktiv' : ''}
        >
          <span aria-hidden>📋</span>Rundgang{runde && <i className="punkt" aria-label="läuft" />}
        </a>
        <a href="#/sicherung" className={seite === 'sicherung' ? 'aktiv' : ''}>
          <span aria-hidden>💾</span>Sicherung
        </a>
        <a href="#/einstellungen" className={seite === 'einstellungen' ? 'aktiv' : ''}>
          <span aria-hidden>⚙️</span>Einstellungen
        </a>
      </nav>
    </>
  )
}
