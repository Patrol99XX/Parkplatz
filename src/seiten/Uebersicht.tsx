import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, platzVon, useAktiveRunde, useEinstellungen } from '../db/hooks'
import { KATEGORIE_TEXT, RUNDEN_TYP_TEXT, type Vorgang } from '../db/typen'
import { formatDatum, formatZeit, standdauerText } from '../logik/zeit'
import { sicherungFaellig } from '../logik/sicherung'
import { nachPlatz } from '../logik/stellplatz'
import { FotoAusDb, Hinweis, Kopf } from '../komponenten'

export function Uebersicht() {
  const einstellungen = useEinstellungen()
  const runde = useAktiveRunde()
  const daten = useLiveQuery(async () => {
    const vorgaenge = await db.vorgaenge.filter((v) => v.offen).toArray()
    vorgaenge.sort(nachPlatz) // je Ebene nach Stellplatz, ohne Platz nach Erfassungszeit
    // Wie oft wurde jedes Fahrzeug bei Kontrollen gesehen?
    const sichtungen = await db.sichtungen.where('vorgangId').anyOf(vorgaenge.map((v) => v.id)).toArray()
    const gesehen = new Map<string, number>()
    for (const s of sichtungen) if (s.ergebnis !== 'weg') gesehen.set(s.vorgangId, (gesehen.get(s.vorgangId) ?? 0) + 1)
    const gesamt = await db.vorgaenge.count()
    return { vorgaenge, gesehen, gesamt }
  })

  if (!einstellungen || !daten || runde === undefined) return null
  const { vorgaenge, gesehen } = daten
  const jetzt = new Date()

  const ids = einstellungen.ebenen.map((e) => e.id)
  for (const v of vorgaenge) if (!ids.includes(v.ebeneId)) ids.push(v.ebeneId)
  const gruppen = ids
    .map((id) => ({ id, vorgaenge: vorgaenge.filter((v) => v.ebeneId === id) }))
    .filter((g) => g.vorgaenge.length > 0 || einstellungen.ebenen.find((e) => e.id === g.id)?.aktiv)

  return (
    <>
      <Kopf titel="Übersicht" />

      {daten.gesamt > 0 && sicherungFaellig(einstellungen.letzteSicherungAm, jetzt) && (
        <Hinweis art="warnung">
          <p>
            {einstellungen.letzteSicherungAm
              ? `Letzte Sicherung am ${formatDatum(einstellungen.letzteSicherungAm)}.`
              : 'Es gibt noch keine Sicherung.'}{' '}
            Safari kann Website-Daten löschen – bitte regelmäßig sichern.
          </p>
          <p>
            <a href="#/sicherung">Jetzt sichern</a>
          </p>
        </Hinweis>
      )}

      {runde ? (
        <a className="knopf gross" href="#/rundgang">
          {RUNDEN_TYP_TEXT[runde.typ]} läuft seit {formatZeit(runde.gestartetAm)} – fortsetzen
        </a>
      ) : (
        <a className="knopf gross" href="#/rundgang">
          Kontrolle starten
        </a>
      )}

      <p>
        <strong>{vorgaenge.length}</strong> {vorgaenge.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'} auf dem Gelände
      </p>

      {gruppen.map((g) => (
        <section key={g.id}>
          <h2 className="gruppe-titel">
            {ebenenName(einstellungen, g.id)} <span className="anzahl">{g.vorgaenge.length}</span>
          </h2>
          {g.vorgaenge.length === 0 && <p className="leer">frei</p>}
          <div className="raster">
            {g.vorgaenge.map((v) => (
              <FahrzeugZeile
                key={v.id}
                vorgang={v}
                platz={platzVon(einstellungen, v)}
                gesehen={gesehen.get(v.id) ?? 0}
                jetzt={jetzt}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function FahrzeugZeile({
  vorgang: v,
  platz,
  gesehen,
  jetzt,
}: {
  vorgang: Vorgang
  platz: string | null
  gesehen: number
  jetzt: Date
}) {
  return (
    <a className="fahrzeug" href={`#/fahrzeug/${v.id}`}>
      <div className="vorschau">{v.fotoIds[0] && <FotoAusDb fotoId={v.fotoIds[0]} alt="" />}</div>
      <div className="angaben">
        <div>
          <span className="kennzeichen">{v.kennzeichenAnzeige}</span>
          {v.kategorie !== 'unbekannt' && <span className="marke">{KATEGORIE_TEXT[v.kategorie]}</span>}
        </div>
        {(platz || v.modell) && (
          <div className="unterzeile">
            {platz && <span className="platz-marke">Platz {platz}</span>}
            {platz && v.modell && ' · '}
            {v.modell}
          </div>
        )}
        <div className="unterzeile">
          {standdauerText(v.ersterfasstAm, jetzt)} · {gesehen}× gesehen
        </div>
      </div>
    </a>
  )
}
