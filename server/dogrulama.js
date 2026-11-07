
export const ESER_TURLERI = ["cami", "mescit", "medrese", "han", "hamam", "cesme", "turbe", "kulliye", "imaret",
  "kopru", "tekke", "hazire", "carsi", "kutuphane", "sivil", "diger"];

const metinMi = (x) => typeof x === "string";
// eslint-disable-next-line no-control-regex -- NUL karakteri bilerek temizlenir
const kirp = (x, n) => (metinMi(x) ? x.replace(/\u0000/g, "").trim().slice(0, n) : "");

export function kimlikUret(ad) {
  const harf = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return String(ad).toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (h) => harf[h])
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "eser";
}

export function eserDogrula(veri, { kismi = false } = {}) {
  const hatalar = [], eser = {};
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["eser verisi bir nesne olmalı"], eser };
  const var_ = (k) => !kismi || Object.hasOwn(veri, k);

  if (var_("ad")) {
    eser.ad = kirp(veri.ad, 120);
    if (eser.ad.length < 2) hatalar.push("ad en az 2 karakter olmalı");
  }
  if (var_("ad_en")) eser.ad_en = kirp(veri.ad_en, 120) || null;
  if (var_("il")) { eser.il = kirp(veri.il, 40) || "Bursa"; }
  if (var_("ilce")) eser.ilce = kirp(veri.ilce, 40) || null;
  if (var_("tur")) {
    eser.tur = veri.tur;
    if (!ESER_TURLERI.includes(veri.tur)) hatalar.push(`tür şunlardan biri olmalı: ${ESER_TURLERI.join(", ")}`);
  }
  if (var_("yuzyil")) {
    const y = veri.yuzyil === "" || veri.yuzyil == null ? null : Number(veri.yuzyil);
    if (y !== null && !(Number.isInteger(y) && y >= 1 && y <= 21)) hatalar.push("yüzyıl 1–21 arası bir tam sayı ya da boş olmalı");
    eser.yuzyil = y;
  }
  if (var_("konum")) {
    const k = veri.konum;
    if (k == null || k === "") eser.konum = null;
    else {
      const lat = Number(k.lat), lng = Number(k.lng);
      if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) hatalar.push("konum: geçerli enlem/boylam gerekli");
      else eser.konum = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, ...(k.yaklasik ? { yaklasik: true } : {}) };
    }
  }
  if (var_("adres")) eser.adres = kirp(veri.adres, 240) || null;
  if (var_("tarihce")) {
    const tr = kirp(veri.tarihce?.tr, 8000), en = kirp(veri.tarihce?.en, 8000);
    if (tr.length < 20) hatalar.push("Türkçe tarihçe en az 20 karakter olmalı");
    eser.tarihce = { tr, en: en || null };
  }
  if (var_("kaynak")) {
    eser.kaynak = kirp(veri.kaynak, 240);
    if (eser.kaynak.length < 3) hatalar.push("kaynak zorunlu (ör. kitap, cilt, sayfa ya da kurum)");
  }
  if (var_("fotograflar")) {
    const liste = Array.isArray(veri.fotograflar) ? veri.fotograflar : [];
    eser.fotograflar = liste.filter(metinMi).map((f) => f.trim()).filter(Boolean).slice(0, 12);
    for (const f of eser.fotograflar) {
      if (!/^\/medya\/[a-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(f) && !/^https:\/\/[^\s"'<>]+$/i.test(f)) hatalar.push(`geçersiz fotoğraf adresi: ${f.slice(0, 80)}`);
    }
  }
  if (var_("sergi")) eser.sergi = kirp(veri.sergi, 200) || null;
  return { hatalar, eser };
}

/**
 * Uzman düzenleme önerisinin ek alanları. Düzenleme önerisi en az bir alanı değiştirmeli ve
 * eklenen bilginin kaynağını (kitap, cilt, sayfa, kitabe, kurum…) taşımalı; öneren adı isteğe bağlı.
 * @returns {{ hatalar: string[], kaynak: string | null, oneren: string | null }}
 */
export function oneriEkiDogrula(tur, govde = {}, temizVeri = null) {
  const hatalar = [];
  const kaynak = kirp(govde.kaynak, 240) || null, oneren = kirp(govde.oneren, 80) || null;
  if (tur === "duzenle") {
    if (!temizVeri || !Object.keys(temizVeri).length) hatalar.push("düzenleme önerisinde en az bir alan değişmeli");
    if (!kaynak || kaynak.length < 3) hatalar.push("eklenen bilginin kaynağı zorunlu (ör. kitap, cilt, sayfa ya da kitabe)");
  }
  return { hatalar, kaynak, oneren };
}

export const TEMEL_ALANLAR = ["ad", "tur", "il", "ilce", "yuzyil", "konum", "adres", "tarihce"];
export const EK_ALANLAR = ["fotograf", "ad_en", "tarihce_en"];
const dolu = (x) => typeof x === "string" ? x.trim().length > 0 : x != null;
const ALAN_VAR = {
  ad: (e) => dolu(e.ad), tur: (e) => dolu(e.tur), il: (e) => dolu(e.il), ilce: (e) => dolu(e.ilce),
  yuzyil: (e) => Number.isInteger(e.yuzyil),
  konum: (e) => Number.isFinite(e.konum?.lat) && Number.isFinite(e.konum?.lng),
  adres: (e) => dolu(e.adres), tarihce: (e) => dolu(e.tarihce?.tr),
  fotograf: (e) => Array.isArray(e.fotograflar) && e.fotograflar.length > 0,
  ad_en: (e) => dolu(e.ad_en), tarihce_en: (e) => dolu(e.tarihce?.en),
};
export const TUM_ALANLAR = [...TEMEL_ALANLAR, ...EK_ALANLAR];

/** @returns {{ eksikler: string[], tam: boolean, oran: number }} eksikler: eksik temel alanlar */
export function tamlik(e) {
  const eksikler = TEMEL_ALANLAR.filter((a) => !ALAN_VAR[a](e));
  return { eksikler, tam: eksikler.length === 0, oran: (TEMEL_ALANLAR.length - eksikler.length) / TEMEL_ALANLAR.length };
}
export const alanVar = (e, alan) => !!ALAN_VAR[alan]?.(e);

/**
 */
export function tamlikSuzgeci({ tam, eksik, gerekli, olmayan } = {}) {
  const liste = (x) => String(x ?? "").split(",").map((s) => s.trim()).filter((s) => ALAN_VAR[s]);
  const g = liste(gerekli), o = liste(olmayan);
  return (e) => {
    const t = tamlik(e);
    if (tam === "1" || tam === true) { if (!t.tam) return false; }
    if (eksik && ALAN_VAR[eksik]) {
      if (TEMEL_ALANLAR.includes(eksik)) { if (t.eksikler.length !== 1 || t.eksikler[0] !== eksik) return false; }
      else if (!t.tam || alanVar(e, eksik)) return false;
    }
    return g.every((a) => alanVar(e, a)) && o.every((a) => !alanVar(e, a));
  };
}

// ---------- Kalfa model seçimi ----------
export const KALFA_AYAR_ALANLARI = ["kalfaModeli", "dalisGorselModelleri", "dalisMetinModelleri"];
const MODEL_ADI = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;

/**
 * PUT /api/kalfa/ayarlar gövdesi. Her alan isteğe bağlıdır; null alanı siler (.env / varsayılan geçerli olur).
 * modeller verilirse her seçim o listede ve doğru türde olmalı (metin / görsel).
 * @returns {{ hatalar: string[], ayar: object }} ayar: yalnızca gönderilen alanlar
 */
export function kalfaAyarDogrula(veri, modeller = null) {
  const hatalar = [], ayar = {};
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["ayar verisi bir nesne olmalı"], ayar };
  const bilinmeyen = Object.keys(veri).filter((k) => !KALFA_AYAR_ALANLARI.includes(k));
  if (bilinmeyen.length) hatalar.push(`bilinmeyen alan: ${bilinmeyen.slice(0, 3).join(", ")}`);
  const kume = (tur) => new Set((modeller ?? []).filter((m) => m.tur === tur).map((m) => m.deger));
  const metinler = kume("metin"), gorseller = kume("gorsel");
  const listedeMi = (ad, kumesi, turAdi) => {
    if (modeller && !kumesi.has(ad)) hatalar.push(`${ad}: UstaGPT listesinde böyle bir ${turAdi} modeli yok`);
  };

  if (Object.hasOwn(veri, "kalfaModeli")) {
    const m = veri.kalfaModeli;
    if (m === null) ayar.kalfaModeli = null;
    else if (!metinMi(m) || !MODEL_ADI.test(m)) hatalar.push("kalfaModeli geçerli bir model adı olmalı");
    else { listedeMi(m, metinler, "metin"); ayar.kalfaModeli = m; }
  }
  for (const [alan, kumesi, turAdi] of [["dalisGorselModelleri", gorseller, "görsel"], ["dalisMetinModelleri", metinler, "metin"]]) {
    if (!Object.hasOwn(veri, alan)) continue;
    const l = veri[alan];
    if (l === null) { ayar[alan] = null; continue; }
    if (!Array.isArray(l) || l.length < 1 || l.length > 5) { hatalar.push(`${alan} 1–5 modelden oluşan bir liste olmalı`); continue; }
    if (!l.every((m) => metinMi(m) && MODEL_ADI.test(m))) { hatalar.push(`${alan} yalnızca geçerli model adları içermeli`); continue; }
    if (new Set(l).size !== l.length) { hatalar.push(`${alan} aynı modeli iki kez içeremez`); continue; }
    for (const m of l) listedeMi(m, kumesi, turAdi);
    ayar[alan] = [...l];
  }
  if (!hatalar.length && !Object.keys(ayar).length) hatalar.push(`en az bir alan gerekli: ${KALFA_AYAR_ALANLARI.join(", ")}`);
  return { hatalar, ayar };
}

// ---------- Hesaplar ----------
export const ROLLER = ["vatandas", "usta", "editor"];
export const PROFIL_RENKLERI = ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"];
const KULLANICI_ADI = /^[a-z0-9_.-]{3,32}$/;
export const kullaniciAdiDuzelt = (k) => String(k ?? "").toLocaleLowerCase("tr").trim();
export const kullaniciAdiGecerli = (k) => typeof k === "string" && KULLANICI_ADI.test(kullaniciAdiDuzelt(k));

/** Kayıt ve giriş gövdesi. Şifrenin üst sınırı scrypt'e dev girdi verilmesini önler. */
export function hesapGirdisiDogrula(veri, { kayit = false } = {}) {
  const hatalar = [];
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return ["gövde bir nesne olmalı"];
  if (!kullaniciAdiGecerli(veri.kimlik)) hatalar.push("Kullanıcı adı 3-32 karakter olmalı: küçük harf, rakam ya da . _ -");
  if (typeof veri.sifre !== "string" || veri.sifre.length > 200) hatalar.push("Şifre en çok 200 karakter olabilir");
  else if (kayit && veri.sifre.length < 8) hatalar.push("Şifre en az 8 karakter olmalı");
  if (kayit && veri.rol != null && !ROLLER.includes(veri.rol)) hatalar.push(`rol: ${ROLLER.join(" | ")}`);
  return hatalar;
}
