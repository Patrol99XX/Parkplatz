import Dexie, { type EntityTable } from 'dexie'
import type {
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
    this.version(1).stores({
      runden: 'id, gestartetAm',
      vorgaenge: 'id, kennzeichen, ersterfasstAm',
      sichtungen: 'id, vorgangId, rundeId',
      klaerungen: 'id, vorgangId',
      massnahmen: 'id, vorgangId',
      fotos: 'id, vorgangId',
      einstellungen: 'id',
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
    ebenen: ['Parkhaus Ebene 0', 'Parkhaus Ebene −1', 'Fläche neu', 'Fläche ganz neu'].map(
      (name) => ({ id: neueId(), name, aktiv: true }),
    ),
    aufbewahrung: { fotosTage: 30, vorgaengeTage: 90 },
    letzterKontrolleur: '',
    letzteSicherungAm: null,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  }
}

export const db = new ParkplatzDB()
