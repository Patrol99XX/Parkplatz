import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ebenenName, useAktiveRunde, useEinstellungen, useModellVorschlaege } from '../db/hooks'
import { fahrzeugErfassen, sichtungSetzen, vorgangAendern, wegRueckgaengig } from '../db/aktionen'
import { KATEGORIE_TEXT, type Kategorie, type Runde, type Vorgang } from '../db/typen'
import { istOhneKennzeichen, kennzeichenVorschlaege, normalisiereKennzeichen, pruefeKennzeichen } from '../logik/kennzeichen'
import { formatDatum, standdauerText } from '../logik/zeit'
import { naechsterPlatz, platzEinlesen, platzText } from '../logik/stellplatz'
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

/** vorschlag: Kennzeichen aus der Suche im Rundgang („nicht gefunden → neu erfassen“) */
export function Erfassen({ vorschlag = '' }: { vorschlag?: string }) {
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
  return <Formular runde={runde} vorschlag={vorschlag} />
}

function Formular({ runde, vorschlag }: { runde: Runde; vorschlag: string }) {
  const einstellungen = useEinstellungen()
  const modelle = useModellVorschlaege()

  const [kennzeichen, setKennzeichen] = useState(vorschlag)
  const kennzeichenFeld = useRef<HTMLInputElement>(null)
  const [modell, setModell] = useState('')
  const [ebeneId, setEbeneId] = useState<string | null>(letzteEbeneLesen)
  const [platz, setPlatz] = useState('')
  const [kategorie, setKategorie] = useState<Kategorie>('unbekannt')
  const [notiz, setNotiz] = useState('')
  const [fotos, setFotos] = useState<Blob[]>([])
  const [speichert, setSpeichert] = useState(false)
  const [meldung, setMeldung] = useState('')
  // Return wurde gedrückt, während nur Vorschläge (kein exakter Treffer) passten
  const [returnGesperrt, setReturnGesperrt] = useState(false)
  const kamera = useRef<HTMLInputElement>(null)
  // Bei „OHNE“ ohne Foto öffnet Speichern zuerst die Kamera; danach wird automatisch gespeichert.
  // Hier steht, ob danach „weiter“ (nächstes Fahrzeug) oder zurück zum Rundgang.
  const nachFotoSpeichern = useRef<boolean | null>(null)

  const norm = normalisiereKennzeichen(kennzeichen)
  const ohne = istOhneKennzeichen(kennzeichen)

  // Bisherige Vorgänge zu diesem Kennzeichen – wird bei jeder Eingabe neu geprüft.
  const befund = useLiveQuery(async () => {
    if (norm.length < 2 || istOhneKennzeichen(norm)) return null
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

  // Offene Fahrzeuge, die zum Getippten passen – noch nicht bestätigte zuerst
  const vorschlaege = useLiveQuery(async () => {
    const treffer = kennzeichenVorschlaege(await db.vorgaenge.filter((v) => v.offen).toArray(), norm)
    if (treffer.length === 0) return []
    const gesehen = new Set(
      (await db.sichtungen.where('rundeId').equals(runde.id).toArray())
        .filter((s) => s.ergebnis !== 'weg')
        .map((s) => s.vorgangId),
    )
    return treffer
      .map((v) => ({ v, schonDa: gesehen.has(v.id) }))
      .sort((a, b) => Number(a.schonDa) - Number(b.schonDa))
      .slice(0, 6)
  }, [norm, runde.id])

  const aktiveEbenen = einstellungen?.ebenen.filter((e) => e.aktiv) ?? []
  const gueltigeEbene = aktiveEbenen.some((e) => e.id === ebeneId) ? ebeneId : null
  const bereich = aktiveEbenen.find((e) => e.id === gueltigeEbene)?.stellplaetze ?? null
  const platzEingabe = bereich ? platzEinlesen(platz, bereich) : { nr: null }
  const platzNr = 'nr' in platzEingabe ? platzEingabe.nr : null

  // Steht laut App schon ein anderes Fahrzeug auf diesem Platz? Dann ist es vermutlich weg.
  const belegtVon = useLiveQuery(async () => {
    if (!gueltigeEbene || platzNr === null) return null
    return (
      (await db.vorgaenge
        .filter((v) => v.offen && v.ebeneId === gueltigeEbene && v.stellplatz === platzNr && (istOhneKennzeichen(norm) || v.kennzeichen !== norm))
        .first()) ?? null
    )
  }, [gueltigeEbene, platzNr, norm])

  if (!einstellungen) return null
  const offen = befund?.offenerVorgang ?? null
  const wegDieseRunde = befund?.wegDieseRunde
  const kannSpeichern = norm.length >= 2 && gueltigeEbene !== null && !offen && !wegDieseRunde && !speichert

  function zuruecksetzen(text: string) {
    setKennzeichen('')
    setModell('')
    setKategorie('unbekannt')
    setNotiz('')
    setFotos([])
    setReturnGesperrt(false)
    setMeldung(text)
    window.scrollTo(0, 0)
    kennzeichenFeld.current?.focus()
  }

  /** Platz-Eingabe prüfen; bei Fehler Meldung und undefined */
  function platzPruefen(): number | null | undefined {
    if ('fehler' in platzEingabe) {
      alert(platzEingabe.fehler)
      return undefined
    }
    return platzEingabe.nr
  }

  /** Nach dem Speichern: nächsten Platz vorschlagen (falls eingestellt), sonst Feld leeren */
  function platzWeiter(nr: number | null) {
    const weiter = nr !== null && bereich && einstellungen!.platzHochzaehlen !== false ? naechsterPlatz(nr, bereich) : null
    setPlatz(weiter !== null ? String(weiter) : '')
  }

  /**
   * „OHNE“ und noch kein Foto → Kamera öffnen statt speichern. Muss SOFORT im Tipp bzw. bei
   * Return passieren (vor jedem „await“), sonst lässt Safari die Kamera nicht aufgehen.
   */
  function kameraStattSpeichern(weiter: boolean): boolean {
    if (!ohne || fotos.length > 0) return false
    if (!gueltigeEbene) {
      alert('Bitte zuerst eine Ebene wählen.')
      return true
    }
    if (platzPruefen() === undefined) return true
    nachFotoSpeichern.current = weiter
    kamera.current?.click()
    return true
  }

  function fotoErhalten(b: Blob) {
    const neu = [...fotos, b]
    setFotos(neu)
    const weiter = nachFotoSpeichern.current
    nachFotoSpeichern.current = null
    if (weiter !== null) speichern(weiter, true, neu)
  }

  /**
   * schonGeprueft: Aufruf aus beiReturn, das die Kennzeichen-Prüfung schon frisch gemacht hat
   * fotosJetzt: direkt nach der Aufnahme, bevor React den neuen Zustand kennt
   */
  async function speichern(weiter: boolean, schonGeprueft = false, fotosJetzt = fotos) {
    if (!gueltigeEbene || speichert) return
    if (!schonGeprueft && !kannSpeichern) return
    const nr = platzPruefen()
    if (nr === undefined) return
    setSpeichert(true)
    const v = await mitFehlermeldung(() =>
      fahrzeugErfassen(runde.id, {
        kennzeichenAnzeige: kennzeichen,
        modell,
        ebeneId: gueltigeEbene,
        stellplatz: nr,
        kategorie,
        notiz,
        fotos: fotosJetzt,
      }),
    )
    setSpeichert(false)
    if (!v) return
    letzteEbeneMerken(gueltigeEbene)
    platzWeiter(nr)
    const wo = nr !== null && bereich ? ` auf ${platzText(bereich, nr)}` : ''
    if (weiter) zuruecksetzen(`${v.kennzeichenAnzeige}${wo} gespeichert.`)
    else geheZu('rundgang')
  }

  /**
   * Return-Taste im Kennzeichen-Feld = Schnell-Erfassung: neues Fahrzeug speichern bzw.
   * bekanntes als „noch da“ bestätigen. Die Prüfung läuft hier frisch gegen die Datenbank,
   * weil die Hinweise oben beim schnellen Tippen noch den alten Stand zeigen können.
   */
  async function beiReturn() {
    if (norm.length < 2 || speichert) return
    if (ohne) {
      // kein Abgleich – jedes Fahrzeug ohne Kennzeichen ist ein eigenes (Foto ist schon da)
      await speichern(true, true)
      return
    }
    const vorgaenge = await db.vorgaenge.where('kennzeichen').equals(norm).toArray()
    const offenJetzt = vorgaenge.find((v) => v.offen)
    if (offenJetzt) {
      await bekanntBestaetigen(offenJetzt)
      return
    }
    // In dieser Kontrolle als „weg“ markiert → Hinweis mit „Doch noch da“ steht oben, nichts automatisch tun
    if (vorgaenge.some((v) => v.beendetInRundeId === runde.id)) return
    // Passen nur Teile bekannter Kennzeichen („123“), ist es vermutlich eines davon und kein neues
    // Fahrzeug. Return legt dann nichts an; Vorschlag antippen oder bewusst „Speichern“.
    if (kennzeichenVorschlaege(await db.vorgaenge.filter((v) => v.offen).toArray(), norm).length > 0) {
      setReturnGesperrt(true)
      return
    }
    if (!gueltigeEbene) {
      alert('Bitte zuerst eine Ebene wählen.')
      return
    }
    await speichern(true, true)
  }

  /** Bekanntes offenes Fahrzeug als „noch da“ bestätigen (Return oder Vorschlag angetippt) */
  async function bekanntBestaetigen(v: Vorgang) {
    // Platz angegeben (z. B. beim Nachtragen der Nummern)? Dann steht das Fahrzeug genau hier.
    const nr = platzPruefen()
    if (nr === undefined) return
    if (nr !== null && gueltigeEbene && (v.stellplatz !== nr || v.ebeneId !== gueltigeEbene)) {
      await mitFehlermeldung(() => vorgangAendern(v.id, { ebeneId: gueltigeEbene, stellplatz: nr }))
    }
    platzWeiter(nr)
    const s = await db.sichtungen
      .where('rundeId')
      .equals(runde.id)
      .filter((x) => x.vorgangId === v.id)
      .first()
    if (s && s.ergebnis !== 'weg') {
      zuruecksetzen(`${v.kennzeichenAnzeige} war in dieser Kontrolle schon erfasst.`)
      return
    }
    await mitFehlermeldung(() => sichtungSetzen(runde.id, v.id, 'noch_da'))
    zuruecksetzen(`${v.kennzeichenAnzeige} als „noch da“ bestätigt.`)
  }

  /** „Ebene 0 · 0.05“ für die Vorschlagsliste */
  function ortText(v: Vorgang): string {
    const b = einstellungen!.ebenen.find((e) => e.id === v.ebeneId)?.stellplaetze
    const ebene = ebenenName(einstellungen!, v.ebeneId)
    return v.stellplatz != null && b ? `${ebene} · ${platzText(b, v.stellplatz)}` : ebene
  }

  /**
   * Auf dem vorgeschlagenen Platz steht noch das bekannte Fahrzeug: bestätigen und gleich zum
   * nächsten Platz – hier gibt es nichts Neues zu erfassen.
   */
  async function platzNochDa() {
    if (!belegtVon || platzNr === null) return
    await mitFehlermeldung(() => sichtungSetzen(runde.id, belegtVon.id, 'noch_da'))
    platzWeiter(platzNr)
    zuruecksetzen(`${belegtVon.kennzeichenAnzeige} als „noch da“ bestätigt.`)
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

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (kameraStattSpeichern(true)) return
          beiReturn()
        }}
      >
      <div className="kz-platz">
      <label className="feld">
        <span>Kennzeichen</span>
        <input
          ref={kennzeichenFeld}
          className="kennzeichen"
          value={kennzeichen}
          onChange={(e) => {
            setKennzeichen(e.target.value)
            setMeldung('')
            setReturnGesperrt(false)
            nachFotoSpeichern.current = null
          }}
          placeholder="z. B. HH-AB 123"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus
        />
      </label>
      {bereich && (
        <label className="feld">
          <span>Platz</span>
          <input
            value={platz}
            onChange={(e) => setPlatz(e.target.value)}
            inputMode="decimal"
            placeholder={platzText(bereich, bereich.von)}
            autoComplete="off"
            enterKeyHint="go"
            aria-label={`Stellplatz ${platzText(bereich, bereich.von)} bis ${platzText(bereich, bereich.bis)}`}
          />
        </label>
      )}
      </div>
      {/* unsichtbarer Absende-Knopf, damit Return auch im Platz-Feld speichert */}
      <button type="submit" hidden />
      </form>
      {/* norm prüfen: die Abfrage liefert nach dem Leeren des Feldes kurz noch das alte Ergebnis */}
      {norm.length >= 2 && vorschlaege && vorschlaege.length > 0 && (
        <Hinweis art={returnGesperrt ? 'warnung' : undefined}>
          <p>
            {returnGesperrt ? (
              <strong>Bekanntes Fahrzeug? Bitte antippen. </strong>
            ) : (
              'Bekanntes Fahrzeug antippen = „noch da“. '
            )}
            Neues Fahrzeug: Kennzeichen vollständig eingeben und „Speichern“.
          </p>
          <div className="vorschlaege">
            {vorschlaege.map(({ v, schonDa }) => (
              <button key={v.id} type="button" className="knopf zweitrangig vorschlag" onClick={() => bekanntBestaetigen(v)}>
                <span className="vorschlag-kz">{v.kennzeichenAnzeige}</span>
                <span className="klein">
                  {[v.modell, ortText(v), schonDa ? '✓ schon bestätigt' : ''].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </Hinweis>
      )}
      {/* Fahrzeuge auf nicht gekennzeichneten Flächen bekommen keine Nummer; dann zählt auch nichts hoch */}
      {bereich && platzNr !== null && (
        <p className="klein" style={{ marginTop: -8 }}>
          Platz <span className="platz-marke">{platzText(bereich, platzNr)}</span> ·{' '}
          <button type="button" className="text-knopf" onClick={() => setPlatz('')}>
            ohne Nr. (nicht gekennzeichnete Fläche)
          </button>
        </p>
      )}
      {bereich && platz.trim() === '' && (
        <p className="klein" style={{ marginTop: -8 }}>
          Ohne Platznummer – für Fahrzeuge außerhalb der markierten Plätze. Für nummerierte Plätze
          die Nummer eintippen.
        </p>
      )}
      {'fehler' in platzEingabe && <Hinweis art="fehler">{platzEingabe.fehler}</Hinweis>}
      {ohne && (
        <Hinweis>
          <p>
            <strong>Fahrzeug ohne Kennzeichen:</strong> Ein Foto ist Pflicht.{' '}
            {fotos.length === 0
              ? 'Bei Return oder „Speichern“ öffnet sich die Kamera, nach dem Foto wird gespeichert.'
              : 'Foto ist da – Return speichert.'}
          </p>
          <p>Tipp: Modell und Farbe angeben, damit man das Fahrzeug später wiederfindet.</p>
        </Hinweis>
      )}
      {belegtVon && bereich && platzNr !== null && (
        <Hinweis art="warnung">
          <p>
            Platz {platzText(bereich, platzNr)} ist laut App noch mit <strong>{belegtVon.kennzeichenAnzeige}</strong>{' '}
            belegt.
          </p>
          <div className="knopf-reihe">
            <button type="button" className="knopf" onClick={platzNochDa}>
              {belegtVon.kennzeichenAnzeige} ist noch da
            </button>
            <button
              type="button"
              className="knopf zweitrangig"
              onClick={() => mitFehlermeldung(() => sichtungSetzen(runde.id, belegtVon.id, 'weg'))}
            >
              {belegtVon.kennzeichenAnzeige} ist weg
            </button>
          </div>
        </Hinweis>
      )}
      <p className="klein" style={{ marginTop: 0 }}>
        Schnell: Kennzeichen tippen + Return = speichern (Ebene bleibt gewählt
        {bereich ? ', Platz zählt hoch' : ''}). Bekannte Fahrzeuge: ein paar Zeichen tippen, Vorschlag
        antippen. Feld antippen → „Text scannen“ liest das Kennzeichen mit
        der Kamera.
      </p>

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
              beiAuswahl={(id) => {
                setEbeneId(id)
                setPlatz('')
              }}
              text={(id) => ebenenName(einstellungen, id)}
            />
          </div>

          <div className="feld">
            <span className="feld-titel">Kategorie</span>
            <Auswahl werte={KATEGORIEN} wert={kategorie} beiAuswahl={setKategorie} text={(k) => KATEGORIE_TEXT[k]} />
          </div>

          <div className="feld">
            <span className="feld-titel">{ohne ? 'Foto (Pflicht ohne Kennzeichen)' : 'Fotos (optional)'}</span>
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
            <FotoAufnahme beiFoto={fotoErhalten} eingabeRef={kamera} />
          </div>

          <label className="feld">
            <span>Notiz (optional)</span>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} />
          </label>

          <div className="knopf-reihe">
            <button type="button" className="knopf gross" disabled={!kannSpeichern}
              onClick={() => kameraStattSpeichern(true) || speichern(true)}
            >
              Speichern + nächstes
            </button>
            <button
              type="button"
              className="knopf gross zweitrangig"
              disabled={!kannSpeichern}
              onClick={() => kameraStattSpeichern(false) || speichern(false)}
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
