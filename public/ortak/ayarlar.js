let ayarlar = null;
export function ayarlariGetir() {
  ayarlar ??= fetch("/api/ayarlar").then((y) => (y.ok ? y.json() : {})).catch(() => ({}));
  return ayarlar;
}
