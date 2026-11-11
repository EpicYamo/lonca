export function loncaLogo({ boyut = 32, baslik = "Lonca" } = {}) {
  const id = `l${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="lonca-logo" width="${boyut}" height="${boyut}" viewBox="0 0 48 48" role="img" aria-label="${baslik}">
  <defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ff5c0"/><stop offset="1" stop-color="#2fbf86"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd497"/><stop offset="1" stop-color="#167a54"/></linearGradient>
    <filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#04140d" flood-opacity=".55"/></filter>
  </defs>
  <g filter="url(#${id}g)">
    <path d="M24 6C15.5 7.7 9.5 14.9 9.5 24.5V41H24Z" fill="url(#${id}b)"/>
    <path d="M24 6C32.5 7.7 38.5 14.9 38.5 24.5V41H24Z" fill="url(#${id}a)"/>
    <path d="M24 6V41" stroke="#c9ffe6" stroke-opacity=".4" stroke-width=".8" fill="none"/>
    <path d="M24 6V4.4" stroke="url(#${id}a)" stroke-width="1.1" fill="none"/>
    <circle cx="24" cy="4" r="1.7" fill="url(#${id}a)"/>
  </g>
</svg>`;
}
