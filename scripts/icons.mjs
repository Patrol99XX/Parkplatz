// Erzeugt die App-Symbole (weißes „P“ auf Schwarz mit rotem Balken) als PNG – ohne zusätzliche Bibliothek,
// nur mit dem zlib-Modul von Node. Aufruf: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SCHWARZ = [0x11, 0x11, 0x11]
const WEISS = [0xff, 0xff, 0xff]
const ROT = [0xd5, 0x0f, 0x25]

// Farbe am Punkt (x, y) im Bereich 0..1: weißes „P“, roter Balken darunter, sonst Schwarz.
function farbe(x, y) {
  if (x >= 0.3 && x <= 0.7 && y >= 0.84 && y <= 0.89) return ROT
  return istP(x, y) ? WEISS : SCHWARZ
}

function istP(x, y) {
  const stamm = x >= 0.3 && x <= 0.42 && y >= 0.2 && y <= 0.8
  const cx = 0.5
  const cy = 0.385
  const d = Math.hypot(x - cx, y - cy)
  const bogen = x >= cx && d <= 0.185 && d >= 0.075
  const oben = x >= 0.36 && x <= cx && y >= 0.2 && y <= 0.31
  const unten = x >= 0.36 && x <= cx && y >= 0.46 && y <= 0.57
  return stamm || bogen || oben || unten
}

function crc32(buf) {
  let c
  let crc = 0xffffffff
  for (const b of buf) {
    c = (crc ^ b) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4)
  laenge.writeUInt32BE(daten.length)
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([laenge, td, crc])
}

function png(groesse) {
  const ss = 4 // Kantenglättung durch 4×4 Unterabtastung
  const zeilen = []
  for (let py = 0; py < groesse; py++) {
    const zeile = Buffer.alloc(1 + groesse * 3) // Filterbyte 0 + RGB
    for (let px = 0; px < groesse; px++) {
      const summe = [0, 0, 0]
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const f = farbe((px + (sx + 0.5) / ss) / groesse, (py + (sy + 0.5) / ss) / groesse)
          for (let k = 0; k < 3; k++) summe[k] += f[k]
        }
      for (let k = 0; k < 3; k++) zeile[1 + px * 3 + k] = Math.round(summe[k] / (ss * ss))
    }
    zeilen.push(zeile)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(groesse, 0)
  ihdr.writeUInt32BE(groesse, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 2 // Farbtyp RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(zeilen))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const [name, groesse] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(groesse))
  console.log(`public/${name} (${groesse}×${groesse})`)
}
