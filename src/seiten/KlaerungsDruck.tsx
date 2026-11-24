// Druckansicht der Klärungsliste (A4 quer), z. B. für die Serviceannahme.
//
// So funktioniert es: Die Tabelle wird per „Portal“ direkt in <body> gehängt, neben die
// eigentliche App (#root). Auf dem Bildschirm ist sie unsichtbar. Beim Drucken blendet das
// Print-CSS die App aus und zeigt nur die Tabelle. Vorteil: Die Bildschirmkarten bleiben
// für die Bedienung optimiert, die Druckfassung für Papier – ohne PDF-Bibliothek.
// Auf dem iPad wird aus dem Druckdialog über „Teilen“ ein PDF.
import { createPortal } from 'react-dom'
import type { KlaerungsEintrag } from '../db/ampelDaten'
import { ortText } from '../db/hooks'
import { KATEGORIE_TEXT, MASSNAHME_TEXT, type Einstellungen } from '../db/typen'
import { formatDatumZeit, standdauerText } from '../logik/zeit'
import type { AmpelFarbe } from '../logik/ampel'
import { FotoAusDb } from '../komponenten'
import { klaerungText } from './Klaerung'

const FARBE_TEXT: Record<AmpelFarbe, string> = { rot: 'ROT', gelb: 'GELB', gruen: 'GRÜN' }

export function KlaerungsDruck({
  eintraege,
  einstellungen,
  jetzt,
}: {
  eintraege: KlaerungsEintrag[]
  einstellungen: Einstellungen
  jetzt: Date
}) {
  const rot = eintraege.filter((e) => e.ampel.farbe === 'rot').length
  return createPortal(
    <div id="druck-wurzel">
      <header className="druck-kopf">
        <h1>Klärungsliste Parkplatz</h1>
        <p>
          Stand {formatDatumZeit(jetzt)} · {eintraege.length} {eintraege.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'}
          {rot > 0 && `, davon ${rot} rot`} · Bitte Grund und Serviceberater eintragen und zurückgeben.
        </p>
      </header>
      <table className="druck-tabelle">
        <thead>
          <tr>
            <th>Ampel</th>
            <th>Foto</th>
            <th>Fahrzeug</th>
            <th>Steht</th>
            <th>Warum auf der Liste</th>
            <th>Letzte Klärung / Maßnahme</th>
            <th className="rueckmeldung">Rückmeldung SB (Grund, Name)</th>
          </tr>
        </thead>
        <tbody>
          {eintraege.map(({ vorgang: v, ampel, klaerung, massnahme }) => (
            <tr key={v.id} className={ampel.farbe}>
              <td className="ampel-zelle">{FARBE_TEXT[ampel.farbe]}</td>
              <td className="foto-zelle">{v.fotoIds[0] && <FotoAusDb fotoId={v.fotoIds[0]} alt="" />}</td>
              <td>
                <strong className="kennzeichen">{v.kennzeichenAnzeige}</strong>
                <br />
                {[v.modell, v.kategorie !== 'unbekannt' ? KATEGORIE_TEXT[v.kategorie] : ''].filter(Boolean).join(' · ')}
                <br />
                {ortText(einstellungen, v)}
              </td>
              <td>{standdauerText(v.ersterfasstAm, jetzt)}</td>
              <td>
                {ampel.grund}
                {ampel.vorschlag && (
                  <>
                    <br />
                    <strong>Vorschlag: {MASSNAHME_TEXT[ampel.vorschlag]}</strong>
                  </>
                )}
              </td>
              <td>
                {klaerung ? klaerungText(klaerung) : '–'}
                {klaerung?.notiz && (
                  <>
                    <br />
                    <em>{klaerung.notiz}</em>
                  </>
                )}
                {massnahme && (
                  <>
                    <br />
                    Maßnahme: {MASSNAHME_TEXT[massnahme.typ]}, {formatDatumZeit(massnahme.zeitpunkt)}
                  </>
                )}
              </td>
              <td className="rueckmeldung" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  )
}
