// Kleine, mehrfach verwendete Bausteine der Oberfläche.
import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { verkleinereFoto } from './logik/foto'

/**
 * Seitenkopf. zurueck = feste Zielseite; zurueck="verlauf" geht wie der Zurück-Knopf
 * des Browsers dorthin, woher man kam (z. B. Fahrzeug aus Übersicht oder Rundgang).
 */
export function Kopf({ titel, zurueck, children }: { titel: string; zurueck?: string; children?: ReactNode }) {
  return (
    <header className="kopf">
      {zurueck === 'verlauf' ? (
        <button
          type="button"
          className="zurueck"
          aria-label="Zurück"
          onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/'))}
        >
          ‹
        </button>
      ) : zurueck !== undefined && (
        <a className="zurueck" href={`#/${zurueck}`} aria-label="Zurück">
          ‹
        </a>
      )}
      <h1>{titel}</h1>
      {children}
    </header>
  )
}

/** Knopfleiste zur Auswahl eines Werts – schneller zu treffen als eine Ausklappliste. */
export function Auswahl<T extends string>({
  werte,
  wert,
  beiAuswahl,
  text,
}: {
  werte: readonly T[]
  wert: T | null
  beiAuswahl: (w: T) => void
  text: (w: T) => string
}) {
  return (
    <div className="auswahl" role="radiogroup">
      {werte.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={w === wert}
          className={w === wert ? 'gewaehlt' : ''}
          onClick={() => beiAuswahl(w)}
        >
          {text(w)}
        </button>
      ))}
    </div>
  )
}

/** Zeigt ein Foto aus einem Blob an und gibt den Speicher beim Verlassen wieder frei. */
export function BlobBild({ blob, alt, onClick }: { blob: Blob; alt: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt={alt} onClick={onClick} /> : null
}

export function FotoAusDb({ fotoId, alt, onClick }: { fotoId: string; alt: string; onClick?: () => void }) {
  const foto = useLiveQuery(() => db.fotos.get(fotoId), [fotoId])
  return foto ? <BlobBild blob={foto.blob} alt={alt} onClick={onClick} /> : <div className="foto-fehlt" />
}

/**
 * Öffnet auf dem iPhone/iPad direkt die Kamera (capture="environment" = Rückkamera).
 * Das Foto wird vor dem Speichern verkleinert.
 */
export function FotoAufnahme({
  beiFoto,
  text = '📷 Foto aufnehmen',
  eingabeRef,
}: {
  beiFoto: (b: Blob) => void
  text?: string
  /** Zugriff auf das Datei-Feld, um die Kamera per Programm zu öffnen (z. B. bei „OHNE“) */
  eingabeRef?: Ref<HTMLInputElement>
}) {
  const [laedt, setLaedt] = useState(false)
  return (
    <label className={`knopf zweitrangig foto-knopf ${laedt ? 'laedt' : ''}`}>
      {laedt ? 'Foto wird verarbeitet …' : text}
      <input
        ref={eingabeRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (ev) => {
          const datei = ev.target.files?.[0]
          ev.target.value = '' // damit dasselbe Foto erneut gewählt werden kann
          if (!datei) return
          setLaedt(true)
          try {
            beiFoto(await verkleinereFoto(datei))
          } catch (e) {
            alert(e instanceof Error ? e.message : 'Foto konnte nicht verarbeitet werden.')
          } finally {
            setLaedt(false)
          }
        }}
      />
    </label>
  )
}

/** Vollbildanzeige eines Fotos; Tippen schließt sie. */
export function FotoVollbild({ fotoId, schliessen }: { fotoId: string; schliessen: () => void }) {
  return (
    <div className="vollbild" onClick={schliessen} role="dialog" aria-label="Foto, tippen zum Schließen">
      <FotoAusDb fotoId={fotoId} alt="Foto" />
    </div>
  )
}

export function Hinweis({ art = 'info', children }: { art?: 'info' | 'warnung' | 'fehler'; children: ReactNode }) {
  return <div className={`hinweis ${art}`}>{children}</div>
}

/** Führt eine Datenbankaktion aus und zeigt Fehler verständlich an. */
export async function mitFehlermeldung<T>(aktion: () => Promise<T>): Promise<T | undefined> {
  try {
    return await aktion()
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
    return undefined
  }
}
