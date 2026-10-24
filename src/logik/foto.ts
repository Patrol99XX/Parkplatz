// Fotos vom iPhone haben oft 4–12 MB. Verkleinert auf 1280 px an der langen Seite
// sind es etwa 150–300 KB – genug, um Fahrzeug und Kennzeichen zu erkennen,
// und die Sicherungsdatei bleibt handlich.
const MAX_KANTE = 1280
const QUALITAET = 0.7

export async function verkleinereFoto(datei: Blob): Promise<Blob> {
  const url = URL.createObjectURL(datei)
  try {
    const bild = new Image()
    bild.src = url
    // Safari dreht das Bild beim Laden selbst richtig herum (EXIF-Ausrichtung).
    await bild.decode()
    const faktor = Math.min(1, MAX_KANTE / Math.max(bild.naturalWidth, bild.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bild.naturalWidth * faktor)
    canvas.height = Math.round(bild.naturalHeight * faktor)
    canvas.getContext('2d')!.drawImage(bild, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((ok, fehler) =>
      canvas.toBlob(
        (b) => (b ? ok(b) : fehler(new Error('Foto konnte nicht verkleinert werden.'))),
        'image/jpeg',
        QUALITAET,
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
