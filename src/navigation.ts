// Einfache Navigation über den Teil der Adresse nach „#“ (z. B. #/fahrzeug/123).
// Vorteil: GitHub Pages kennt nur echte Dateien – mit „#“ landet jeder Aufruf
// bei index.html, und es braucht keine Router-Bibliothek.
import { useEffect, useState } from 'react'

function aktuellerPfad(): string[] {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function usePfad(): string[] {
  const [pfad, setPfad] = useState(aktuellerPfad)
  useEffect(() => {
    const beiAenderung = () => {
      setPfad(aktuellerPfad())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', beiAenderung)
    return () => window.removeEventListener('hashchange', beiAenderung)
  }, [])
  return pfad
}

export function geheZu(pfad: string) {
  location.hash = `#/${pfad}`
}
