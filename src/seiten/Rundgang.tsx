import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, useAktiveRunde, useEinstellungen } from '../db/hooks'
import { rundeAbschliessen, rundeStarten, rundeVerwerfen, sichtungSetzen, vorgangAendern, wegRueckgaengig } from '../db/aktionen'
import { RUNDEN_TYP_TEXT, type Einstellungen, type Runde, type RundenTyp, type Sichtung, type Vorgang } from '../db/typen'
import { formatZeit, standdauerText, vorgeschlagenerRundenTyp } from '../logik/zeit'
import { Auswahl, FotoAusDb, Hinweis, Kopf, mitFehlermeldung } from '../komponenten'
import { geheZu } from '../navigation'

export function Rundgang({ abschluss }: { abschluss: boolean }) {
  const runde = useAktiveRunde()
  const einstellungen = useEinstellungen()
  if (runde === undefined || !einstellungen) return null
  if (runde === null) return <Starten einstellungen={einstellungen} />
  return abschluss ? (
    <Abschluss runde={runde} einstellungen={einstellungen} />
  ) : (
    <Laufend runde={runde} einstellungen={einstellungen} />
  )
}

// ---------- Kontrolle starten ----------

const TYPEN: RundenTyp[] = ['morgens', 'nachmittags', 'sonder']

