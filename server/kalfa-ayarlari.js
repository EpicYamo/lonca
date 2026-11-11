// Kalfaların sağlayıcı ve model seçimi tek yerde.
//
// Birincil sağlayıcı UstaGPT'dir (OpenAI uyumlu; USTAGPT_BASE_URL + USTAGPT_API_KEY). Modül kalfası KALFA_*,
// dalış kalfası DALIS_* ile başka bir uç noktaya yönlendirilebilir; boş bırakılırsa ikisi de UstaGPT'yi kullanır.
//
// Studio'da seçilen modeller data/kalfa-ayarlari.json'a yazılır (çalışma verisi, gitignore'da) ve .env'deki
// model değerlerini geçersiz kılar. Seçim yalnızca ilgili kalfa UstaGPT'ye bağlıyken uygulanır (liste oradan gelir).
// Dosya her istekte yeniden okunur; sunucuyu yeniden başlatmak gerekmez.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** ortam nesnesinde ayar dosyasının yolunu taşıyan anahtar (bir ortam değişkeni değildir). */
export const AYAR_DOSYASI = Symbol("kalfa-ayar-dosyasi");
const VARSAYILAN_DOSYA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "kalfa-ayarlari.json");

// Varsayılanlar UstaGPT /models listesinde bulunan modellerden seçildi. Modül kalfası için gerçek kalfa
// taramasında (araclar/kalfa-model-tara.mjs) en hızlı ve tutarlı çalışan model. Dalış metin modelleri fotoğraf da
// okur; deepseek-v4-flash görsel girdiyi kabul etmediği için orada kullanılmaz.
export const VARSAYILAN = Object.freeze({
  kalfaModeli: "deepseek-v4-flash",
  dalisGorselModelleri: ["sohbet:gemini-3.1-flash-image", "nano-banana-2"],
  dalisMetinModelleri: ["gemini-3.5-flash", "gpt-6.1-sol"],
});
export const ANTHROPIC_VARSAYILAN = "claude-sonnet-5-5";

const adres = (u) => String(u ?? "").trim().replace(/\/+$/, "");
const liste = (s) => (s ? String(s).split(",").map((x) => x.trim()).filter(Boolean) : []);

export function ayarDosyasi(ortam = process.env) {
  return ortam[AYAR_DOSYASI] || VARSAYILAN_DOSYA;
}

/** Studio'da kaydedilmiş seçim ({} olabilir). Bozuk ya da eksik dosya seçimsiz sayılır. */
export function secimOku(ortam = process.env) {
  try {
    const j = JSON.parse(readFileSync(ayarDosyasi(ortam), "utf8"));
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  } catch { return {}; }
}

/** UstaGPT bağlantısı; tanımlı değilse null. */
export function ustagpt(ortam = process.env) {
  const url = adres(ortam.USTAGPT_BASE_URL);
  return url && ortam.USTAGPT_API_KEY ? { url, anahtar: ortam.USTAGPT_API_KEY } : null;
}

/** Modül kalfasının sağlayıcısı: { tur: "openai-uyumlu" | "anthropic" | "sahte", url?, anahtar?, model?, ustagpt? } */
export function kalfaSaglayicisi(ortam = process.env, secim = secimOku(ortam)) {
  if (ortam.KALFA_SAHTE === "1") return { tur: "sahte" };
  const usta = ustagpt(ortam);
  const tur = ortam.KALFA_SAGLAYICI ||
    (usta || ortam.KALFA_API_URL ? "openai-uyumlu" : ortam.ANTHROPIC_API_KEY ? "anthropic" : "sahte");
  if (tur === "sahte") return { tur };
  if (tur === "anthropic") {
    if (!ortam.ANTHROPIC_API_KEY) throw new Error("KALFA_SAGLAYICI=anthropic için ANTHROPIC_API_KEY gerekli");
    return { tur, model: ortam.KALFA_MODEL || ANTHROPIC_VARSAYILAN, ustagpt: false };
  }
  if (tur === "openai-uyumlu") {
    const url = adres(ortam.KALFA_API_URL) || usta?.url || "";
    const ustagptMi = !!usta && url === usta.url;
    const anahtar = ortam.KALFA_API_ANAHTARI || (ustagptMi ? usta.anahtar : "");
    const model = (ustagptMi && secim.kalfaModeli) || ortam.KALFA_MODEL || (ustagptMi ? VARSAYILAN.kalfaModeli : "");
    if (!url || !model) throw new Error("Modül kalfası için USTAGPT_BASE_URL + USTAGPT_API_KEY (ya da KALFA_API_URL ve KALFA_MODEL) gerekli");
    return { tur, url, anahtar, model, ustagpt: ustagptMi };
  }
  throw new Error(`Bilinmeyen KALFA_SAGLAYICI: ${tur}`);
}

