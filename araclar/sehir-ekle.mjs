#!/usr/bin/env node
// Adds selected heritage works from other Turkish cities to data/eserler.json.
// Text and lead image come from Turkish Wikipedia (CC BY-SA); coordinates come
// from the page when available, otherwise from the manual override below.
//
//   node araclar/sehir-ekle.mjs
//
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERI = path.join(KOK, "data", "eserler.json");
const FOTO_DIZINI = path.join(KOK, "public", "medya", "eserler");
const UA = "Lonca/0.1 (KOK&KOD hackathon; heritage data)";
const BEKLE = (ms) => new Promise((r) => setTimeout(r, ms));

const ESERLER = [
  { id: "izmir-hisar-camii", il: "İzmir", ilce: "Konak", ad: "Hisar Camii", ad_en: "Hisar Mosque", tur: "cami", yuzyil: 16, wiki: "Hisar Camii", ek: "Kemeraltı'nın kalbinde, Hisarönü meydanındadır; adını verdiği çarşı dokusunun merkezindedir." },
  { id: "izmir-sadirdanalti-camii", il: "İzmir", ilce: "Konak", ad: "Şadırvanaltı Camii", ad_en: "Şadırvanaltı Mosque", tur: "cami", yuzyil: 17, wiki: "Şadırvanaltı Camii", ek: "Kemeraltı Çarşısı içinde, avlusundaki şadırvanıyla anılan Osmanlı mahalle camisidir." },
  { id: "izmir-kestanepazari-camii", il: "İzmir", ilce: "Konak", ad: "Kestanepazarı Camii", ad_en: "Kestanepazarı Mosque", tur: "cami", yuzyil: 17, wiki: "Kestanepazarı Camii", ek: "Kemeraltı'nın Kestanepazarı bölgesine adını veren cami, İzmir'in tarihî ticaret dokusunun parçasıdır." },
  { id: "izmir-kizlaragasi-hani", il: "İzmir", ilce: "Konak", ad: "Kızlarağası Hanı", ad_en: "Kızlarağası Inn", tur: "han", yuzyil: 18, wiki: "Kızlarağası Hanı", ek: "Hacı Beşir Ağa'nın 1744'te yaptırdığı han, avlulu Osmanlı kervansaray geleneğinin İzmir'deki önemli örneğidir." },
  { id: "izmir-konak-camii", il: "İzmir", ilce: "Konak", ad: "Konak (Yalı) Camii", ad_en: "Konak Mosque", tur: "cami", yuzyil: 18, wiki: "Konak Camii", ek: "Konak Meydanı'nda, Saat Kulesi'nin yanında yer alır; sekizgen planı ve tek kubbesiyle geç Osmanlı mimarisini temsil eder." },

  { id: "mardin-ulu-camii", il: "Mardin", ilce: "Artuklu", ad: "Mardin Ulu Camii", ad_en: "Great Mosque of Mardin", tur: "cami", yuzyil: 12, wiki: "Mardin Ulu Camii", ek: "Artuklu döneminden kalan caminin dilimli kubbesi ve taş işçiliği, Mardin mimarisinin sonraki yüzyıllarına örnek olmuştur." },
  { id: "mardin-zinciriye-medresesi", il: "Mardin", ilce: "Artuklu", ad: "Zinciriye Medresesi", ad_en: "Zinciriye Madrasa", tur: "medrese", yuzyil: 14, wiki: "Zinciriye Medresesi (Mardin)", ek: "Sultan İsa Medresesi olarak da bilinir; 1385'te Artuklu Beyi Mecdüddin İsa tarafından yaptırılmıştır." },
  { id: "mardin-kasimiye-medresesi", il: "Mardin", ilce: "Artuklu", ad: "Kasımiye Medresesi", ad_en: "Kasımiye Madrasa", tur: "medrese", yuzyil: 15, wiki: "Kasımiye Medresesi", ek: "Akkoyunlu döneminde Kasım Bey tarafından başlatılmış, Mardin'in en büyük medrese komplekslerinden biri olarak tamamlanmıştır.", konum: { lat: 37.3125, lng: 40.7395 } },

  { id: "edirne-selimiye-camii", il: "Edirne", ilce: "Merkez", ad: "Selimiye Camii", ad_en: "Selimiye Mosque", tur: "cami", yuzyil: 16, wiki: "Selimiye Camii", ek: "Mimar Sinan'ın 80 yaşında tamamladığı ve 'ustalık eserim' dediği yapı, Osmanlı mimarisinin zirvesi kabul edilir." },
  { id: "edirne-eski-cami", il: "Edirne", ilce: "Merkez", ad: "Eski Cami", ad_en: "Old Mosque, Edirne", tur: "cami", yuzyil: 15, wiki: "Eski Cami", ek: "Emir Süleyman tarafından başlatılmış, Çelebi Mehmed döneminde tamamlanmıştır; erken Osmanlı çok kubbeli ulucami geleneğinin önemli örneğidir." },
  { id: "edirne-uc-serefeli-cami", il: "Edirne", ilce: "Merkez", ad: "Üç Şerefeli Cami", ad_en: "Üç Şerefeli Mosque", tur: "cami", yuzyil: 15, wiki: "Üç Şerefeli Cami", ek: "II. Murad tarafından 1437-1447 arasında yaptırılmıştır; avlulu ve merkezî kubbeli planıyla Osmanlı cami mimarisinde bir dönüm noktasıdır." },
  { id: "edirne-ii-bayezid-kulliyesi", il: "Edirne", ilce: "Merkez", ad: "II. Bayezid Külliyesi", ad_en: "Bayezid II Complex", tur: "kulliye", yuzyil: 15, wiki: "II. Bayezid Külliyesi", ek: "Sultan II. Bayezid'in Tunca Nehri kıyısındaki külliyesi; darüşşifa, medrese, imaret ve camiden oluşan bir sağlık ve eğitim kompleksidir.", konum: { lat: 41.6853, lng: 26.5546 } },

  { id: "istanbul-suleymaniye-camii", il: "İstanbul", ilce: "Fatih", ad: "Süleymaniye Camii", ad_en: "Süleymaniye Mosque", tur: "cami", yuzyil: 16, wiki: "Süleymaniye Camii", ek: "Kanuni Sultan Süleyman adına Mimar Sinan tarafından 1550-1557 arasında inşa edilmiştir; İstanbul'un siluetini belirleyen selatin camilerindendir." },
  { id: "istanbul-sultanahmet-camii", il: "İstanbul", ilce: "Fatih", ad: "Sultanahmet Camii", ad_en: "Sultan Ahmed Mosque", tur: "cami", yuzyil: 17, wiki: "Sultanahmet Camii", ek: "I. Ahmed adına Sedefkâr Mehmed Ağa tarafından 1609-1617 arasında yaptırılmıştır; mavi çinileri nedeniyle 'Mavi Camii' olarak da bilinir." },
  { id: "istanbul-rustem-pasa-camii", il: "İstanbul", ilce: "Fatih", ad: "Rüstem Paşa Camii", ad_en: "Rüstem Pasha Mosque", tur: "cami", yuzyil: 16, wiki: "Rüstem Paşa Camii", ek: "Mimar Sinan tarafından Sadrazam Rüstem Paşa adına 1561-1563'te yaptırılmıştır; İznik çinileriyle kaplı iç mekânıyla ünlüdür." },
  { id: "istanbul-mahmud-pasa-camii", il: "İstanbul", ilce: "Fatih", ad: "Mahmud Paşa Camii", ad_en: "Mahmud Pasha Mosque", tur: "cami", yuzyil: 15, wiki: "Mahmud Paşa Camii", ek: "Fatih Sultan Mehmed'in sadrazamı Mahmud Paşa tarafından 1464'te bir külliye olarak yaptırılmıştır; Bursa Fidan Hanı bu külliyeye vakfedilmiştir." },

  { id: "konya-mevlana-muzesi", il: "Konya", ilce: "Selçuklu", ad: "Mevlânâ Müzesi", ad_en: "Mevlana Museum", tur: "kulliye", yuzyil: 13, wiki: "Mevlânâ Müzesi", ek: "Mevlânâ Celaleddin Rumi'nin dergâhı ve türbesinin bulunduğu kompleks, 1926'dan beri müze olarak kullanılmaktadır." },
  { id: "konya-karatay-medresesi", il: "Konya", ilce: "Karatay", ad: "Karatay Medresesi", ad_en: "Karatay Madrasa", tur: "medrese", yuzyil: 13, wiki: "Karatay Medresesi", ek: "1251'de Celaleddin Karatay tarafından yaptırılmıştır; Selçuklu çini ve mimarisinin önemli örneklerindendir.", konum: { lat: 37.8723, lng: 32.493 } },
  { id: "konya-ince-minareli-medrese", il: "Konya", ilce: "Selçuklu", ad: "İnce Minareli Medrese", ad_en: "İnce Minareli Madrasa", tur: "medrese", yuzyil: 13, wiki: "İnce Minareli Medrese", ek: "1264'te Sahip Ata Fahreddin Ali tarafından yaptırılmıştır; taç kapısı ve ince minaresiyle Selçuklu taş işçiliğinin simgesidir.", konum: { lat: 37.8728, lng: 32.4925 } },

  { id: "balikesir-zagnos-pasa-camii", il: "Balıkesir", ilce: "Altıeylül", ad: "Zağnos Paşa Camii", ad_en: "Zagan Pasha Mosque", tur: "cami", yuzyil: 15, wiki: "Zağnos Paşa Camii", ek: "Fatih Sultan Mehmed'in vezirlerinden Zağanos Paşa tarafından 15. yüzyılda yaptırılmıştır; Balıkesir'in en büyük tarihî camisidir." },
  { id: "kutahya-ulu-camii", il: "Kütahya", ilce: "Merkez", ad: "Kütahya Ulu Camii", ad_en: "Great Mosque of Kütahya", tur: "cami", yuzyil: 14, wiki: "Kütahya Ulu Camii", ek: "Yıldırım Bayezid'in Kütahya valiliği sırasında başlatılmış, Ankara Savaşı'ndan sonra Musa Çelebi tarafından tamamlanmıştır." },
  { id: "bilecik-ertugrul-gazi-turbesi", il: "Bilecik", ilce: "Söğüt", ad: "Ertuğrul Gazi Türbesi", ad_en: "Ertuğrul Gazi Tomb", tur: "turbe", yuzyil: 13, wiki: "Ertuğrul Gazi Türbesi", ek: "Osman Gazi'nin babası Ertuğrul Gazi'nin Söğüt'teki türbesi, Osmanlı hanedanının kuruluş hafızasının merkezlerinden biridir." },
];

