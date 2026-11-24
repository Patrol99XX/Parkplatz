// Klärung: Formular zum Eintragen eines Klärungsgrunds und die Klärungsliste.
// Das Formular wird auf der Fahrzeugseite und direkt in der Liste benutzt.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { klaerungEintragen } from '../db/aktionen'
import { ortText, useEinstellungen, useSbVorschlaege } from '../db/hooks'
import { klaerungslisteLaden, type KlaerungsEintrag } from '../db/ampelDaten'
import {
  KATEGORIE_TEXT,
  KLAERUNG_TEXT,
  MASSNAHME_TEXT,
  type Einstellungen,
  type Kategorie,
  type Klaerung,
  type KlaerungsGrund,
  type Vorgang,
} from '../db/typen'
import { KLAERUNGS_GRUENDE, klaerungPruefen } from '../logik/klaerung'
import { formatDatumZeit, standdauerText } from '../logik/zeit'
import { AmpelAnzeige, Auswahl, FotoAusDb, Kopf, mitFehlermeldung } from '../komponenten'
import { VorschlagErledigt } from './Massnahme'
import { KlaerungsDruck } from './KlaerungsDruck'

// ---------- Formular ----------

const KEIN_KUNDE_KATEGORIEN: Kategorie[] = ['unbekannt', 'fremdparker', 'mitarbeiter']

