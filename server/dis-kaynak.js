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
  // 429 (hız sınırı) gelirse bir kez, kısa bir beklemeden sonra yeniden denenir.
  for (let deneme = 0; deneme < 2; deneme++) {
    try {
      y = await fetchFn(`${vikiAdresi(dil)}?${q}`, { headers: { "User-Agent": "lonca-kalfa/1.0 (Lonca vakif mirasi platformu)" }, signal: AbortSignal.timeout(ZAMAN_ASIMI_MS) });
    } catch (h) {
      throw new Error(`Vikipedi'ye ulaşılamadı: ${h.cause?.code ?? h.message}`);
    }
    if (y.status !== 429 || deneme) break;
    const bekle = Math.min(Number(y.headers?.get?.("retry-after")) || 1, 3) * 1000;
    await new Promise((r) => setTimeout(r, bekle));
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

const maddeAdresi = (d, baslik) => `https://${d}.wikipedia.org/wiki/${encodeURIComponent(baslik.replace(/ /g, "_"))}`;
const kategoriOneki = (d) => (d === "en" ? "Category" : "Kategori");

// Kategori üyeleri: maddeler (ad alanı 0) ve alt kategoriler (önek olmadan).
async function kategoriUyeleri(fetchFn, d, ad) {
  const j = await vikiApi(fetchFn, d, {
    action: "query", list: "categorymembers", cmtitle: `${kategoriOneki(d)}:${ad}`, cmtype: "page|subcat", cmlimit: "50",
  });
  const uyeler = j?.query?.categorymembers ?? [];
  return {
    maddeler: uyeler.filter((x) => x.ns === 0).map((x) => ({ baslik: x.title, url: maddeAdresi(d, x.title) })),
    altlar: uyeler.filter((x) => x.ns === 14).map((x) => x.title.replace(/^[^:]+:/, "")),
  };
}

// Bir Vikipedi kategorisindeki maddeler (alt kategoriler değil): başlık ve adres (en çok 50).
export async function vikipediKategori({ kategori, dil = "tr" } = {}, fetchFn = fetch) {
  const d = vikiDili(dil);
  const ad = String(kategori ?? "").trim().replace(/^(Kategori|Category):/i, "").slice(0, 200);
  if (!ad) return [];
  return (await kategoriUyeleri(fetchFn, d, ad)).maddeler;
}

// Türkçe bulunma eki + "-ki" (ünlü uyumu ve sertleşme): İzmir'deki, Bursa'daki, Sinop'taki, Kars'taki.
export function bulunmaEki(ad) {
  const s = String(ad ?? "").trim();
  const kucuk = s.toLocaleLowerCase("tr");
  const unlu = [...kucuk].reverse().find((h) => "aeıioöuü".includes(h));
  const ince = unlu ? "eiöü".includes(unlu) : true;
  const sert = "fstkçşhp".includes(kucuk.at(-1));
  return `${s}'${sert ? "t" : "d"}${ince ? "e" : "a"}ki`;
}

// İl düzeyinde aranacak yapı türleri: [Türkçe kategori çoğulu, İngilizce kategori çoğulu, aramada kullanılan sözcük].
const KATEGORI_TURLERI = {
  cami: ["camiler", "Mosques", "cami"], mescit: ["mescitler", null, "mescit"], medrese: ["medreseler", "Madrasas", "medrese"],
  han: ["hanlar", "Caravanserais", "han"], hamam: ["hamamlar", "Hammams", "hamam"], cesme: ["çeşmeler", "Fountains", "çeşme"],
  turbe: ["türbeler", "Mausoleums", "türbe"], kulliye: ["külliyeler", null, "külliye"], kopru: ["köprüler", "Bridges", "köprü"],
  tekke: ["tekkeler", null, "tekke"], carsi: ["çarşılar", "Bazaars", "çarşı"], kutuphane: ["kütüphaneler", "Libraries", "kütüphane"],
};
const VARSAYILAN_TURLER = ["cami", "han", "hamam", "turbe", "cesme", "medrese"];
const MAKS_LISTE = 30;
const MAKS_ALT_KATEGORI = 16;

// Hangi kategoriler var ve dolu: tek istekte en çok 50 başlık (Vikipedi'yi her aday için ayrı yormamak için).
async function doluKategoriler(fetchFn, d, adlar) {
  const dolu = new Set();
  for (let i = 0; i < adlar.length; i += 50) {
    const parca = adlar.slice(i, i + 50);
    const j = await vikiApi(fetchFn, d, { action: "query", prop: "categoryinfo", titles: parca.map((k) => `${kategoriOneki(d)}:${k}`).join("|") });
    for (const p of j?.query?.pages ?? []) {
      if (!p.missing && (p.categoryinfo?.pages > 0 || p.categoryinfo?.subcats > 0)) dolu.add(p.title.replace(/^[^:]+:/, ""));
    }
  }
  return adlar.filter((k) => dolu.has(k));
}

// Bir il ya da bölgedeki tarihî yapıların Vikipedi maddeleri. Olası kategori adları denenir ("İzmir'deki camiler",
// "İzmir ilindeki camiler", "İzmir'deki tarihî yapılar"…); il kategorileri çoğu zaman ilçe alt kategorilerine bölündüğü
// için ("Konak'taki camiler") aynı türün alt kategorilerine bir düzey inilir. Ardından metin araması eklenir.
// İstekler sırayla gider (Vikipedi hız sınırı). Birleşik, tekrarsız en çok 30 madde.
export async function vikipediIlListesi({ il, tur, dil = "tr" } = {}, fetchFn = fetch) {
  const ad = String(il ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (ad.length < 2) return { hata: "il boş" };
  const d = vikiDili(dil);
  const turler = (KATEGORI_TURLERI[tur] ? [tur] : VARSAYILAN_TURLER).filter((t) => d === "tr" || KATEGORI_TURLERI[t][1]);
  const cogulu = new Map(); // kategori adı → tür çoğulu (alt kategori süzgeci)
  for (const t of turler) {
    const [tr, en] = KATEGORI_TURLERI[t];
    if (d === "en") { cogulu.set(`${en} in ${ad}`, en); cogulu.set(`${en} in ${ad} Province`, en); }
    else { cogulu.set(`${bulunmaEki(ad)} ${tr}`, tr); cogulu.set(`${ad} ilindeki ${tr}`, tr); }
  }
  if (d === "en") cogulu.set(`Buildings and structures in ${ad}`, null);
  else { cogulu.set(`${bulunmaEki(ad)} tarihî yapılar`, null); cogulu.set(`${ad} ilindeki tarihî yapılar`, null); }

  const bos = { maddeler: [], altlar: [] };
  const uyeleri = async (k) => ({ k, ...(await kategoriUyeleri(fetchFn, d, k).catch(() => bos)) });
  const ilk = [];
  for (const k of await doluKategoriler(fetchFn, d, [...cogulu.keys()])) ilk.push(await uyeleri(k));
  // Aynı türün alt kategorileri (ör. "İzmir ilindeki camiler" → "Konak'taki camiler").
  const altAdaylar = [...new Set(ilk.flatMap((x) => {
    const c = cogulu.get(x.k)?.toLocaleLowerCase("tr");
    return c ? x.altlar.filter((a) => a.toLocaleLowerCase("tr").endsWith(` ${c}`)) : [];
  }))].filter((a) => !cogulu.has(a)).slice(0, MAKS_ALT_KATEGORI);
  const alt = [];
  for (const k of altAdaylar) alt.push(await uyeleri(k));
  const ara = [];
  for (const t of KATEGORI_TURLERI[tur] ? [tur] : ["cami", "han"]) {
    const sorgu = d === "en" ? `${ad} historic ${KATEGORI_TURLERI[t][1] ?? t}` : `${ad} ${KATEGORI_TURLERI[t][2]} tarihi`;
    ara.push(await vikipediAra({ sorgu, dil: d }, fetchFn).catch(() => ({ sonuclar: [] })));
  }

  const sonuclar = [], gorulen = new Set();
  const ekle = (m, nereden) => {
    const anahtar = m.baslik.toLocaleLowerCase("tr");
    if (gorulen.has(anahtar) || sonuclar.length >= MAKS_LISTE) return;
    gorulen.add(anahtar);
    sonuclar.push({ baslik: m.baslik, url: m.url, nereden });
  };
  // Kategoriler arasında dengeli: her kategoriden sırayla birer madde (liste yalnızca camilerle dolmasın).
  const kategoriler = [...ilk, ...alt].filter((x) => x.maddeler.length);
  for (let i = 0; sonuclar.length < MAKS_LISTE && kategoriler.some((x) => x.maddeler[i]); i++) {
    for (const x of kategoriler) if (x.maddeler[i]) ekle(x.maddeler[i], `Kategori: ${x.k}`);
  }
  for (const a of ara) for (const m of a.sonuclar ?? []) ekle(m, "arama");
  return { kaynak: DIS_KAYNAK_ADI, dil: d, il: ad, kategoriler: kategoriler.map((x) => x.k), bulunan: sonuclar.length, sonuclar };
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