const YASAK = /(logo|icon|symbol|flag|map|harita|location|locator|blank|relief|plate|commons|wiki|edit|ambox|question|portal|disambig|nuvola|crystal|folder|padlock|check|mark|pog|turkey|türkiye|bölge|district|province|topographic|satellite|nasa|sea|coa|coat|seal|emblem|banner|signature|stub|magnify|translate|info|text_document|fairytale|gnome|star|award|medal|ribbon|arrow|button|template|imbox|mbox|pencil|zoom|wikidata|wikimedia|wikipedia)/i;

async function api(params) {
  const u = `https://tr.wikipedia.org/w/api.php?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`;
  const y = await fetch(u, { headers: { "user-agent": UA } });
  if (!y.ok) throw new Error(`Wikipedia ${y.status}: ${u}`);
  return y.json();
}

async function imageInfo(titles) {
  if (!titles.length) return new Map();
  const d = await api({ action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url", iiurlwidth: "1200", redirects: "1" });
  const m = new Map();
  for (const p of d.query?.pages ?? []) {
    const info = p.imageinfo?.[0];
    if (info?.thumburl) m.set(p.title, info.thumburl);
  }
  return m;
}

function temizMetin(metin) {
  return String(metin ?? "").replace(/\s+/g, " ").trim();
}

function kirp(metin, n = 1350) {
  const m = temizMetin(metin);
  if (m.length <= n) return m;
  const kesik = m.slice(0, n);
  const son = Math.max(kesik.lastIndexOf(". "), kesik.lastIndexOf("! "), kesik.lastIndexOf("? "));
  return (son > n * 0.55 ? kesik.slice(0, son + 1) : kesik.trimEnd() + "…");
}

async function indir(url, dosya) {
  if (!url) return false;
  const ext = (new URL(url).pathname.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg").toLowerCase();
  const hedef = dosya.replace(/\.[^.]+$/, ext === ".jpeg" ? ".jpg" : ext);
  if (existsSync(hedef)) return true;
  try {
    const y = await fetch(url, { headers: { "user-agent": UA } });
    if (!y.ok) throw new Error(String(y.status));
    const b = Buffer.from(await y.arrayBuffer());
    if (b.length < 8_000) return false;
    await writeFile(hedef, b);
    console.log(`  foto → ${path.relative(KOK, hedef)} (${Math.round(b.length / 1024)} KB)`);
    return true;
  } catch (h) {
    console.warn(`  foto indirilemedi: ${h.message}`);
    return false;
  }
}

const veri = JSON.parse(await readFile(VERI, "utf8"));
await mkdir(FOTO_DIZINI, { recursive: true });

const basliklar = ESERLER.map((e) => e.wiki);
console.log(`${ESERLER.length} eser için Vikipedi verisi alınıyor…`);
const sayfaVerisi = await api({
  action: "query", titles: basliklar.join("|"), prop: "coordinates|pageimages|extracts|images",
  exintro: "0", explaintext: "1", pithumbsize: "1400", redirects: "1", imlimit: "50", colimit: "max",
});
const sayfalar = new Map();
for (const p of sayfaVerisi.query?.pages ?? []) sayfalar.set(p.title, p);

const adaylar = [];
for (const e of ESERLER) {
  const p = sayfalar.get(e.wiki) ?? [...sayfalar.values()].find((x) => x.title?.toLocaleLowerCase("tr") === e.wiki.toLocaleLowerCase("tr"));
  if (!p || p.missing) { console.warn(`  ! ${e.ad}: Vikipedi sayfası yok (${e.wiki})`); continue; }
  const ekler = (p.images ?? []).map((x) => x.title).filter((t) => !YASAK.test(t) && /\.(jpe?g|png|webp)$/i.test(t)).slice(0, 2);
  for (const t of ekler) adaylar.push({ id: e.id, title: t });
  e._sayfa = p;
  e._ekler = ekler;
}

const bilgi = await imageInfo([...new Set(adaylar.map((x) => x.title))]);
await BEKLE(800);

for (const e of ESERLER) {
  if (!e._sayfa) continue;
  const p = e._sayfa;
  const koordinat = e.konum ?? (p.coordinates?.[0] ? { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon } : null);
  if (!koordinat) { console.warn(`  ! ${e.ad}: konum yok, atlandı`); continue; }
  const metin = kirp(`${p.extract || ""} ${e.ek || ""}`.trim());
  const fotolar = [];
  let n = 1;
  if (p.thumbnail?.source && await indir(p.thumbnail.source, path.join(FOTO_DIZINI, `${e.id}-${n}.jpg`))) {
    fotolar.push(`/medya/eserler/${e.id}-${n}${(new URL(p.thumbnail.source).pathname.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg").toLowerCase().replace(".jpeg", ".jpg")}`);
    n++;
  }
  for (const t of e._ekler ?? []) {
    const url = bilgi.get(t);
    if (!url) continue;
    const ad = path.join(FOTO_DIZINI, `${e.id}-${n}.jpg`);
    if (await indir(url, ad)) {
      const ext = (new URL(url).pathname.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg").toLowerCase().replace(".jpeg", ".jpg");
      fotolar.push(`/medya/eserler/${e.id}-${n}${ext}`);
      n++;
    }
    if (n > 3) break;
  }
  const kayit = {
    id: e.id, il: e.il, ilce: e.ilce, ad: e.ad, ad_en: e.ad_en ?? null, tur: e.tur, yuzyil: e.yuzyil,
    konum: { lat: Math.round(koordinat.lat * 1e6) / 1e6, lng: Math.round(koordinat.lng * 1e6) / 1e6, yaklasik: false },
    tarihce: { tr: metin, en: null },
    fotograflar: fotolar,
    sergi: null,
    kaynak: `Vikipedi, ${p.title} (CC BY-SA 4.0) — https://tr.wikipedia.org/wiki/${encodeURIComponent(p.title.replaceAll(" ", "_"))}`,
    adres: `${e.ilce}, ${e.il}`,
    konum_kaynagi: "vikipedi",
  };
  const i = veri.eserler.findIndex((x) => x.id === e.id);
  if (i >= 0) veri.eserler[i] = kayit;
  else veri.eserler.push(kayit);
  console.log(`✓ ${e.id} · ${fotolar.length} foto · ${metin.length} karakter`);
  await BEKLE(350);
}

await writeFile(VERI, JSON.stringify(veri, null, 1) + "\n");
console.log(`\nToplam ${veri.eserler.length} eser. data/eserler.json güncellendi.`);
