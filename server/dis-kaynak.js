// Dış kaynak (yalnızca admin kalfası): bilgi bankasında olmayan eserler için Vikipedi'den metin okunur.
// Kalfa okuduğu maddenin dışına çıkamasın diye sunucu her eklemede metni, yüzyılı ve kaynak bağlantısını okunan
// maddeyle karşılaştırır. Vikipedi içeriği "doğrulanmamış" sayılır: Vakıf Katılım envanteri gibi kurumsal bir
// kaynak değildir; eser kaydında ve modül kartında tik yerine "Kaynak doğrulanmamış: Vikipedi" görünür.

export const DIS_KAYNAK_ADI = "Vikipedi";
const DILLER = new Set(["tr", "en"]);
const MAKS_METIN = 9000;
const ZAMAN_ASIMI_MS = 20_000;

const vikiDili = (dil) => (DILLER.has(dil) ? dil : "tr");
const vikiAdresi = (dil) => `https://${vikiDili(dil)}.wikipedia.org/w/api.php`;

async function vikiApi(fetchFn, dil, parametreler) {
  const q = new URLSearchParams({ ...parametreler, format: "json", formatversion: "2" });
  let y;
  try {
    y = await fetchFn(`${vikiAdresi(dil)}?${q}`, { headers: { "User-Agent": "lonca-kalfa/1.0 (Lonca vakif mirasi platformu)" }, signal: AbortSignal.timeout(ZAMAN_ASIMI_MS) });
  } catch (h) {
    throw new Error(`Vikipedi'ye ulaşılamadı: ${h.cause?.code ?? h.message}`);
  }
  if (!y.ok) throw new Error(`Vikipedi hata verdi (${y.status})`);
  return y.json();
}

const etiketsiz = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();

// Madde araması: başlık, kısa parça ve adres (en çok 8).
export async function vikipediAra({ sorgu, dil = "tr" } = {}, fetchFn = fetch) {
  const s = String(sorgu ?? "").trim().slice(0, 200);
  if (!s) return { hata: "sorgu boş" };
  const d = vikiDili(dil);
  const j = await vikiApi(fetchFn, d, { action: "query", list: "search", srsearch: s, srlimit: "8" });
  const sonuclar = (j?.query?.search ?? []).map((x) => ({
    baslik: x.title, parca: etiketsiz(x.snippet).slice(0, 240), url: `https://${d}.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, "_"))}`,
  }));
  return { kaynak: DIS_KAYNAK_ADI, dil: d, bulunan: sonuclar.length, sonuclar };
}

// Bir maddenin düz metni (kaynakça ve dış bağlantılar atılır), kanonik adresi ve varsa koordinatı.
export async function vikipediOku({ baslik, dil = "tr" } = {}, fetchFn = fetch) {
  const b = String(baslik ?? "").trim().slice(0, 200);
  if (!b) return null;
  const d = vikiDili(dil);
  const j = await vikiApi(fetchFn, d, { action: "query", prop: "extracts|coordinates|info", inprop: "url", explaintext: "1", redirects: "1", titles: b });
  const sayfa = j?.query?.pages?.[0];
  if (!sayfa || sayfa.missing || !sayfa.extract) return null;
  const metin = sayfa.extract
    .replace(/\n==+ ?(Kaynakça|Kaynaklar|Dış bağlantılar|Galeri|Fotoğraflar|Ayrıca bakınız|Notlar|References|External links|See also|Notes|Further reading|Gallery) ?==+[\s\S]*?(?=\n== |$)/g, "")
    .trim().slice(0, MAKS_METIN);
  const k = sayfa.coordinates?.[0];
  return {
    kaynak: DIS_KAYNAK_ADI, dil: d, baslik: sayfa.title, url: sayfa.fullurl ?? `https://${d}.wikipedia.org/wiki/${encodeURIComponent(sayfa.title.replace(/ /g, "_"))}`,
    metin, konum: k && Number.isFinite(k.lat) && Number.isFinite(k.lon) ? { lat: k.lat, lng: k.lon } : null,
  };
}

