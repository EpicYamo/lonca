// Cihazın konum izni ve konumu. Android uygulamasında @capacitor/geolocation eklentisi kullanılır: izin
// istenince sistemin kendi izin penceresi açılır, konum da cihazın konum servisinden alınır. Web'de
// tarayıcının konum izni ve navigator.geolocation kullanılır.
//
// Durumlar: "verildi" · "sorulacak" (henüz sorulmadı ya da yeniden sorulabilir) · "reddedildi" (sistem artık
// sormuyor; yalnızca Ayarlar'dan açılır) · "kapali" (cihazın konum servisi kapalı) · "yok" (bu cihazda konum yok).
const yerelMi = () => !!window.Capacitor?.isNativePlatform?.();
const eklenti = () => (yerelMi() ? window.Capacitor.Plugins?.Geolocation ?? null : null);

function cevir(d) {
  const v = [d?.location, d?.coarseLocation];
  if (v.includes("granted")) return "verildi";
  if (v.every((x) => x === "denied")) return "reddedildi";
  return "sorulacak";
}
const servisKapali = (h) => /not enabled|disabled|kapal/i.test(String(h?.message ?? h));

export async function konumIzniDurumu() {
  const g = eklenti();
  if (g) {
    try { return cevir(await g.checkPermissions()); } catch (h) { return servisKapali(h) ? "kapali" : "yok"; }
  }
  if (!navigator.geolocation) return "yok";
  try {
    const d = await navigator.permissions?.query({ name: "geolocation" });
    return ({ granted: "verildi", prompt: "sorulacak", denied: "reddedildi" })[d?.state] ?? "sorulacak";
  } catch { return "sorulacak"; }
}

// Sistemin izin penceresini açar (sorulabiliyorsa). Sonuçtaki durumu döner.
export async function konumIzniIste() {
  const g = eklenti();
  if (g) {
    const once = await konumIzniDurumu();
    if (once !== "sorulacak") return once;
    try { return cevir(await g.requestPermissions({ permissions: ["location", "coarseLocation"] })); } catch { return konumIzniDurumu(); }
  }
  if (!navigator.geolocation) return "yok";
  // Tarayıcı izni ancak konum istenince sorar.
  return new Promise((coz) => navigator.geolocation.getCurrentPosition(
    () => coz("verildi"), (h) => coz(h?.code === 1 ? "reddedildi" : "sorulacak"), { timeout: 10000, maximumAge: 60000 }));
}

// Cihazın konumu: { lat, lng, dogruluk }. İzin yoksa ya da konum alınamazsa hata fırlatır.
export async function konumBul({ zamanAsimi = 10000 } = {}) {
  const g = eklenti();
  if (g) {
    const p = await g.getCurrentPosition({ enableHighAccuracy: false, timeout: zamanAsimi, maximumAge: 60000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, dogruluk: p.coords.accuracy };
  }
  return new Promise((coz, reddet) => {
    if (!navigator.geolocation) return reddet(new Error("Bu cihazda konum yok"));
    navigator.geolocation.getCurrentPosition(
      (p) => coz({ lat: p.coords.latitude, lng: p.coords.longitude, dogruluk: p.coords.accuracy }), reddet,
      { enableHighAccuracy: false, timeout: zamanAsimi, maximumAge: 60000 });
  });
}

// Uygulamada Lonca'nın sistem ayarları sayfasını (izinler) ya da konum servisi ayarını açar. Web'de false döner.
export async function ayarlariAc(tur = "uygulama") {
  const p = yerelMi() ? window.Capacitor.Plugins?.LoncaSunucu : null;
  if (!p?.ayarlariAc) return false;
  try { await p.ayarlariAc({ tur }); return true; } catch { return false; }
}
export const uygulamadaMi = yerelMi;
