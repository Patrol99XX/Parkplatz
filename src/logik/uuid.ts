// crypto.randomUUID() gibt es nur in „sicheren“ Umgebungen (HTTPS, localhost).
// Beim Test auf dem iPhone über http://192.168.x.x fehlt sie, deshalb der Ersatz
// über getRandomValues, das überall verfügbar ist.
export function neueId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // Version 4
  b[8] = (b[8] & 0x3f) | 0x80 // Variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function jetztIso(): string {
  return new Date().toISOString()
}
