import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, useEinstellungen } from '../db/hooks'
import { ERGEBNIS_TEXT, RUNDEN_TYP_TEXT, type SichtungsErgebnis } from '../db/typen'
import { formatDatum, formatZeit } from '../logik/zeit'
import { Kopf } from '../komponenten'

const REIHENFOLGE: SichtungsErgebnis[] = ['neu', 'noch_da', 'weg']

/** Ergebnis einer abgeschlossenen Kontrolle. Die Klärungsliste kommt in Stufe 2 hinzu. */
export function RundenErgebnis({ id }: { id: string }) {
  const einstellungen = useEinstellungen()
  const daten = useLiveQuery(async () => {
    const runde = await db.runden.get(id)
    const sichtungen = await db.sichtungen.where('rundeId').equals(id).toArray()
    const vorgaenge = await db.vorgaenge.bulkGet(sichtungen.map((s) => s.vorgangId))
    const zeilen = sichtungen.map((s, i) => ({ sichtung: s, vorgang: vorgaenge[i] }))
    return { runde, zeilen }
  }, [id])

  if (!einstellungen || !daten) return null
  const { runde, zeilen } = daten
  if (!runde) {
    return (
      <>
        <Kopf titel="Kontrolle" zurueck="rundgang" />
        <p className="leer">Diese Kontrolle existiert nicht.</p>
      </>
    )
  }

  return (
    <>
      <Kopf titel={RUNDEN_TYP_TEXT[runde.typ]} zurueck="rundgang" />
      <p className="klein" style={{ marginTop: -8 }}>
        {formatDatum(runde.gestartetAm)}, {formatZeit(runde.gestartetAm)}
        {runde.beendetAm ? `–${formatZeit(runde.beendetAm)}` : ' (läuft noch)'} · {runde.durchgefuehrtVon}
      </p>

      <div className="zahlen">
        {REIHENFOLGE.map((e) => (
          <div key={e}>
            <strong>{zeilen.filter((z) => z.sichtung.ergebnis === e).length}</strong>
            {ERGEBNIS_TEXT[e]}
          </div>
        ))}
      </div>

      {REIHENFOLGE.map((e) => {
        const liste = zeilen.filter((z) => z.sichtung.ergebnis === e && z.vorgang)
        if (liste.length === 0) return null
        return (
          <section className="karte" key={e}>
            <h2>{ERGEBNIS_TEXT[e]}</h2>
            <ul className="verlauf">
              {liste.map(({ sichtung, vorgang }) => (
                <li key={sichtung.id}>
                  <a href={`#/fahrzeug/${vorgang!.id}`} className="kennzeichen">
                    {vorgang!.kennzeichenAnzeige}
                  </a>
                  <span className="klein">{ebenenName(einstellungen, vorgang!.ebeneId)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <a className="knopf gross zweitrangig" href="#/">
        Zur Übersicht
      </a>
    </>
  )
}