function Starten({ einstellungen }: { einstellungen: Einstellungen }) {
  const [typ, setTyp] = useState<RundenTyp>(() => vorgeschlagenerRundenTyp(new Date()))
  const [name, setName] = useState(einstellungen.letzterKontrolleur)
  const letzte = useLiveQuery(() => db.runden.orderBy('gestartetAm').reverse().limit(5).toArray())

  return (
    <>
      <Kopf titel="Kontrolle starten" />
      <section className="karte">
        <div className="feld">
          <span className="feld-titel">Art der Kontrolle</span>
          <Auswahl werte={TYPEN} wert={typ} beiAuswahl={setTyp} text={(t) => RUNDEN_TYP_TEXT[t]} />
        </div>
        <label className="feld">
          <span>Durchgeführt von</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="off" />
        </label>
        <button
          type="button"
          className="knopf gross"
          disabled={!name.trim()}
          onClick={() => mitFehlermeldung(() => rundeStarten(typ, name))}
        >
          Kontrolle starten
        </button>
      </section>

      {letzte && letzte.length > 0 && (
        <section className="karte">
          <h2>Letzte Kontrollen</h2>
          <ul className="verlauf">
            {letzte.map((r) => (
              <li key={r.id}>
                <a href={`#/runde/${r.id}`}>{RUNDEN_TYP_TEXT[r.typ]}</a>
                <span>
                  {new Date(r.gestartetAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })},{' '}
                  {formatZeit(r.gestartetAm)} · {r.durchgefuehrtVon}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ---------- Laufende Kontrolle ----------

/** Alle Fahrzeuge der Runde: offene plus die, die in dieser Runde schon als „weg“ markiert wurden. */
function useRundenDaten(runde: Runde) {
  return useLiveQuery(async () => {
    const sichtungen = await db.sichtungen.where('rundeId').equals(runde.id).toArray()
    const proVorgang = new Map(sichtungen.map((s) => [s.vorgangId, s]))
    const vorgaenge = await db.vorgaenge.filter((v) => v.offen || proVorgang.has(v.id)).toArray()
    vorgaenge.sort((a, b) => a.ersterfasstAm.localeCompare(b.ersterfasstAm))
    return { vorgaenge, proVorgang }
  }, [runde.id])
}

/** Nach Ebenen gruppiert, in der Reihenfolge der Einstellungen; unbekannte Ebenen am Ende. */
function nachEbene(vorgaenge: Vorgang[], einstellungen: Einstellungen) {
  const ids = einstellungen.ebenen.map((e) => e.id)
  for (const v of vorgaenge) if (!ids.includes(v.ebeneId)) ids.push(v.ebeneId)
  return ids
    .map((id) => ({ id, name: ebenenName(einstellungen, id), vorgaenge: vorgaenge.filter((v) => v.ebeneId === id) }))
    .filter((g) => g.vorgaenge.length > 0)
}

function Laufend({ runde, einstellungen }: { runde: Runde; einstellungen: Einstellungen }) {
  const daten = useRundenDaten(runde)
  const [nurOffene, setNurOffene] = useState(false)
  if (!daten) return null

  const { vorgaenge, proVorgang } = daten
  const unentschieden = vorgaenge.filter((v) => !proVorgang.has(v.id))
  const sichtbar = nurOffene ? unentschieden : vorgaenge
  const gruppen = nachEbene(sichtbar, einstellungen)

  return (
    <div className="mit-fusszeile">
      <Kopf titel={RUNDEN_TYP_TEXT[runde.typ]} />
      <p className="klein" style={{ marginTop: -8 }}>
        seit {formatZeit(runde.gestartetAm)} · {runde.durchgefuehrtVon}
      </p>

      <a className="knopf gross" href="#/erfassen">
        ＋ Neues Fahrzeug erfassen
      </a>

      <div className="knopf-reihe" style={{ marginTop: 12 }}>
        <Auswahl
          werte={['alle', 'offen'] as const}
          wert={nurOffene ? 'offen' : 'alle'}
          beiAuswahl={(w) => setNurOffene(w === 'offen')}
          text={(w) => (w === 'alle' ? `Alle (${vorgaenge.length})` : `Noch offen (${unentschieden.length})`)}
        />
      </div>

      {gruppen.length === 0 && (
        <p className="leer">
          {nurOffene ? 'Alle Fahrzeuge sind entschieden.' : 'Noch keine Fahrzeuge erfasst.'}
        </p>
      )}

      {gruppen.map((g) => (
        <section key={g.id}>
          <h2 className="gruppe-titel">
            {g.name} <span className="anzahl">{g.vorgaenge.length}</span>
          </h2>
          <div className="raster">
            {g.vorgaenge.map((v) => (
              <RundenFahrzeug
                key={v.id}
                vorgang={v}
                sichtung={proVorgang.get(v.id)}
                runde={runde}
                einstellungen={einstellungen}
              />
            ))}
          </div>
        </section>
      ))}

      {proVorgang.size === 0 && (
        <button
          type="button"
          className="text-knopf"
          onClick={() => {
            if (confirm('Diese Kontrolle verwerfen? Es wurde noch nichts erfasst.')) {
              mitFehlermeldung(() => rundeVerwerfen(runde.id))
            }
          }}
        >
          Kontrolle verwerfen (versehentlich gestartet)
        </button>
      )}

      <div className="fusszeile">
        <button type="button" className="knopf gross" onClick={() => geheZu('rundgang/abschluss')}>
          {unentschieden.length > 0 ? `Abschließen (${unentschieden.length} offen)` : 'Kontrolle abschließen'}
        </button>
      </div>
    </div>
  )
}

function RundenFahrzeug({
  vorgang: v,
  sichtung,
  runde,
  einstellungen,
}: {
  vorgang: Vorgang
  sichtung: Sichtung | undefined
  runde: Runde
  einstellungen: Einstellungen
}) {
  const [ebeneAendern, setEbeneAendern] = useState(false)
  const ergebnis = sichtung?.ergebnis
  const aktiveEbenen = einstellungen.ebenen.filter((e) => e.aktiv || e.id === v.ebeneId)

  return (
    <div className={`rund-fahrzeug ${ergebnis ?? ''}`}>
      <a className="kopfteil" href={`#/fahrzeug/${v.id}`}>
        <div className="fahrzeug-vorschau-klein">
          {v.fotoIds[0] ? <FotoAusDb fotoId={v.fotoIds[0]} alt="" /> : null}
        </div>
        <div className="angaben">
          <div>
            <span className="kennzeichen">{v.kennzeichenAnzeige}</span>
            {ergebnis === 'neu' && <span className="marke neu">neu</span>}
          </div>
          <div className="unterzeile">
            {[v.modell, standdauerText(v.ersterfasstAm, new Date())].filter(Boolean).join(' · ')}
          </div>
        </div>
      </a>
      {ergebnis !== 'neu' && (
        <div className="entscheidung">
          <button
            type="button"
            className={`da ${ergebnis === 'noch_da' ? 'gewaehlt' : ''}`}
            onClick={() => mitFehlermeldung(() => sichtungSetzen(runde.id, v.id, 'noch_da'))}
          >
            ✓ noch da
          </button>
          <button
            type="button"
            className={`weg ${ergebnis === 'weg' ? 'gewaehlt' : ''}`}
            onClick={() => mitFehlermeldung(() => sichtungSetzen(runde.id, v.id, 'weg'))}
          >
            weg
          </button>
        </div>
      )}
      {ergebnis !== 'weg' &&
        (ebeneAendern ? (
          <select
            className="ebene-wechsel"
            value={v.ebeneId}
            aria-label="Ebene"
            onChange={async (e) => {
              await mitFehlermeldung(() => vorgangAendern(v.id, { ebeneId: e.target.value }))
              setEbeneAendern(false)
            }}
          >
            {aktiveEbenen.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ) : (
          <button type="button" className="text-knopf" onClick={() => setEbeneAendern(true)}>
            Steht woanders? Ebene ändern
          </button>
        ))}
    </div>
  )
}

// ---------- Abschluss ----------

function Abschluss({ runde, einstellungen }: { runde: Runde; einstellungen: Einstellungen }) {
  const daten = useRundenDaten(runde)
  if (!daten) return null
  const { vorgaenge, proVorgang } = daten
  const unentschieden = vorgaenge.filter((v) => !proVorgang.has(v.id))
  const mit = (e: string) => vorgaenge.filter((v) => proVorgang.get(v.id)?.ergebnis === e)
  const neu = mit('neu')
  const nochDa = mit('noch_da')
  const weg = mit('weg')

  if (unentschieden.length > 0) {
    return (
      <>
        <Kopf titel="Kontrolle abschließen" zurueck="rundgang" />
        <Hinweis art="warnung">
          Noch {unentschieden.length} {unentschieden.length === 1 ? 'Fahrzeug ist' : 'Fahrzeuge sind'} nicht entschieden.
          Bitte für jedes „noch da“ oder „weg“ wählen.
        </Hinweis>
        {nachEbene(unentschieden, einstellungen).map((g) => (
          <section key={g.id}>
            <h2 className="gruppe-titel">{g.name}</h2>
            {g.vorgaenge.map((v) => (
              <RundenFahrzeug key={v.id} vorgang={v} sichtung={undefined} runde={runde} einstellungen={einstellungen} />
            ))}
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="mit-fusszeile">
      <Kopf titel="Kontrolle abschließen" zurueck="rundgang" />
      <div className="zahlen">
        <div>
          <strong>{neu.length}</strong>neu
        </div>
        <div>
          <strong>{nochDa.length}</strong>noch da
        </div>
        <div>
          <strong>{weg.length}</strong>weg
        </div>
      </div>

      {weg.length > 0 && (
        <section className="karte">
          <h2>Als „weg“ markiert</h2>
          <p className="klein">Bitte kurz prüfen. Ein Irrtum lässt sich hier noch zurücknehmen.</p>
          <ul className="verlauf">
            {weg.map((v) => (
              <li key={v.id}>
                <span>
                  <span className="kennzeichen">{v.kennzeichenAnzeige}</span>
                  <br />
                  <span className="klein">{ebenenName(einstellungen, v.ebeneId)}</span>
                </span>
                <button
                  type="button"
                  className="knopf klein-knopf"
                  onClick={() => mitFehlermeldung(() => wegRueckgaengig(runde.id, v.id))}
                >
                  Doch noch da
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fusszeile">
        <button
          type="button"
          className="knopf gross"
          onClick={async () => {
            const ok = await mitFehlermeldung(async () => {
              await rundeAbschliessen(runde.id)
              return true
            })
            if (ok) geheZu(`runde/${runde.id}`)
          }}
        >
          Kontrolle jetzt abschließen
        </button>
      </div>
    </div>
  )
}
