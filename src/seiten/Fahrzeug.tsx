import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, useEinstellungen, useModellVorschlaege } from '../db/hooks'
import { fotoHinzufuegen, fotoLoeschen, vorgangAendern, vorgangLoeschen } from '../db/aktionen'
import { ERGEBNIS_TEXT, KATEGORIE_TEXT, RUNDEN_TYP_TEXT, type Kategorie, type Vorgang } from '../db/typen'
import { pruefeKennzeichen } from '../logik/kennzeichen'
import { formatDatum, formatDatumZeit, standdauerText } from '../logik/zeit'
import { Auswahl, FotoAufnahme, FotoAusDb, FotoVollbild, Hinweis, Kopf, mitFehlermeldung } from '../komponenten'
import { geheZu } from '../navigation'

const KATEGORIEN: Kategorie[] = ['unbekannt', 'kunde', 'mitarbeiter', 'fremdparker']

export function Fahrzeug({ id }: { id: string }) {
  const einstellungen = useEinstellungen()
  const modelle = useModellVorschlaege()
  const [vollbild, setVollbild] = useState<string | null>(null)
  const [kzBearbeiten, setKzBearbeiten] = useState(false)

  const daten = useLiveQuery(async () => {
    const vorgang = await db.vorgaenge.get(id)
    if (!vorgang) return { vorgang: null }
    const sichtungen = await db.sichtungen.where('vorgangId').equals(id).toArray()
    const runden = await db.runden.bulkGet(sichtungen.map((s) => s.rundeId))
    const verlauf = sichtungen
      .map((s, i) => ({ sichtung: s, runde: runden[i] }))
      .sort((a, b) => b.sichtung.zeitpunkt.localeCompare(a.sichtung.zeitpunkt))
    const gleichesKz = await db.vorgaenge.where('kennzeichen').equals(vorgang.kennzeichen).toArray()
    const befund = pruefeKennzeichen(gleichesKz, new Date(vorgang.ersterfasstAm), vorgang.id)
    return { vorgang, verlauf, befund }
  }, [id])

  if (!einstellungen || !daten) return null
  if (!daten.vorgang) {
    return (
      <>
        <Kopf titel="Fahrzeug" zurueck="verlauf" />
        <p className="leer">Dieser Vorgang existiert nicht (mehr).</p>
      </>
    )
  }
  const { vorgang: v, verlauf, befund } = daten
  const aendern = (a: Parameters<typeof vorgangAendern>[1]) => mitFehlermeldung(() => vorgangAendern(v.id, a))
  const ebenen = einstellungen.ebenen.filter((e) => e.aktiv || e.id === v.ebeneId)

  return (
    <>
      <Kopf titel={v.kennzeichenAnzeige} zurueck="verlauf">
        <button type="button" className="knopf klein-knopf" onClick={() => setKzBearbeiten(!kzBearbeiten)}>
          {kzBearbeiten ? 'Fertig' : 'Ändern'}
        </button>
      </Kopf>

      {kzBearbeiten && (
        <label className="feld">
          <span>Kennzeichen korrigieren</span>
          <input
            className="kennzeichen"
            defaultValue={v.kennzeichenAnzeige}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onBlur={(e) => {
              if (e.target.value.trim() !== v.kennzeichenAnzeige) aendern({ kennzeichenAnzeige: e.target.value })
            }}
          />
        </label>
      )}

      <section className="karte">
        <p style={{ margin: 0 }}>
          <strong>{v.offen ? 'Auf dem Gelände' : 'Nicht mehr da'}</strong>
          <br />
          {v.offen
            ? `${standdauerText(v.ersterfasstAm, new Date())} · ${ebenenName(einstellungen, v.ebeneId)}`
            : `${formatDatumZeit(v.ersterfasstAm)} bis ${v.beendetAm ? formatDatumZeit(v.beendetAm) : '–'}`}
        </p>
      </section>

      {befund.vermutlichZurueck && (
        <Hinweis>Am selben Tag schon einmal erfasst und weg – vermutlich zurück aus der Werkstatt.</Hinweis>
      )}
      {befund.fruehere.length > 0 && (
        <Hinweis art="warnung">
          <p>
            <strong>Wiederholer:</strong> {befund.fruehere.length}{' '}
            {befund.fruehere.length === 1 ? 'früherer Aufenthalt' : 'frühere Aufenthalte'} in den 30 Tagen davor
          </p>
          {befund.fruehere.map((f: Vorgang) => (
            <p key={f.id}>
              <a href={`#/fahrzeug/${f.id}`}>
                {formatDatum(f.ersterfasstAm)}
                {f.beendetAm && ` – ${formatDatum(f.beendetAm)}`}
              </a>{' '}
              · {ebenenName(einstellungen, f.ebeneId)}
            </p>
          ))}
        </Hinweis>
      )}

      <section className="karte">
        <h2>Fotos</h2>
        {v.fotoIds.length > 0 && (
          <div className="fotos">
            {v.fotoIds.map((fid) => (
              <div className="foto" key={fid}>
                <FotoAusDb fotoId={fid} alt="Foto" onClick={() => setVollbild(fid)} />
                <button
                  type="button"
                  className="entfernen"
                  aria-label="Foto löschen"
                  onClick={() => confirm('Foto löschen?') && mitFehlermeldung(() => fotoLoeschen(v.id, fid))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <FotoAufnahme text="📷 Foto hinzufügen" beiFoto={(b) => mitFehlermeldung(() => fotoHinzufuegen(v.id, b))} />
      </section>

      <section className="karte">
        <label className="feld">
          <span>Modell</span>
          <input
            key={`modell-${v.modell}`}
            defaultValue={v.modell}
            list="modelle-detail"
            autoComplete="off"
            onBlur={(e) => e.target.value.trim() !== v.modell && aendern({ modell: e.target.value.trim() })}
          />
          <datalist id="modelle-detail">
            {modelle?.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>

        <label className="feld">
          <span>Ebene</span>
          <select value={v.ebeneId} onChange={(e) => aendern({ ebeneId: e.target.value })}>
            {ebenen.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <div className="feld">
          <span className="feld-titel">Kategorie</span>
          <Auswahl
            werte={KATEGORIEN}
            wert={v.kategorie}
            beiAuswahl={(k) => aendern({ kategorie: k })}
            text={(k) => KATEGORIE_TEXT[k]}
          />
        </div>

        <label className="feld">
          <span>Notiz</span>
          <textarea
            key={`notiz-${v.notiz}`}
            defaultValue={v.notiz}
            onBlur={(e) => e.target.value.trim() !== v.notiz && aendern({ notiz: e.target.value.trim() })}
          />
        </label>
      </section>

      <section className="karte">
        <h2>Kontrollen</h2>
        <ul className="verlauf">
          {verlauf.map(({ sichtung: s, runde: r }) => (
            <li key={s.id}>
              <span>
                {formatDatumZeit(s.zeitpunkt)}
                <br />
                <span className="klein">{r ? RUNDEN_TYP_TEXT[r.typ] : ''}</span>
              </span>
              <strong>{ERGEBNIS_TEXT[s.ergebnis]}</strong>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="knopf gefahr gross"
        onClick={async () => {
          if (!confirm(`${v.kennzeichenAnzeige} wirklich löschen? Nur für Fehleingaben – alle Fotos und Kontrollen dazu werden entfernt.`)) return
          await mitFehlermeldung(() => vorgangLoeschen(v.id))
          geheZu('')
        }}
      >
        Vorgang löschen (Fehleingabe)
      </button>

      {vollbild && <FotoVollbild fotoId={vollbild} schliessen={() => setVollbild(null)} />}
    </>
  )
}
