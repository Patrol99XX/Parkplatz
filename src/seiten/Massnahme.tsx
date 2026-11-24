// Maßnahmen: Vorschlag mit einem Tipp erledigen, weitere Maßnahmen eintragen, Verlauf.
import { useState } from 'react'
import { massnahmeEintragen, massnahmeLoeschen } from '../db/aktionen'
import { MASSNAHME_TEXT, type Massnahme, type MassnahmeTyp } from '../db/typen'
import { MASSNAHMEN_ANGEBOT, massnahmePruefen } from '../logik/massnahme'
import { formatDatumZeit } from '../logik/zeit'
import { Auswahl, mitFehlermeldung } from '../komponenten'

/**
 * Ein Tipp trägt den Vorschlag der Ampel als erledigt ein – das ist der häufigste Fall
 * und braucht deshalb kein Formular. Eine Notiz lässt sich auf der Fahrzeugseite ergänzen.
 */
export function VorschlagErledigt({ vorgangId, typ }: { vorgangId: string; typ: MassnahmeTyp }) {
  return (
    <button
      type="button"
      className="knopf vorschlag-knopf"
      onClick={() => mitFehlermeldung(() => massnahmeEintragen(vorgangId, typ))}
    >
      ✓ {MASSNAHME_TEXT[typ]} – erledigt
    </button>
  )
}

function MassnahmeFormular({ vorgangId, fertig }: { vorgangId: string; fertig: () => void }) {
  const [typ, setTyp] = useState<MassnahmeTyp | null>(null)
  const [notiz, setNotiz] = useState('')
  const [versucht, setVersucht] = useState(false)
  const fehler = massnahmePruefen(typ, notiz)

  return (
    <form
      className="klaerung-formular"
      onSubmit={async (e) => {
        e.preventDefault()
        setVersucht(true)
        if (fehler) return
        const ok = await mitFehlermeldung(async () => {
          await massnahmeEintragen(vorgangId, typ, notiz)
          return true
        })
        if (ok) fertig()
      }}
    >
      <div className="feld">
        <span className="feld-titel">Maßnahme</span>
        <Auswahl werte={MASSNAHMEN_ANGEBOT} wert={typ} beiAuswahl={setTyp} text={(t) => MASSNAHME_TEXT[t]} />
      </div>
      <label className="feld">
        <span>Notiz{typ === 'sonstiges' ? ' (Pflicht)' : ''}</span>
        <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
      </label>
      {versucht && fehler && <p className="fehler-text">{fehler}</p>}
      <div className="knopf-reihe">
        <button type="submit" className="knopf">
          Maßnahme speichern
        </button>
        <button type="button" className="knopf zweitrangig" onClick={fertig}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

/** Abschnitt „Maßnahmen“ auf der Fahrzeugseite: Verlauf (neueste zuerst), Eintragen, Löschen. */
export function MassnahmenAbschnitt({
  vorgangId,
  massnahmen,
  offen,
}: {
  vorgangId: string
  massnahmen: Massnahme[]
  /** nur bei Fahrzeugen auf dem Gelände kann etwas eingetragen werden */
  offen: boolean
}) {
  const [formular, setFormular] = useState(false)
  return (
    <section className="karte">
      <h2>Maßnahmen</h2>
      {massnahmen.length === 0 ? (
        <p className="klein">Noch keine Maßnahme eingetragen.</p>
      ) : (
        <ul className="verlauf">
          {massnahmen.map((m) => (
            <li key={m.id}>
              <span>
                <strong>{MASSNAHME_TEXT[m.typ]}</strong>
                <br />
                <span className="klein">
                  {formatDatumZeit(m.zeitpunkt)}
                  {m.notiz && ` · ${m.notiz}`}
                </span>
              </span>
              <button
                type="button"
                className="knopf klein-knopf gefahr"
                aria-label={`${MASSNAHME_TEXT[m.typ]} löschen`}
                onClick={() =>
                  confirm(`„${MASSNAHME_TEXT[m.typ]}“ vom ${formatDatumZeit(m.zeitpunkt)} löschen? Nur für Fehleingaben.`) &&
                  mitFehlermeldung(() => massnahmeLoeschen(m.id))
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {offen &&
        (formular ? (
          <MassnahmeFormular vorgangId={vorgangId} fertig={() => setFormular(false)} />
        ) : (
          <button type="button" className="knopf zweitrangig" onClick={() => setFormular(true)}>
            Maßnahme eintragen
          </button>
        ))}
    </section>
  )
}
