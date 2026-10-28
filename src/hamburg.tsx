// Hamburg-Skyline als eigene, schlichte Zeichnung (SVG): Hafenkräne, Michel, Speicherstadt,
// Elbphilharmonie und Containerschiff. Bewusst selbst gezeichnet statt Foto: kein Urheberrecht,
// winzige Dateigröße, funktioniert offline und passt sich jeder Bildschirmbreite an.
// Die Farbe kommt von außen (currentColor), so taugt dieselbe Zeichnung als heller
// Hintergrund und als weiße Silhouette auf Schwarz.

export function HamburgSkyline({ className, wasser }: { className?: string; wasser?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 100" preserveAspectRatio="xMidYMax meet" aria-hidden fill="currentColor">
      {/* Hafenkräne */}
      <rect x="18" y="30" width="4" height="60" />
      <rect x="6" y="28" width="62" height="3" />
      <rect x="14" y="22" width="12" height="7" />
      <rect x="55" y="31" width="1.2" height="22" />
      <rect x="51" y="53" width="9" height="4" />
      <rect x="40" y="44" width="4" height="46" />
      <rect x="30" y="42" width="44" height="3" />
      <rect x="66" y="45" width="1.2" height="16" />

      {/* Michel: Turm mit Stufen und Spitze */}
      <rect x="104" y="48" width="18" height="42" />
      <rect x="107" y="36" width="12" height="13" />
      <rect x="109" y="27" width="8" height="10" />
      <path d="M110 27 L113 6 L116 27 Z" />
      <rect x="96" y="66" width="34" height="24" />

      {/* Speicherstadt mit Giebeln */}
      <path d="M134 90 V62 L142 54 L150 62 V90 Z" />
      <path d="M152 90 V58 L161 49 L170 58 V90 Z" />
      <path d="M172 90 V64 L180 56 L188 64 V90 Z" />
      <path d="M190 90 V60 L198 52 L206 60 V90 Z" />

      {/* Elbphilharmonie: Backsteinsockel und gewelltes Glasdach */}
      <rect x="222" y="60" width="86" height="30" />
      <path d="M222 60 V40 Q234 28 246 38 Q258 22 272 34 Q286 24 296 33 Q302 28 308 32 V60 Z" opacity="0.85" />

      {/* Containerschiff */}
      <path d="M318 82 H398 L392 90 H324 Z" />
      <rect x="326" y="72" width="10" height="10" />
      <rect x="338" y="74" width="10" height="8" />
      <rect x="350" y="70" width="10" height="12" />
      <rect x="362" y="74" width="10" height="8" />
      <rect x="378" y="62" width="10" height="20" />
      <rect x="381" y="56" width="4" height="7" />

      {/* Elbe */}
      <rect x="0" y="90" width="400" height="10" fill={wasser ?? 'currentColor'} />
    </svg>
  )
}