export function KlaerungFormular({
  vorgang,
  vorher,
  fertig,
}: {
  vorgang: Vorgang
  /** bisherige Klärung: SB wird übernommen, damit er nicht jedes Mal neu getippt werden muss */
  vorher: Klaerung | null
  fertig: () => void
}) {
  const sbVorschlaege = useSbVorschlaege()
  const [grund, setGrund] = useState<KlaerungsGrund | null>(null)
  const [sb, setSb] = useState(vorher?.serviceberater ?? '')
  const [notiz, setNotiz] = useState('')
  const [kategorie, setKategorie] = useState<Kategorie>('unbekannt')
  const [versucht, setVersucht] = useState(false)
  const fehler = klaerungPruefen({ grund, serviceberater: sb, notiz })
  const listenId = `sb-${vorgang.id}`

  async function speichern() {
    setVersucht(true)
    if (fehler || !grund) return
    const ok = await mitFehlermeldung(async () => {
      await klaerungEintragen(vorgang.id, { grund, serviceberater: sb, notiz }, kategorie)
      return true
    })
    if (ok) fertig()
  }

  return (
    <form
      className="klaerung-formular"
      onSubmit={(e) => {
        e.preventDefault()
        speichern()
      }}
    >
      <div className="feld">
        <span className="feld-titel">Grund</span>
        <Auswahl werte={KLAERUNGS_GRUENDE} wert={grund} beiAuswahl={setGrund} text={(g) => KLAERUNG_TEXT[g]} />
      </div>

      {grund === 'kein_kunde' && (
        <div className="feld">
          <span className="feld-titel">Was für ein Fahrzeug? (optional)</span>
          <Auswahl
            werte={KEIN_KUNDE_KATEGORIEN}
            wert={kategorie}
            beiAuswahl={setKategorie}
            text={(k) => (k === 'unbekannt' ? 'Weiß nicht' : KATEGORIE_TEXT[k])}
          />
        </div>
      )}

      {grund !== 'kein_kunde' && (
        <label className="feld">
          <span>Serviceberater</span>
          <input
            value={sb}
            onChange={(e) => setSb(e.target.value)}
            list={listenId}
            autoComplete="off"
            placeholder="Name"
          />
          <datalist id={listenId}>
            {sbVorschlaege?.map((n) => <option key={n} value={n} />)}
          </datalist>
        </label>
      )}

      <label className="feld">
        <span>Notiz{grund === 'sonstiges' ? ' (Pflicht)' : ''}</span>
        <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
      </label>

      {versucht && fehler && <p className="fehler-text">{fehler}</p>}

      <div className="knopf-reihe">
        <button type="submit" className="knopf">
          Klärung speichern
        </button>
        <button type="button" className="knopf zweitrangig" onClick={fertig}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

/** „Wartet auf Teile · Meier · 23.11.2026, 10:00“ */
export function klaerungText(k: Klaerung): string {
  return [KLAERUNG_TEXT[k.grund], k.serviceberater, formatDatumZeit(k.eingetragenAm)].filter(Boolean).join(' · ')
}

// ---------- Liste ----------

function Eintrag({ eintrag, einstellungen, jetzt }: { eintrag: KlaerungsEintrag; einstellungen: Einstellungen; jetzt: Date }) {
  const { vorgang: v, ampel, klaerung, massnahme } = eintrag
  const [offen, setOffen] = useState(false)
  return (
    <div className={`klaerung-eintrag ampel-rand ${ampel.farbe}`}>
      <a className="kopfteil" href={`#/fahrzeug/${v.id}`}>
        <div className="fahrzeug-vorschau-klein">{v.fotoIds[0] && <FotoAusDb fotoId={v.fotoIds[0]} alt="" />}</div>
        <div className="angaben">
          <div>
            <span className="kennzeichen">{v.kennzeichenAnzeige}</span>
            {v.kategorie !== 'unbekannt' && <span className="marke">{KATEGORIE_TEXT[v.kategorie]}</span>}
          </div>
          <div className="unterzeile">
            {[v.modell, ortText(einstellungen, v), standdauerText(v.ersterfasstAm, jetzt)].filter(Boolean).join(' · ')}
          </div>
        </div>
      </a>
      <div className="unterzeile">
        <AmpelAnzeige ampel={ampel} mitVorschlag />
      </div>
      {ampel.vorschlag && <VorschlagErledigt vorgangId={v.id} typ={ampel.vorschlag} />}
      <div className="unterzeile">
        <strong>Klärung:</strong> {klaerung ? klaerungText(klaerung) : 'noch keine'}
        {klaerung?.notiz && <> – {klaerung.notiz}</>}
      </div>
      {massnahme && (
        <div className="unterzeile">
          <strong>Maßnahme:</strong> {MASSNAHME_TEXT[massnahme.typ]} · {formatDatumZeit(massnahme.zeitpunkt)}
        </div>
      )}
      {offen ? (
        <KlaerungFormular vorgang={v} vorher={klaerung} fertig={() => setOffen(false)} />
      ) : (
        <button type="button" className="knopf zweitrangig klein-knopf" onClick={() => setOffen(true)}>
          Klärung eintragen
        </button>
      )}
    </div>
  )
}

/** Klärungsliste mit aktuellem Stand; wird in der eigenen Seite und im Rundenergebnis gezeigt. */
export function KlaerungsListe() {
  const einstellungen = useEinstellungen()
  const eintraege = useLiveQuery(klaerungslisteLaden)
  if (!einstellungen || !eintraege) return null
  const jetzt = new Date()
  if (eintraege.length === 0) return <p className="leer">Keine Fahrzeuge zu klären.</p>
  const rot = eintraege.filter((e) => e.ampel.farbe === 'rot').length
  return (
    <>
      <p className="klein">
        Stand {formatDatumZeit(jetzt)} · {eintraege.length} {eintraege.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'}
        {rot > 0 && `, davon ${rot} rot`}
      </p>
      <button type="button" className="knopf zweitrangig" onClick={() => window.print()}>
        🖨️ Drucken oder als PDF teilen
      </button>
      <p className="klein">
        Auf dem iPad im Druckfenster oben auf „Teilen“ tippen – dann entsteht ein PDF für Mail oder Dateien.
      </p>
      <KlaerungsDruck eintraege={eintraege} einstellungen={einstellungen} jetzt={jetzt} />
      <div className="raster">
        {eintraege.map((e) => (
          <Eintrag key={e.vorgang.id} eintrag={e} einstellungen={einstellungen} jetzt={jetzt} />
        ))}
      </div>
    </>
  )
}

export function Klaerungsliste() {
  return (
    <>
      <Kopf titel="Klärungsliste" />
      <p className="klein" style={{ marginTop: -8 }}>
        Fahrzeuge, die zu lange stehen oder deren Klärung von gestern oder früher ist. Rot zuerst.
      </p>
      <KlaerungsListe />
    </>
  )
}