/** Dalış kalfasının uç noktası ve modelleri. */
export function dalisSaglayicisi(ortam = process.env, secim = secimOku(ortam)) {
  const usta = ustagpt(ortam);
  const api = adres(ortam.DALIS_API_URL) || usta?.url || "";
  const ustagptMi = !!usta && api === usta.url;
  const anahtar = ortam.DALIS_API_ANAHTARI || (ustagptMi ? usta.anahtar : "") || "";
  const sec = (alan, ortamDegeri) => {
    const s = ustagptMi && Array.isArray(secim[alan]) && secim[alan].length ? secim[alan] : null;
    return s ?? (liste(ortamDegeri).length ? liste(ortamDegeri) : [...VARSAYILAN[alan]]);
  };
  return {
    api, anahtar, ustagpt: ustagptMi,
    modeller: sec("dalisGorselModelleri", ortam.DALIS_MODELLER),
    metinModelleri: sec("dalisMetinModelleri", ortam.DALIS_METIN_MODELLERI),
  };
}

/** Şu an etkin olan seçim (Studio'da gösterilir). */
export function etkinSecim(ortam = process.env) {
  const secim = secimOku(ortam);
  let kalfa;
  try { kalfa = kalfaSaglayicisi(ortam, secim); } catch (h) { kalfa = { tur: "hata", hata: h.message }; }
  const dalis = dalisSaglayicisi(ortam, secim);
  return {
    kalfaModeli: kalfa.model ?? null,
    dalisGorselModelleri: dalis.modeller,
    dalisMetinModelleri: dalis.metinModelleri,
    kalfa: { saglayici: kalfa.tur, ustagpt: !!kalfa.ustagpt, ...(kalfa.hata && { hata: kalfa.hata }) },
    dalis: { ustagpt: dalis.ustagpt, hazir: !!(dalis.api && dalis.anahtar) },
    kayitli: secim,
  };
}

/**
 * UstaGPT model listesini sınıflandırır:
 *   metin  → /chat/completions ile konuşan dil modelleri (kalfa ve dalış planı)
 *   gorsel → /images/* uçları olanlar (deger: model adı) ya da sohbetle görsel üreten "-image" modelleri (deger: "sohbet:<ad>")
 * Ses ve gömme (embedding) modelleri listelenmez.
 */
export function modelleriSiniflandir(veri) {
  const ham = Array.isArray(veri?.data) ? veri.data : Array.isArray(veri) ? veri : [];
  const sonuc = [];
  for (const m of ham) {
    if (!m || typeof m.id !== "string") continue;
    const uclar = Array.isArray(m.endpoints) ? m.endpoints : [];
    const sohbet = uclar.some((u) => /\/chat\/completions$/.test(u));
    const gorselUcu = uclar.some((u) => /\/images\/(generations|edits)$/.test(u));
    let tur = null, deger = m.id;
    if (gorselUcu) tur = "gorsel";
    else if (sohbet && /-image$/.test(m.id)) { tur = "gorsel"; deger = `sohbet:${m.id}`; }
    else if (sohbet) tur = "metin";
    if (!tur) continue;
    sonuc.push({ id: m.id, deger, tur, sahip: m.owned_by ?? null, baglam: m.context_window ?? null, fiyat: m.pricing ?? null });
  }
  return sonuc;
}

/** UstaGPT /models çağrısını kısa süre önbelleğe alan katalog. Anahtar sunucuda kalır. */
export function modelKatalogu({ ortam = process.env, sure = 5 * 60_000 } = {}) {
  let onbellek = null; // { zaman, url, modeller }
  return {
    async liste({ yenile = false } = {}) {
      const usta = ustagpt(ortam);
      if (!usta) throw Object.assign(new Error("Model listesi için .env'de USTAGPT_BASE_URL ve USTAGPT_API_KEY gerekli"), { kod: 503 });
      if (!yenile && onbellek && onbellek.url === usta.url && Date.now() - onbellek.zaman < sure) return onbellek;
      let y;
      try {
        y = await fetch(`${usta.url}/models`, {
          headers: { authorization: `Bearer ${usta.anahtar}`, "user-agent": "lonca-kalfa/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (h) {
        throw Object.assign(new Error(`UstaGPT'ye ulaşılamadı: ${h.name === "TimeoutError" ? "zaman aşımı" : h.message}`), { kod: 502 });
      }
      if (!y.ok) throw Object.assign(new Error(`UstaGPT model listesi alınamadı (${y.status})`), { kod: 502 });
      const modeller = modelleriSiniflandir(await y.json().catch(() => null));
      if (!modeller.length) throw Object.assign(new Error("UstaGPT boş model listesi döndürdü"), { kod: 502 });
      onbellek = { zaman: Date.now(), url: usta.url, modeller };
      return onbellek;
    },
  };
}
