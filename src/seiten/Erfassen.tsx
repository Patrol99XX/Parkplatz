import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, useAktiveRunde, useEinstellungen, useModellVorschlaege } from '../db/hooks'
import { fahrzeugErfassen, sichtungSetzen, wegRueckgaengig } from '../db/aktionen'
import { KATEGORIE_TEXT, type Kategorie, type Runde } from '../db/typen'
import { normalisiereKennzeichen, pruefeKennzeichen } from '../logik/kennzeichen'
import { formatDatum, standdauerText } from '../logik/zeit'
import { Auswahl, BlobBild, FotoAufnahme, Hinweis, Kopf, mitFehlermeldung } from '../komponenten'
import { geheZu } from '../navigation'

const KATEGORIEN: Kategorie[] = ['unbekannt', 'kunde', 'mitarbeiter', 'fremdparker']

// Die zuletzt gewählte Ebene wird vorgeschlagen – beim Rundgang erfasst man meist
// mehrere Fahrzeuge auf derselben Ebene hintereinander.
function letzteEbeneLesen(): string | null {
  try {
    return localStorage.getItem('letzteEbene')
  } catch {
    return null
  }
}
function letzteEbeneMerken(id: string) {
  try {
    localStorage.setItem('letzteEbene', id)
  } catch {
    // nicht schlimm, dann wird nur nichts vorgeschlagen
  }
}

export function Erfassen() {
  const runde = useAktiveRunde()
  if (runde === undefined) return null
  if (runde === null) {
    return (
      <>
        <Kopf titel="Fahrzeug erfassen" zurueck="rundgang" />
        <Hinweis art="warnung">Fahrzeuge werden während einer Kontrolle erfasst. Bitte zuerst eine Kontrolle starten.</Hinweis>
        <a className="knopf gross" href="#/rundgang">
          Zum Rundgang
        </a>
      </>
    )
  }
  return <Formular runde={runde} />
}

