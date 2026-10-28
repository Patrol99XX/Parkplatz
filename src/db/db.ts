import Dexie, { type EntityTable } from 'dexie'
import type {
  Ebene,
  Einstellungen,
  Foto,
  Klaerung,
  Massnahme,
  Runde,
  Sichtung,
  Vorgang,
} from './typen'
import { jetztIso, neueId } from '../logik/uuid'

export class ParkplatzDB extends Dexie {
  runden!: EntityTable<Runde, 'id'>
  vorgaenge!: EntityTable<Vorgang, 'id'>
  sichtungen!: EntityTable<Sichtung, 'id'>
  klaerungen!: EntityTable<Klaerung, 'id'>
  massnahmen!: EntityTable<Massnahme, 'id'>
  fotos!: EntityTable<Foto, 'id'>
  einstellungen!: EntityTable<Einstellungen, 'id'>

  constructor() {
    super('parkplatz-kontrolle')
    // Angegeben werden nur der Schlüssel (id) und die Felder, nach denen gesucht wird.
    // Wahrheitswerte und null kann IndexedDB nicht indizieren – „offen“ und
    // „beendetAm“ werden deshalb gefiltert statt über einen Index gesucht.
    // Bei einigen hundert Datensätzen ist das schnell genug.
    const tabellen = {
      runden: 'id, gestartetAm',
      vorgaenge: 'id, kennzeichen, ersterfasstAm',
      sichtungen: 'id, vorgangId, rundeId',
      klaerungen: 'id, vorgangId',
      massnahmen: 'id, vorgangId',
      fotos: 'id, vorgangId',
      einstellungen: 'id',
    }
    this.version(1).stores(tabellen)

    // Version 2: Stellplatznummern. Die Tabellen bleiben gleich; die Migration läuft einmalig
    // beim ersten Start nach dem Update und trägt bei den Parkhaus-Ebenen die Nummernbereiche ein.
    this.version(2)
      .stores(tabellen)
      .upgrade(async (tx) => {
        const e = (await tx.table('einstellungen').get('app')) as Einstellungen | undefined
        if (!e) return
        e.ebenen = e.ebenen.map(mitStandardStellplaetzen)
        e.platzHochzaehlen ??= true
        await tx.table('einstellungen').put(e)
      })

    // Wird nur beim allerersten Öffnen der Datenbank ausgeführt.
    this.on('populate', (tx) => {
      tx.table('einstellungen').add(standardEinstellungen())
    })
  }
}

export function standardEinstellungen(): Einstellungen {
  const jetzt = jetztIso()
  return {
    id: 'app',
    ebenen: ['Parkhaus Ebene 0', 'Parkhaus Ebene −1', 'Fläche neu', 'Fläche ganz neu'].map((name) =>
      mitStandardStellplaetzen({ id: neueId(), name, aktiv: true }),
    ),
    aufbewahrung: { fotosTage: 30, vorgaengeTage: 90 },
    letzterKontrolleur: '',
    letzteSicherungAm: null,
    berichtEmpfaenger: '',
    platzHochzaehlen: true,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  }
}

/**
 * Nummernbereiche der Parkhaus-Ebenen laut Beschilderung: 0.01–0.20 und -1.01–-1.44.
 * Wird nur gesetzt, wenn die Ebene noch keinen Bereich hat; später in den Einstellungen änderbar.
 */
function mitStandardStellplaetzen(ebene: Ebene): Ebene {
  if (ebene.stellplaetze !== undefined) return ebene
  const name = ebene.name.replace('−', '-') // typografisches Minus wie Bindestrich behandeln
  if (/ebene 0$/i.test(name)) return { ...ebene, stellplaetze: { praefix: '0.', von: 1, bis: 20 } }
  if (/ebene -1$/i.test(name)) return { ...ebene, stellplaetze: { praefix: '-1.', von: 1, bis: 44 } }
  return { ...ebene, stellplaetze: null }
}

export const db = new ParkplatzDB()
