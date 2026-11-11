// Google ile giriş: web uygulaması, Studio ve Android uygulaması aynı sunucu akışını kullanır (server/google-giris.js).
//  - Web/Studio: sayfa /api/hesap/google/baslat'a gider; Google'dan dönünce sunucu sayfayı #google-kod=… ile geri açar.
//  - Android: akış Custom Tab'da (Capacitor Browser) açılır; bitince sunucu com.kozmos.lonca://google?kod=… adresine
//    yönlendirir, uygulama bunu "appUrlOpen" ile yakalar. Kod tek kullanımlıktır ve /api/hesap/google/takas ile jetona çevrilir.

const UYGULAMA_ADRESI = "com.kozmos.lonca://google";
const native = () => !!window.Capacitor?.isNativePlatform?.();

/** Sunucuda Google girişi açık mı (GOOGLE_ISTEMCI_KIMLIGI + GOOGLE_ISTEMCI_SIRRI dolu mu)? */
export async function googleAcikMi() {
  try {
    const y = await fetch("/api/ayarlar");
    return y.ok && (await y.json())?.hesap?.google === true;
  } catch { return false; }
}

/** Google girişini başlatır. donus: web'de dönülecek sayfa ("/app/", "/studio/" ya da "/"). */
export async function googleIleBaslat({ donus = "/" } = {}) {
  const Tarayici = window.Capacitor?.Plugins?.Browser;
  if (native() && Tarayici) {
    const sunucu = window.loncaMobil?.sunucu;
    if (!sunucu) throw new Error("Bu pakette sunucu adresi yok; Google ile giriş için sunucuya bağlı olmak gerekiyor.");
    await Tarayici.open({ url: `${sunucu}/api/hesap/google/baslat?istemci=uygulama`, presentationStyle: "fullscreen" });
    return;
  }
  location.assign(`/api/hesap/google/baslat?donus=${encodeURIComponent(donus)}`);
}

/** Web'de Google'dan dönüşü okur ve adres çubuğunu temizler: { kod } | { hata } | null. */
export function googleDonusuOku() {
  if (!location.hash.includes("google-")) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  const kod = q.get("google-kod"), hata = q.get("google-hata");
  if (!kod && !hata) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return kod ? { kod } : { hata };
}

/** Uygulamada Custom Tab'dan dönüşü dinler; her dönüşte isle({ kod } | { hata }) çağrılır. */
export function uygulamaDonusunuDinle(isle) {
  const P = window.Capacitor?.Plugins;
  if (!native() || !P?.App) return;
  Promise.resolve(P.App.addListener("appUrlOpen", ({ url } = {}) => {
    if (typeof url !== "string" || !url.startsWith(UYGULAMA_ADRESI)) return;
    Promise.resolve(P.Browser?.close?.()).catch(() => {});
    const q = new URL(url.replace(UYGULAMA_ADRESI, "https://x/")).searchParams;
    const kod = q.get("kod");
    isle(kod ? { kod } : { hata: q.get("hata") || "Google girişi tamamlanamadı." });
  })).catch(() => {});
}

/** Tek kullanımlık kodu oturum jetonuna çevirir: { jeton, hesap }. */
export async function googleKodTakas(kod) {
  const y = await fetch("/api/hesap/google/takas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kod }) });
  const sonuc = await y.json().catch(() => ({}));
  if (!y.ok) throw new Error(sonuc.hata ?? `Google girişi tamamlanamadı (${y.status})`);
  return sonuc;
}

export const GOOGLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-2 3.2-4.9 3.2-8.3z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
