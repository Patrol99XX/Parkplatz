import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ortText, useEinstellungen } from '../db/hooks'
import { ERGEBNIS_TEXT, RUNDEN_TYP_TEXT, type SichtungsErgebnis } from '../db/typen'
import { formatDatum, formatZeit } from '../logik/zeit'
import { Kopf } from '../komponenten'
import { berichtErstellen, langeStehende, mailtoLink } from '../logik/bericht'

const REIHENFOLGE: SichtungsErgebnis[] = ['neu', 'noch_da', 'weg']

/** Ergebnis einer abgeschlossenen Kontrolle. Die Klärungsliste kommt in Stufe 2 hinzu. */
export function RundenErgebnis({ id }: { id: string }) {
  const einstellungen = useEinstellungen()
  const daten = useLiveQuery(async () => {
    const runde = await db.runden.get(id)
    const sichtungen = await db.sichtungen.where('rundeId').equals(id).toArray()
    const vorgaenge = await db.vorgaenge.bulkGet(sichtungen.map((s) => s.vorgangId))
    const zeilen = sichtungen.map((s, i) => ({ sichtung: s, vorgang: vorgaenge[i] }))
    // Für den Bericht: aktueller Stand aller Fahrzeuge auf dem Gelände
    const offene = await db.vorgaenge.filter((v) => v.offen).toArray()
    const gesehen = new Map<string, number>()
    await db.sichtungen
      .where('vorgangId')
      .anyOf(offene.map((v) => v.id))
      .each((s) => {
        if (s.ergebnis !== 'weg') gesehen.set(s.vorgangId, (gesehen.get(s.vorgangId) ?? 0) + 1)
      })
    return { runde, zeilen, offene, gesehen }
  }, [id])

  if (!einstellungen || !daten) return null
  const { runde, zeilen, offene, gesehen } = daten
  const empfaenger = einstellungen.berichtEmpfaenger ?? ''
  const anzahlLange = langeStehende(offene, new Date()).length

  // Erst beim Tippen erstellen, damit „Stand“ die aktuelle Uhrzeit zeigt.
  function berichtSenden() {
    if (!runde) return
    const zahlen = { neu: 0, noch_da: 0, weg: 0 }
    for (const z of zeilen) zahlen[z.sichtung.ergebnis]++
    const { betreff, text } = berichtErstellen({
      runde,
      zahlen,
      offene,
      gesehen,
      ebenen: einstellungen!.ebenen,
      jetzt: new Date(),
    })
    location.href = mailtoLink(empfaenger, betreff, text)
  }

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

      <section className="karte">
        <button type="button" className="knopf gross" onClick={berichtSenden}>
          ✉️ Bericht per E-Mail senden
        </button>
        <p className="klein" style={{ marginBottom: 0 }}>
          Aktueller Stand: {anzahlLange} {anzahlLange === 1 ? 'Fahrzeug steht' : 'Fahrzeuge stehen'} seit
          gestern oder länger.{' '}
          {empfaenger ? (
            <>An {empfaenger}.</>
          ) : (
            <>
              Noch kein Empfänger hinterlegt – <a href="#/einstellungen">in den Einstellungen eintragen</a>.
            </>
          )}
        </p>
      </section>

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
                  <span className="klein">{ortText(einstellungen, vorgang!)}</span>
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
