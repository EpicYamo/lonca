

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
  // Doğrulama: Vakıf Katılım envanteri dışındaki (ör. Vikipedi) kayıtlar "dogrulanmis: false" ve kaynak bağlantısı taşır.
  // Alan yoksa kayıt doğrulanmış sayılır (eski kayıtlar). Doğrulanmamış kayıtta kaynak bağlantısı zorunludur.
  if (Object.hasOwn(veri, "dogrulanmis")) {
    if (typeof veri.dogrulanmis !== "boolean") hatalar.push("dogrulanmis: true | false");
    else eser.dogrulanmis = veri.dogrulanmis;
  }
  if (Object.hasOwn(veri, "kaynakTuru")) eser.kaynakTuru = kirp(veri.kaynakTuru, 40) || null;
  if (Object.hasOwn(veri, "kaynakUrl")) {
    eser.kaynakUrl = kirp(veri.kaynakUrl, 400) || null;
    if (eser.kaynakUrl && !/^https:\/\/[^\s"'<>]+$/i.test(eser.kaynakUrl)) hatalar.push("kaynakUrl: https ile başlayan bir bağlantı olmalı");
  }
  if (eser.dogrulanmis === false && !kismi && !eser.kaynakUrl) hatalar.push("doğrulanmamış kayıtta kaynak bağlantısı (kaynakUrl) zorunlu");
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
 * POST /api/kalfa/modeller/tara gövdesi: {} (tüm metin modelleri) ya da { modeller: ["ad", …] } (1–100 metin modeli).
 * modeller verilirse adlar UstaGPT listesindeki metin modelleriyle karşılaştırılır.
 */
export function kalfaTaramaDogrula(veri, modeller = null) {
  const hatalar = [];
  if (veri == null) veri = {};
  if (typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["tarama verisi bir nesne olmalı"], liste: null };
  const bilinmeyen = Object.keys(veri).filter((k) => k !== "modeller");
  if (bilinmeyen.length) hatalar.push(`bilinmeyen alan: ${bilinmeyen.slice(0, 3).join(", ")}`);
  if (veri.modeller == null) return { hatalar, liste: null };
  const l = veri.modeller;
  if (!Array.isArray(l) || l.length < 1 || l.length > 100) { hatalar.push("modeller 1–100 modelden oluşan bir liste olmalı"); return { hatalar, liste: null }; }
  if (!l.every((m) => metinMi(m) && MODEL_ADI.test(m))) { hatalar.push("modeller yalnızca geçerli model adları içermeli"); return { hatalar, liste: null }; }
  if (new Set(l).size !== l.length) hatalar.push("modeller aynı modeli iki kez içeremez");
  if (modeller) {
    const metinler = new Set(modeller.filter((m) => m.tur === "metin").map((m) => m.deger));
    for (const m of l) if (!metinler.has(m)) hatalar.push(`${m}: UstaGPT listesinde böyle bir metin modeli yok`);
  }
  return { hatalar, liste: [...l] };
}

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

// E-posta: kaba ama yeterli biçim denetimi; küçük harfe çevrilip saklanır (tekillik bununla denetlenir).
const EPOSTA = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export const epostaDuzelt = (e) => String(e ?? "").trim().toLowerCase();
export const epostaGecerli = (e) => typeof e === "string" && e.length <= 254 && EPOSTA.test(epostaDuzelt(e));

/**
 * Kayıt ve giriş gövdesi. Şifrenin üst sınırı scrypt'e dev girdi verilmesini önler.
 * Kayıt: { kimlik, eposta, sifre, sifreTekrar }. Giriş: { kimlik, sifre }; kimlik kullanıcı adı ya da e-posta olabilir.
 */
export function hesapGirdisiDogrula(veri, { kayit = false } = {}) {
  const hatalar = [];
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return ["gövde bir nesne olmalı"];
  const epostaylaGiris = !kayit && typeof veri.kimlik === "string" && veri.kimlik.includes("@");
  if (epostaylaGiris ? !epostaGecerli(veri.kimlik) : !kullaniciAdiGecerli(veri.kimlik)) hatalar.push("Kullanıcı adı 3-32 karakter olmalı: küçük harf, rakam ya da . _ -");
  if (kayit && !epostaGecerli(veri.eposta)) hatalar.push("Geçerli bir e-posta adresi yaz");
  if (typeof veri.sifre !== "string" || veri.sifre.length > 200) hatalar.push("Şifre en çok 200 karakter olabilir");
  else if (kayit && veri.sifre.length < 8) hatalar.push("Şifre en az 8 karakter olmalı");
  else if (kayit && veri.sifreTekrar !== veri.sifre) hatalar.push("Şifreler eşleşmiyor");
  if (kayit && veri.rol != null && !ROLLER.includes(veri.rol)) hatalar.push(`rol: ${ROLLER.join(" | ")}`);
  return hatalar;
}

/** Şifre değiştirme gövdesi: { eskiSifre?, yeniSifre }. */
export function sifreDegisimiDogrula(veri) {
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return ["gövde bir nesne olmalı"];
  const hatalar = [];
  if (typeof veri.yeniSifre !== "string" || veri.yeniSifre.length < 8) hatalar.push("Yeni şifre en az 8 karakter olmalı");
  else if (veri.yeniSifre.length > 200) hatalar.push("Şifre en çok 200 karakter olabilir");
  if (veri.eskiSifre != null && (typeof veri.eskiSifre !== "string" || veri.eskiSifre.length > 200)) hatalar.push("Mevcut şifre geçersiz");
  return hatalar;
}

/** Şifre sıfırlama gövdesi: { jeton, yeniSifre, yeniSifreTekrar }. */
export function sifreSifirlamaDogrula(veri) {
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return ["gövde bir nesne olmalı"];
  const hatalar = [];
  if (typeof veri.jeton !== "string" || !veri.jeton || veri.jeton.length > 200) hatalar.push("Bağlantı geçersiz ya da süresi dolmuş; yeniden iste.");
  if (typeof veri.yeniSifre !== "string" || veri.yeniSifre.length < 8) hatalar.push("Yeni şifre en az 8 karakter olmalı");
  else if (veri.yeniSifre.length > 200) hatalar.push("Şifre en çok 200 karakter olabilir");
  else if (veri.yeniSifreTekrar !== veri.yeniSifre) hatalar.push("Şifreler eşleşmiyor");
  return hatalar;
}

// Studio atölye oturumu (server/atolye.js): editördeki modül taslağı ve kalfaya giden istek.
export const ATOLYE_TASLAK_ALANLARI = ["kod", "ad", "id", "aciklama", "renk", "ikon", "kategori"];
export const ATOLYE_MAKS_KOD = 150_000;
export const atolyeKimligiGecerli = (id) => typeof id === "string" && /^[a-f0-9]{12}$/.test(id);
export function atolyeTaslakDogrula(veri) {
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["taslak bir nesne olmalı"], taslak: null };
  const hatalar = [], taslak = {};
  const bilinmeyen = Object.keys(veri).filter((k) => !ATOLYE_TASLAK_ALANLARI.includes(k));
  if (bilinmeyen.length) hatalar.push(`bilinmeyen alan: ${bilinmeyen.slice(0, 3).join(", ")}`);
  for (const alan of ATOLYE_TASLAK_ALANLARI) {
    const d = veri[alan] ?? "";
    const sinir = alan === "kod" ? ATOLYE_MAKS_KOD : alan === "aciklama" ? 1000 : 200;
    if (typeof d !== "string") hatalar.push(`${alan} metin olmalı`);
    else if (d.length > sinir) hatalar.push(`${alan} en fazla ${sinir} karakter olabilir`);
    else taslak[alan] = d;
  }
  return { hatalar, taslak: hatalar.length ? null : taslak };
}
export function atolyeIstekDogrula({ istek, kod, dil } = {}) {
  const hatalar = [];
  if (dil != null && dil !== "tr" && dil !== "en") hatalar.push("dil: tr | en");
  if (typeof istek !== "string" || !istek.trim()) hatalar.push("istek: kalfaya ne istediğini yaz");
  else if (istek.length > 4000) hatalar.push("istek en fazla 4000 karakter olabilir");
  if (kod != null && (typeof kod !== "string" || kod.length > ATOLYE_MAKS_KOD)) hatalar.push("kod çok uzun");
  return hatalar;
}

// Modül görünürlüğü: "herkes" (onaydan geçip uygulamada yayımlanır) ya da "ozel" (yalnızca paylaşım bağlantısıyla açılır).
export const MODUL_GORUNURLUKLERI = ["herkes", "ozel"];
export const modulGorunurlukDogrula = (g) =>
  g == null || MODUL_GORUNURLUKLERI.includes(g) ? null : `gorunurluk: ${MODUL_GORUNURLUKLERI.join(" | ")}`;
// Paylaşım bağlantısındaki anahtar: modül kimliği ya da base64url anahtar.
export const paylasimAnahtariGecerli = (a) => typeof a === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(a);

// Davet kodu: karıştırılan harfler (0/O, 1/I/L) olmadan 8 karakter, "ABCD-EFGH" biçiminde gösterilir.
const DAVET_ABECESI = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// Bu dosya Android paketinde tarayıcıda da yüklenir (mobil/hazirla.mjs); node:crypto yerine Web Crypto.
// 31 karakterlik abecede 256 % 31 sapması küçük; reddederek düzgün dağılım sağlanır.
const rastgeleSayi = (n) => { const b = new Uint8Array(1); do globalThis.crypto.getRandomValues(b); while (b[0] >= 256 - (256 % n)); return b[0] % n; };
export function davetKoduUret(rastgele = rastgeleSayi) {
  let k = "";
  for (let i = 0; i < 8; i++) k += DAVET_ABECESI[rastgele(DAVET_ABECESI.length)];
  return `${k.slice(0, 4)}-${k.slice(4)}`;
}
// Kullanıcının yazdığını kanonik biçime çevirir (küçük harf, boşluk, tire serbest); geçersizse null.
export function davetKoduCoz(girdi) {
  const k = String(girdi ?? "").toUpperCase().replace(/[\s-]/g, "");
  return k.length === 8 && [...k].every((c) => DAVET_ABECESI.includes(c)) ? `${k.slice(0, 4)}-${k.slice(4)}` : null;
}

// Ustanın kalfa sohbetinden admin'e gönderdiği eser isteği: yalnızca ad, il ve not (tarihî bilgi değil).
export function eserIstegiDogrula(veri) {
  const hatalar = [];
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["istek: { ad, il?, not? } olmalı"], istek: null };
  const istek = { ad: kirp(veri.ad, 120), il: kirp(veri.il, 40) || null, not: kirp(veri.not, 600) || null };
  if (istek.ad.length < 2) hatalar.push("istenen eserin adı en az 2 karakter olmalı");
  return { hatalar, istek: hatalar.length ? null : istek };
}

// Kalfa izin kartındaki yanıt: { id, karar }. Dış kaynak/kayıt kartlarını admin, genişletilmiş mod kartını (ac | standart) usta da yanıtlar.
export function izinKarariDogrula(izin) {
  if (izin == null) return [];
  if (typeof izin !== "object" || Array.isArray(izin)) return ["izin: { id, karar } olmalı"];
  const hatalar = [];
  if (typeof izin.id !== "string" || !/^[a-f0-9-]{4,40}$/.test(izin.id)) hatalar.push("izin.id geçersiz");
  if (!["ver", "reddet", "bilgi-bankasi", "modul", "ac", "standart"].includes(izin.karar)) hatalar.push("izin.karar: ver | reddet | bilgi-bankasi | modul | ac | standart");
  return hatalar;
}
