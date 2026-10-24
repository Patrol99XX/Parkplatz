import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useEinstellungen } from '../db/hooks'
import {
  alleDatenLoeschen,
  dateiWeitergeben,
  sicherungEinlesen,
  sicherungErstellen,
  sicherungMerken,
} from '../db/sicherung'
import { formatDatumZeit } from '../logik/zeit'
import { sicherungFaellig } from '../logik/sicherung'
import { Hinweis, Kopf, mitFehlermeldung } from '../komponenten'

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`

export function Sicherung() {
  const einstellungen = useEinstellungen()
  const [vorbereitet, setVorbereitet] = useState<{ datei: File; anzahlVorgaenge: number } | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [dauerhaft, setDauerhaft] = useState<boolean | null>(null)
  const bestand = useLiveQuery(async () => ({
    runden: await db.runden.count(),
    vorgaenge: await db.vorgaenge.count(),
    fotos: await db.fotos.count(),
  }))

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

      <section className="karte">
        <h2>Alle Daten löschen</h2>
        <p className="klein">
          Zum Beispiel, um nach dem Ausprobieren mit leerer App zu starten. Gelöscht werden alle
          Kontrollen, Fahrzeuge und Fotos
          {bestand &&
            ` (zurzeit ${anzahl(bestand.runden, 'Kontrolle', 'Kontrollen')}, ${anzahl(bestand.vorgaenge, 'Fahrzeug', 'Fahrzeuge')}, ${anzahl(bestand.fotos, 'Foto', 'Fotos')})`}.
          Ebenen und E-Mail-Empfänger bleiben erhalten.
        </p>
        <button
          type="button"
          className="knopf gross gefahr"
          disabled={!bestand || bestand.runden + bestand.vorgaenge === 0}
          onClick={async () => {
            // Zwei Rückfragen, weil sich das nicht rückgängig machen lässt
            if (!confirm('Wirklich ALLE Kontrollen, Fahrzeuge und Fotos löschen?')) return
            if (!confirm('Letzte Rückfrage: Das lässt sich nicht rückgängig machen (außer über eine Sicherungsdatei). Jetzt löschen?')) return
            await mitFehlermeldung(alleDatenLoeschen)
            setVorbereitet(null)
            setMeldung('Alle Daten gelöscht. Die App ist wieder leer.')
            window.scrollTo(0, 0)
          }}
        >
          Alle Daten löschen
        </button>
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