function Formular({ runde }: { runde: Runde }) {
  const einstellungen = useEinstellungen()
  const modelle = useModellVorschlaege()

  const [kennzeichen, setKennzeichen] = useState('')
  const [modell, setModell] = useState('')
  const [ebeneId, setEbeneId] = useState<string | null>(letzteEbeneLesen)
  const [kategorie, setKategorie] = useState<Kategorie>('unbekannt')
  const [notiz, setNotiz] = useState('')
  const [fotos, setFotos] = useState<Blob[]>([])
  const [speichert, setSpeichert] = useState(false)
  const [meldung, setMeldung] = useState('')

  const norm = normalisiereKennzeichen(kennzeichen)

  // Bisherige Vorgänge zu diesem Kennzeichen – wird bei jeder Eingabe neu geprüft.
  const befund = useLiveQuery(async () => {
    if (norm.length < 2) return null
    const vorgaenge = await db.vorgaenge.where('kennzeichen').equals(norm).toArray()
    const b = pruefeKennzeichen(vorgaenge, new Date())
    const sichtung = b.offenerVorgang
      ? await db.sichtungen
          .where('rundeId')
          .equals(runde.id)
          .filter((s) => s.vorgangId === b.offenerVorgang!.id)
          .first()
      : undefined
    // In dieser Kontrolle versehentlich als „weg“ markiert? Dann lieber das rückgängig machen.
    const wegDieseRunde = b.offenerVorgang ? undefined : vorgaenge.find((v) => v.beendetInRundeId === runde.id)
    return { ...b, sichtungDieseRunde: sichtung, wegDieseRunde }
  }, [norm, runde.id])

  if (!einstellungen) return null
  const aktiveEbenen = einstellungen.ebenen.filter((e) => e.aktiv)
  const gueltigeEbene = aktiveEbenen.some((e) => e.id === ebeneId) ? ebeneId : null
  const offen = befund?.offenerVorgang ?? null
  const wegDieseRunde = befund?.wegDieseRunde
  const kannSpeichern = norm.length >= 2 && gueltigeEbene !== null && !offen && !wegDieseRunde && !speichert

  function zuruecksetzen(text: string) {
    setKennzeichen('')
    setModell('')
    setKategorie('unbekannt')
    setNotiz('')
    setFotos([])
    setMeldung(text)
    window.scrollTo(0, 0)
  }

  async function speichern(weiter: boolean) {
    if (!kannSpeichern || !gueltigeEbene) return
    setSpeichert(true)
    const v = await mitFehlermeldung(() =>
      fahrzeugErfassen(runde.id, {
        kennzeichenAnzeige: kennzeichen,
        modell,
        ebeneId: gueltigeEbene,
        kategorie,
        notiz,
        fotos,
      }),
    )
    setSpeichert(false)
    if (!v) return
    letzteEbeneMerken(gueltigeEbene)
    if (weiter) zuruecksetzen(`${v.kennzeichenAnzeige} gespeichert.`)
    else geheZu('rundgang')
  }

  async function nochDaBestaetigen() {
    if (!offen) return
    await mitFehlermeldung(() => sichtungSetzen(runde.id, offen.id, 'noch_da'))
    zuruecksetzen(`${offen.kennzeichenAnzeige} als „noch da“ bestätigt.`)
  }

  return (
    <>
      <Kopf titel="Fahrzeug erfassen" zurueck="rundgang" />
      {meldung && <Hinweis>✓ {meldung}</Hinweis>}

      <label className="feld">
        <span>Kennzeichen</span>
        <input
          className="kennzeichen"
          value={kennzeichen}
          onChange={(e) => {
            setKennzeichen(e.target.value)
            setMeldung('')
          }}
          placeholder="z. B. HH-AB 123"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      </label>

      {offen && (
        <Hinweis art="warnung">
          <p>
            <strong>Bereits erfasst</strong> {standdauerText(offen.ersterfasstAm, new Date())} auf{' '}
            {ebenenName(einstellungen, offen.ebeneId)}. Es wird kein neuer Vorgang angelegt.
          </p>
          {befund?.sichtungDieseRunde && befund.sichtungDieseRunde.ergebnis !== 'weg' ? (
            <p>In dieser Kontrolle schon als vorhanden markiert.</p>
          ) : (
            <button type="button" className="knopf gross" onClick={nochDaBestaetigen}>
              Als „noch da“ bestätigen
            </button>
          )}
          <p>
            <a href={`#/fahrzeug/${offen.id}`}>Fahrzeug ansehen</a>
          </p>
        </Hinweis>
      )}
      {wegDieseRunde && (
        <Hinweis art="warnung">
          <p>In dieser Kontrolle schon als „weg“ markiert.</p>
          <button
            type="button"
            className="knopf gross"
            onClick={async () => {
              await mitFehlermeldung(() => wegRueckgaengig(runde.id, wegDieseRunde.id))
              zuruecksetzen(`${wegDieseRunde.kennzeichenAnzeige}: „weg“ zurückgenommen.`)
            }}
          >
            Doch noch da
          </button>
        </Hinweis>
      )}
      {!offen && !wegDieseRunde && befund?.vermutlichZurueck && (
        <Hinweis>Heute schon einmal erfasst und als „weg“ gemeldet – vermutlich zurück aus der Werkstatt.</Hinweis>
      )}
      {!offen && !wegDieseRunde && befund && befund.fruehere.length > 0 && (
        <Hinweis art="warnung">
          <strong>Wiederholer:</strong> {befund.fruehere.length}{' '}
          {befund.fruehere.length === 1 ? 'Aufenthalt' : 'Aufenthalte'} in den letzten 30 Tagen (
          {befund.fruehere.map((v) => formatDatum(v.ersterfasstAm)).join(', ')})
        </Hinweis>
      )}

      {!offen && !wegDieseRunde && (
        <>
          <label className="feld">
            <span>Modell</span>
            <input
              value={modell}
              onChange={(e) => setModell(e.target.value)}
              list="modelle"
              placeholder="z. B. Golf, weiß"
              autoComplete="off"
            />
            <datalist id="modelle">
              {modelle?.map((m) => <option key={m} value={m} />)}
            </datalist>
          </label>

          <div className="feld">
            <span className="feld-titel">Ebene</span>
            <Auswahl
              werte={aktiveEbenen.map((e) => e.id)}
              wert={gueltigeEbene}
              beiAuswahl={setEbeneId}
              text={(id) => ebenenName(einstellungen, id)}
            />
          </div>

          <div className="feld">
            <span className="feld-titel">Kategorie</span>
            <Auswahl werte={KATEGORIEN} wert={kategorie} beiAuswahl={setKategorie} text={(k) => KATEGORIE_TEXT[k]} />
          </div>

          <div className="feld">
            <span className="feld-titel">Fotos (optional)</span>
            {fotos.length > 0 && (
              <div className="fotos">
                {fotos.map((f, i) => (
                  <div className="foto" key={i}>
                    <BlobBild blob={f} alt={`Foto ${i + 1}`} />
                    <button
                      type="button"
                      className="entfernen"
                      aria-label="Foto entfernen"
                      onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FotoAufnahme beiFoto={(b) => setFotos((alt) => [...alt, b])} />
          </div>

          <label className="feld">
            <span>Notiz (optional)</span>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} />
          </label>

          <div className="knopf-reihe">
            <button type="button" className="knopf gross" disabled={!kannSpeichern} onClick={() => speichern(true)}>
              Speichern + nächstes
            </button>
            <button
              type="button"
              className="knopf gross zweitrangig"
              disabled={!kannSpeichern}
              onClick={() => speichern(false)}
            >
              Speichern
            </button>
          </div>
          {gueltigeEbene === null && norm.length >= 2 && <p className="klein">Bitte eine Ebene wählen.</p>}
        </>
      )}
    </>
  )
}