// Bağlantı karşılaştırması: Vikipedi adresleri kodlamadan ve alt çizgi/boşluk farkından bağımsız.
export function adresAnahtari(url) {
  try {
    const u = new URL(String(url));
    if (!/(^|\.)wikipedia\.org$/i.test(u.hostname)) return u.href;
    const dil = u.hostname.split(".")[0].toLowerCase();
    const baslik = decodeURIComponent(u.pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ").trim().toLocaleLowerCase("tr");
    return `viki:${dil}:${baslik}`;
  } catch { return String(url); }
}

// Koddaki Vikipedi bağlantıları (modülün dış kaynağı).
export function koddakiDisBaglantilar(kod) {
  return [...new Set([...String(kod ?? "").matchAll(/https?:\/\/[a-z-]{2,12}(?:\.m)?\.wikipedia\.org\/wiki\/[^\s"'`)<>\]]+/gi)].map((m) => m[0]))];
}

const kelimeler = (s) => String(s ?? "").toLocaleLowerCase("tr").normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((k) => k.length >= 4);

// Uydurma denetimi: kalfanın yazdığı metnin anlamlı kelimelerinin büyük kısmı okunan maddede geçmeli,
// metindeki her yıl da maddede aynen bulunmalı. Dönüş: hata listesi (boşsa geçti).
export function kaynaktaDayanakVar(metin, kaynakMetni, { esik = 0.7 } = {}) {
  const hatalar = [];
  const k = kelimeler(metin);
  if (!k.length) return ["metin boş"];
  const havuz = new Set(kelimeler(kaynakMetni));
  // Türkçe ekler yüzünden kelime kökü (ilk 5 harf) de eşleşme sayılır.
  const kokler = new Set([...havuz].map((x) => x.slice(0, 5)));
  const eslesen = k.filter((x) => havuz.has(x) || kokler.has(x.slice(0, 5))).length;
  if (eslesen / k.length < esik) hatalar.push(`metnin yalnızca %${Math.round((eslesen / k.length) * 100)}'i okunan maddede geçiyor; yalnızca maddedeki bilgiyi, maddedeki ifadelere yakın yaz`);
  const kaynakYillari = new Set(String(kaynakMetni ?? "").match(/\b1\d{3}\b|\b20\d{2}\b/g) ?? []);
  for (const yil of new Set(String(metin ?? "").match(/\b1\d{3}\b|\b20\d{2}\b/g) ?? [])) {
    if (!kaynakYillari.has(yil)) hatalar.push(`${yil} yılı okunan maddede geçmiyor`);
  }
  return hatalar;
}

// Yüzyıl yalnızca maddede açıkça geçiyorsa: "15. yüzyıl" / "15th century" ya da o yüzyıla düşen bir yıl.
export function yuzyilKaynaktaVar(yuzyil, kaynakMetni) {
  const y = Number(yuzyil);
  if (!Number.isInteger(y)) return false;
  const m = String(kaynakMetni ?? "");
  if (new RegExp(`\\b${y}\\.\\s*(yüzyıl|yy)`, "i").test(m) || new RegExp(`\\b${y}(st|nd|rd|th)[ -]century`, "i").test(m)) return true;
  return (m.match(/\b1\d{3}\b/g) ?? []).some((x) => Math.floor((Number(x) - 1) / 100) + 1 === y);
}

// Modülün doğrulama durumu: dış kaynaklı içerik (koddaki Vikipedi bağlantıları, kalfanın kullandığı dış kaynaklar)
// ya da doğrulanmamış bir bilgi bankası kaydı (eserler.getir ile) varsa modül doğrulanmış sayılmaz.
export function modulDogrulamasi({ kod, eserler = [], disKaynaklar = [] }) {
  const kaynaklar = new Set();
  if (koddakiDisBaglantilar(kod).length) kaynaklar.add(DIS_KAYNAK_ADI);
  for (const d of disKaynaklar) kaynaklar.add(d?.kaynak || DIS_KAYNAK_ADI);
  for (const [, id] of String(kod ?? "").matchAll(/\beserler\.getir\(\s*["'`]([^"'`]*)["'`]/g)) {
    const e = eserler.find((x) => x.id === id);
    if (e && e.dogrulanmis === false) kaynaklar.add(e.kaynakTuru || DIS_KAYNAK_ADI);
  }
  return { dogrulanmis: kaynaklar.size === 0, kaynaklar: [...kaynaklar] };
}
