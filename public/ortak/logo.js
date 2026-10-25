export function loncaLogo({ boyut = 32, baslik = "Lonca" } = {}) {
  const id = `l${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="lonca-logo" width="${boyut}" height="${boyut}" viewBox="0 0 48 48" role="img" aria-label="${baslik}">
  <defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ff5c0"/><stop offset="1" stop-color="#2fbf86"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd497"/><stop offset="1" stop-color="#167a54"/></linearGradient>
    <filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#04140d" flood-opacity=".55"/></filter>
  </defs>
  <g filter="url(#${id}g)">
    <g opacity=".78"><path d="M18 5 L4 31 L18 31 Z" fill="url(#${id}b)"/><path d="M18 5 L32 31 L18 31 Z" fill="#11654a"/></g>
    <g><path d="M30 16 L16 43 L30 43 Z" fill="url(#${id}a)"/><path d="M30 16 L44 43 L30 43 Z" fill="url(#${id}b)"/>
      <path d="M30 16 L16 43 M30 16 L44 43" stroke="#c9ffe6" stroke-opacity=".45" stroke-width=".7" fill="none"/></g>
  </g>
</svg>`;
}
