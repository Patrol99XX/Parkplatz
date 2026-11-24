import { useState } from 'react'
import { Kopf, mitFehlermeldung } from '../komponenten'
import { useEinstellungen } from '../db/hooks'
import {
  berichtEmpfaengerSetzen,
  ebeneAktivSetzen,
  ebeneHinzufuegen,
  ebeneLoeschen,
  ebeneStellplaetzeSetzen,
  ebeneUmbenennen,
  ebeneVerschieben,
  platzHochzaehlenSetzen,
  aufbewahrungSetzen,
  schwelleSetzen,
  schwellenZuruecksetzen,
} from '../db/aktionen'
import { MIN_FOTOS_TAGE, MIN_VORGAENGE_TAGE } from '../logik/bereinigung'
import { formatDatumZeit } from '../logik/zeit'
import type { Ebene, Einstellungen as EinstellungenDaten, Schwellen } from '../db/typen'
import { platzText } from '../logik/stellplatz'
import { schwellenVon, STANDARD_SCHWELLEN } from '../logik/ampel'

export function Einstellungen() {
  const einstellungen = useEinstellungen()
  const [neu, setNeu] = useState('')

  if (!einstellungen) return null
  const ebenen = einstellungen.ebenen

  return (
    <>
      <Kopf titel="Einstellungen" />
      <section className="karte">
        <h2>Ebenen und Flächen</h2>
        <p className="klein">
          Reihenfolge wie beim Rundgang. Ebenen, auf denen schon Fahrzeuge erfasst wurden, lassen
          sich nicht löschen, nur ausblenden – sonst fehlt der Name in der Historie.
        </p>
        <ul className="ebenen-liste">
          {ebenen.map((e, i) => (
            <li key={e.id} className={e.aktiv ? '' : 'ausgeblendet'}>
              <input
                aria-label="Name der Ebene"
                defaultValue={e.name}
                onBlur={(ev) => {
                  const name = ev.target.value.trim()
                  if (!name) ev.target.value = e.name
                  else if (name !== e.name) ebeneUmbenennen(e.id, name)
                }}
              />
              <div className="ebene-knoepfe">
                <button
                  type="button"
                  className="knopf klein-knopf"
                  disabled={i === 0}
                  aria-label="Nach oben"
                  onClick={() => ebeneVerschieben(e.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf"
                  disabled={i === ebenen.length - 1}
                  aria-label="Nach unten"
                  onClick={() => ebeneVerschieben(e.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf"
                  onClick={() => ebeneAktivSetzen(e.id, !e.aktiv)}
                >
                  {e.aktiv ? 'Ausblenden' : 'Einblenden'}
                </button>
                <button
                  type="button"
                  className="knopf klein-knopf gefahr"
                  onClick={async () => {
                    if (!confirm(`Ebene „${e.name}“ löschen?`)) return
                    const ok = await mitFehlermeldung(() => ebeneLoeschen(e.id))
                    if (ok === false) {
                      alert('Auf dieser Ebene wurden schon Fahrzeuge erfasst. Sie kann nur ausgeblendet werden.')
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
              <Stellplaetze ebene={e} />
            </li>
          ))}
        </ul>
        <form
          className="zeile"
          onSubmit={async (ev) => {
            ev.preventDefault()
            if (!neu.trim()) return
            await ebeneHinzufuegen(neu)
            setNeu('')
          }}
        >
          <input placeholder="Neue Ebene oder Fläche" value={neu} onChange={(ev) => setNeu(ev.target.value)} />
          <button type="submit" className="knopf" disabled={!neu.trim()}>
            Hinzufügen
          </button>
        </form>
      </section>

      <section className="karte">
        <h2>Erfassen</h2>
        <label className="schalter">
          <input
            type="checkbox"
            checked={einstellungen.platzHochzaehlen !== false}
            onChange={(ev) => platzHochzaehlenSetzen(ev.target.checked)}
          />
          <span>
            Platznummer automatisch hochzählen
            <br />
            <span className="klein">Nach dem Speichern von 0.05 ist 0.06 vorgeschlagen.</span>
          </span>
        </label>
      </section>

      <AmpelSchwellen einstellungen={einstellungen} />

      <Aufbewahrung einstellungen={einstellungen} />

      <section className="karte">
        <h2>Bericht per E-Mail</h2>
        <p className="klein">
          An diese Adresse geht der Bericht nach einer Kontrolle (Fahrzeuge, die seit gestern oder
          länger stehen). Mehrere Adressen mit Komma trennen.
        </p>
        <input
          type="email"
          multiple
          aria-label="E-Mail-Empfänger"
          placeholder="name@firma.de"
          defaultValue={einstellungen.berichtEmpfaenger ?? ''}
          autoCapitalize="off"
          autoCorrect="off"
          onBlur={(ev) => {
            if (ev.target.value.trim() !== (einstellungen.berichtEmpfaenger ?? '')) {
              berichtEmpfaengerSetzen(ev.target.value)
            }
          }}
        />
      </section>
    </>
  )
}

/** Nummernbereich einer Ebene, z. B. Präfix „0.“, Plätze 1 bis 20 → 0.01–0.20 */
function Stellplaetze({ ebene }: { ebene: Ebene }) {
  const b = ebene.stellplaetze
  if (!b) {
    return (
      <button
        type="button"
        className="text-knopf"
        onClick={() => ebeneStellplaetzeSetzen(ebene.id, { praefix: '', von: 1, bis: 20 })}
      >
        Stellplätze nummerieren
      </button>
    )
  }
  const zahl = (wert: string, alt: number) => {
    const n = Number(wert)
    return Number.isInteger(n) && n >= 0 ? n : alt
  }
  return (
    <div className="stellplatz-bereich">
      <span className="klein">
        Stellplätze {platzText(b, b.von)} bis {platzText(b, b.bis)}
      </span>
      <div className="zeile">
        <label>
          <span className="klein">Präfix</span>
          <input
            defaultValue={b.praefix}
            key={`p-${b.praefix}`}
            onBlur={(ev) => ev.target.value !== b.praefix && ebeneStellplaetzeSetzen(ebene.id, { ...b, praefix: ev.target.value.trim() })}
          />
        </label>
        <label>
          <span className="klein">von</span>
          <input
            inputMode="numeric"
            defaultValue={b.von}
            key={`v-${b.von}`}
            onBlur={(ev) => {
              const von = zahl(ev.target.value, b.von)
              if (von !== b.von && von <= b.bis) ebeneStellplaetzeSetzen(ebene.id, { ...b, von })
              else ev.target.value = String(b.von)
            }}
          />
        </label>
        <label>
          <span className="klein">bis</span>
          <input
            inputMode="numeric"
            defaultValue={b.bis}
            key={`b-${b.bis}`}
            onBlur={(ev) => {
              const bis = zahl(ev.target.value, b.bis)
              if (bis !== b.bis && bis >= b.von) ebeneStellplaetzeSetzen(ebene.id, { ...b, bis })
              else ev.target.value = String(b.bis)
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="text-knopf"
        onClick={() => confirm(`Nummerierung für „${ebene.name}“ entfernen?`) && ebeneStellplaetzeSetzen(ebene.id, null)}
      >
        Keine Nummerierung
      </button>
    </div>
  )
}

/** Beschriftung, Einheit und gültiger Bereich je Schwelle. Reihenfolge = Anzeige. */
const SCHWELLEN_FELDER: { name: keyof Schwellen; text: string; einheit: string; min: number }[] = [
  { name: 'ohneKlaerungRotAbTag', text: 'Ohne Klärung: rot, wenn noch da nach', einheit: 'Kalendertag(en)', min: 1 },
  { name: 'klaerungRotAbTag', text: 'Mit Klärungsgrund: rot ab', einheit: 'Kalendertagen (3 = Mo → Do)', min: 1 },
  { name: 'abholfristGelbStunden', text: 'Fertig: gelb nach', einheit: 'Stunden', min: 1 },
  { name: 'abholfristRotStunden', text: 'Fertig: rot nach', einheit: 'Stunden', min: 1 },
  { name: 'antreffenGelb', text: 'Fremdparker/Mitarbeiter: gelb ab', einheit: 'Tagen gesehen', min: 1 },
  { name: 'antreffenRot', text: 'Fremdparker/Mitarbeiter: rot ab', einheit: 'Tagen gesehen', min: 1 },
]

function AmpelSchwellen({ einstellungen }: { einstellungen: EinstellungenDaten }) {
  const s = schwellenVon(einstellungen)
  const geaendert = SCHWELLEN_FELDER.some((f) => s[f.name] !== STANDARD_SCHWELLEN[f.name])
  return (
    <section className="karte">
      <h2>Ampel</h2>
      <p className="klein">
        Gezählt wird ab der Ersterfassung in Kalendertagen bzw. ab der Klärung in Stunden – immer bis
        zur letzten Kontrolle, in der das Fahrzeug gesehen wurde. Änderungen wirken sofort auf alle
        Fahrzeuge.
      </p>
      <div className="schwellen">
        {SCHWELLEN_FELDER.map((f) => (
          <label key={f.name}>
            <span>{f.text}</span>
            <span className="schwelle-wert">
              <input
                inputMode="numeric"
                defaultValue={s[f.name]}
                key={`${f.name}-${s[f.name]}`}
                onBlur={(ev) => {
                  const n = Number(ev.target.value)
                  if (Number.isInteger(n) && n >= f.min) {
                    if (n !== s[f.name]) schwelleSetzen(f.name, n)
                  } else {
                    ev.target.value = String(s[f.name])
                  }
                }}
              />
              <span className="klein">{f.einheit}</span>
            </span>
          </label>
        ))}
      </div>
      {geaendert && (
        <button
          type="button"
          className="text-knopf"
          onClick={() => confirm('Alle Ampel-Schwellen auf die Standardwerte zurücksetzen?') && schwellenZuruecksetzen()}
        >
          Standardwerte wiederherstellen
        </button>
      )}
    </section>
  )
}

/** Aufbewahrungsfristen (Datenschutz) und Ergebnis der letzten automatischen Bereinigung. */
function Aufbewahrung({ einstellungen }: { einstellungen: EinstellungenDaten }) {
  const { fotosTage, vorgaengeTage } = einstellungen.aufbewahrung
  const letzte = einstellungen.letzteBereinigung
  const zahl = (wert: string) => {
    const n = Number(wert)
    return Number.isInteger(n) ? n : NaN
  }
  return (
    <section className="karte">
      <h2>Aufbewahrung</h2>
      <p className="klein">
        Kennzeichen und Fotos sind personenbezogene Daten. Nach Ende eines Vorgangs (Fahrzeug „weg“)
        werden sie beim App-Start automatisch gelöscht. Fahrzeuge auf dem Gelände bleiben immer.
        Vorher sichern, wenn die Daten länger gebraucht werden.
      </p>
      <div className="schwellen">
        <label>
          <span>Fotos löschen nach</span>
          <span className="schwelle-wert">
            <input
              inputMode="numeric"
              defaultValue={fotosTage}
              key={`f-${fotosTage}`}
              onBlur={(ev) => {
                const n = zahl(ev.target.value)
                if (n >= MIN_FOTOS_TAGE && n <= vorgaengeTage) {
                  if (n !== fotosTage) aufbewahrungSetzen(n, vorgaengeTage)
                } else ev.target.value = String(fotosTage)
              }}
            />
            <span className="klein">Tagen</span>
          </span>
        </label>
        <label>
          <span>Vorgänge löschen nach</span>
          <span className="schwelle-wert">
            <input
              inputMode="numeric"
              defaultValue={vorgaengeTage}
              key={`v-${vorgaengeTage}`}
              onBlur={(ev) => {
                const n = zahl(ev.target.value)
                if (n >= Math.max(MIN_VORGAENGE_TAGE, fotosTage)) {
                  if (n !== vorgaengeTage) aufbewahrungSetzen(fotosTage, n)
                } else ev.target.value = String(vorgaengeTage)
              }}
            />
            <span className="klein">Tagen (mind. {MIN_VORGAENGE_TAGE}, wegen Wiederholer-Erkennung)</span>
          </span>
        </label>
      </div>
      <p className="klein" style={{ marginBottom: 0 }}>
        {letzte
          ? `Zuletzt gelöscht am ${formatDatumZeit(letzte.am)}: ${letzte.vorgaenge} ${letzte.vorgaenge === 1 ? 'Vorgang' : 'Vorgänge'}, ${letzte.fotos} ${letzte.fotos === 1 ? 'Foto' : 'Fotos'}, ${letzte.runden} ${letzte.runden === 1 ? 'Kontrolle' : 'Kontrollen'}.`
          : 'Bisher musste nichts gelöscht werden.'}
      </p>
    </section>
  )
}
