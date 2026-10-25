const yol = {
  pusula: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  harita: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  yildiz: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  kupa: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 21h8M9 17h6v4H9z"/>',
  kitap: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  soru: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  ev: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
  kullanici: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  zaman: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  kup: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
  oyun: '<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".8" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".8" fill="currentColor"/>',
  liste: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>',
  ok: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  geri: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".7" fill="currentColor"/>',
  kalp: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  konum: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  arama: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  tekrar: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  kapat: '<path d="M6 6l12 12M18 6L6 18"/>',
};

export const IKON_ADLARI = Object.keys(yol);

export function ikon(ad, boyut = 22) {
  const icerik = yol[ad] ?? yol.yildiz;
  return `<svg viewBox="0 0 24 24" width="${boyut}" height="${boyut}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icerik}</svg>`;
}
