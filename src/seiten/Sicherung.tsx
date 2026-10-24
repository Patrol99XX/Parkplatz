import { useEffect, useState } from 'react'
import { useEinstellungen } from '../db/hooks'
import { dateiWeitergeben, sicherungEinlesen, sicherungErstellen, sicherungMerken } from '../db/sicherung'
import { formatDatumZeit } from '../logik/zeit'
import { sicherungFaellig } from '../logik/sicherung'
import { Hinweis, Kopf, mitFehlermeldung } from '../komponenten'

export function Sicherung() {
  const einstellungen = useEinstellungen()
  const [vorbereitet, setVorbereitet] = useState<{ datei: File; anzahlVorgaenge: number } | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [dauerhaft, setDauerhaft] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setDauerhaft, () => setDauerhaft(null))
  }, [])

  if (!einstellungen) return null
  const letzte = einstellungen.letzteSicherungAm

  // Zwei Schritte, weil Safari das Teilen-Menü nur direkt nach einem Tipp öffnet –
  // das Zusammenstellen der Datei kann bei vielen Fotos etwas dauern.
  async function vorbereiten() {
    setArbeitet(true)
    setMeldung('')
    setVorbereitet((await mitFehlermeldung(sicherungErstellen)) ?? null)
    setArbeitet(false)
  }

  async function weitergeben() {
    if (!vorbereitet) return
    const ok = await mitFehlermeldung(() => dateiWeitergeben(vorbereitet.datei))
    if (ok) {
      await sicherungMerken()
      setVorbereitet(null)
      setMeldung('Sicherung erstellt.')
    }
  }

  return (
    <>
      <Kopf titel="Datensicherung" />

      {meldung && <Hinweis>✓ {meldung}</Hinweis>}

      <section className="karte">
        <h2>Sichern</h2>
        <p>
          Letzte Sicherung: <strong>{letzte ? formatDatumZeit(letzte) : 'noch nie'}</strong>
        </p>
        {sicherungFaellig(letzte, new Date()) && (
          <Hinweis art="warnung">
            Alle Daten liegen nur auf diesem Gerät. Safari kann Website-Daten löschen, z. B. wenn
            der Speicher knapp wird. Bitte mindestens einmal pro Woche sichern und die Datei an
            einem sicheren Ort ablegen.
          </Hinweis>
        )}
        {vorbereitet ? (
          <>
            <p className="klein">
              {vorbereitet.datei.name} · {vorbereitet.anzahlVorgaenge} Vorgänge ·{' '}
              {(vorbereitet.datei.size / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB
            </p>
            <button type="button" className="knopf gross" onClick={weitergeben}>
              Datei speichern / teilen
            </button>
          </>
        ) : (
          <button type="button" className="knopf gross" disabled={arbeitet} onClick={vorbereiten}>
            {arbeitet ? 'Sicherung wird erstellt …' : 'Sicherung erstellen'}
          </button>
        )}
        <p className="klein">
          Die Datei enthält Kennzeichen und Fotos (personenbezogene Daten) – bitte nur dienstlich
          ablegen.
        </p>
      </section>

      <section className="karte">
        <h2>Wiederherstellen</h2>
        <p className="klein">
          Liest eine Sicherungsdatei ein. <strong>Alle Daten auf diesem Gerät werden dabei ersetzt.</strong>
        </p>
        <label className="knopf gross zweitrangig">
          Sicherungsdatei auswählen
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (ev) => {
              const datei = ev.target.files?.[0]
              ev.target.value = ''
              if (!datei) return
              if (!confirm(`„${datei.name}“ einlesen? Alle Daten auf diesem Gerät werden ersetzt.`)) return
              const anzahl = await mitFehlermeldung(() => sicherungEinlesen(datei))
              if (anzahl !== undefined) setMeldung(`Sicherung eingelesen: ${anzahl} Vorgänge.`)
            }}
          />
        </label>
      </section>

      {dauerhaft === false && (
        <p className="klein">
          Tipp: Als App zum Home-Bildschirm hinzugefügt (Teilen → „Zum Home-Bildschirm“) werden die
          Daten zuverlässiger aufbewahrt als im normalen Safari-Tab.
        </p>
      )}
    </>
  )
}
