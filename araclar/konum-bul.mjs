#!/usr/bin/env node
//   npm run konum                    → konumu olmayan eserler
//   npm run konum -- --il Konya      → yalnızca bir ilin eserleri
//   npm run konum -- --dene          → yalnızca yazdırır, dosyayı değiştirmez
//
// Önce eserin adı aranır ("Ad, İlçe, İl"); bulunan yerin adı eserin ayırt edici bir sözcüğünü taşımalı ve
// ilçe merkezine (25 km; ilçe yoksa il merkezine, 15 km) yakın olmalı. Ad bulunamazsa adresteki mahallenin merkezi
// alınır (konum_kaynagi: "openstreetmap-mahalle"). Bütün bu konumlar yaklaşıktır (yaklasik: true).
import { readFile, writeFile } from "node:fs/promises";

try { process.loadEnvFile(); } catch {}
const DOSYA = "data/eserler.json";
const arg = (ad) => { const i = process.argv.indexOf(ad); return i > 0 ? process.argv[i + 1] : null; };
const hepsi = process.argv.includes("--hepsi"), dene = process.argv.includes("--dene"), ilSecimi = arg("--il");
const anahtar = process.env.GOOGLE_HARITA_ANAHTARI;
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const ILCE_YARICAP = 25, IL_YARICAP = 15;   // ilçesi bilinmeyen eser il merkezine yakın olmalı

function uzaklikKm(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const katla = (s) => String(s).toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (h) => "cgiosuaiu"["çğıöşüâîû".indexOf(h)]);
const GENEL = new Set(["camii", "cami", "camisi", "mescidi", "mescit", "turbesi", "turbe", "kumbeti", "hani", "han", "hamami",
  "cesmesi", "medresesi", "medrese", "kulliyesi", "koyu", "beldesi", "ulu", "eski", "merkez", "buyuk", "kucuk", "yeni", "ve",
  "orta", "carsi", "yukari", "asagi", "sultan", "seyh", "haci", "bey", "pasa", "aga", "dede", "baba", "efendi", "konut", "ev"]);
const ayirtEdici = (ad) => katla(ad).split(/[^a-z0-9]+/).filter((k) => k.length > 2 && !GENEL.has(k));

async function google(sorgu, merkez) {
  const y = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": anahtar, "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress" },
    body: JSON.stringify({ textQuery: sorgu, languageCode: "tr", regionCode: "TR", maxResultCount: 1,
      locationBias: { circle: { center: { latitude: merkez.lat, longitude: merkez.lng }, radius: 40000 } } }),
  });
  if (!y.ok) throw new Error(`Google ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const p = (await y.json()).places?.[0];
  return p ? { lat: p.location.latitude, lng: p.location.longitude, ad: p.displayName?.text, kaynak: "google" } : null;
}

async function nominatim(sorgu) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(sorgu)}`;
  let y = null;
  for (let deneme = 0; deneme < 3 && !y; deneme++) {
    try { y = await fetch(u, { headers: { "user-agent": "Lonca/0.1 (KOK&KOD hackathon; vakif eserleri)" }, signal: AbortSignal.timeout(20000) }); }
    catch { await bekle(5000); }   // ağ kesintisi: biraz bekleyip yeniden dene
  }
  await bekle(1100);
  if (!y?.ok) return null;
  const s = (await y.json())[0];
  return s ? { lat: Number(s.lat), lng: Number(s.lon), ad: s.display_name, kaynak: "openstreetmap" } : null;
}

// Bursa için eski merkez korunur; diğer illerin ve ilçelerin merkezi bir kez aranır.
const merkezler = new Map([["Bursa|", { lat: 40.1885, lng: 29.061 }]]);
async function merkez(il, ilce) {
  const k = `${il}|${ilce ?? ""}`;
  if (!merkezler.has(k)) merkezler.set(k, await nominatim(ilce ? `${ilce}, ${il}` : `${il} merkez`));
  return merkezler.get(k);
}

const veri = JSON.parse(await readFile(DOSYA, "utf8"));
const hedef = veri.eserler.filter((e) => (hepsi || !e.konum) && (!ilSecimi || e.il === ilSecimi));
console.log(`${hedef.length} eser için konum aranıyor (${anahtar ? "Google Places + " : ""}OpenStreetMap)…`);
let bulunan = 0;
for (const e of hedef) {
  const il = e.il ?? "Bursa";
  const ilceMerkezi = e.ilce ? await merkez(il, e.ilce) : null;
  const orta = ilceMerkezi || (await merkez(il, null));
  const yaricap = ilceMerkezi ? ILCE_YARICAP : IL_YARICAP;
  const uygun = (s, sozcukler) => s && orta && uzaklikKm(orta, s) <= yaricap && sozcukler.some((k) => katla(s.ad).includes(k));

  let sonuc = null;
  const sozcukler = ayirtEdici(e.ad);
  if (sozcukler.length) {
    const sorgu = [e.ad, e.ilce, il].filter(Boolean).join(", ");
    try { if (anahtar) sonuc = await google(sorgu, orta); } catch (h) { console.warn(h.message); }
    if (!uygun(sonuc, sozcukler)) sonuc = null;
    if (!sonuc) try { sonuc = await nominatim(sorgu); } catch {}
    if (!uygun(sonuc, sozcukler)) sonuc = null;
  }
  const mahalle = /([\p{L}\p{N} ]+?) Mahallesi/u.exec(e.adres ?? "")?.[1]?.trim();
  if (!sonuc && mahalle) {
    try { sonuc = await nominatim(`${mahalle} Mahallesi, ${e.ilce ?? ""}, ${il}`); } catch {}
    sonuc = uygun(sonuc, [katla(mahalle).split(" ").pop()]) ? { ...sonuc, kaynak: "openstreetmap-mahalle" } : null;
  }
  if (!sonuc) { console.log(`  – ${e.ad}: bulunamadı`); continue; }
  bulunan++;
  console.log(`  ✓ ${e.ad} → ${sonuc.lat.toFixed(5)}, ${sonuc.lng.toFixed(5)} (${sonuc.kaynak}: ${String(sonuc.ad).slice(0, 70)})`);
  if (!dene) {
    e.konum = { lat: Math.round(sonuc.lat * 1e6) / 1e6, lng: Math.round(sonuc.lng * 1e6) / 1e6, yaklasik: sonuc.kaynak !== "google" };
    e.konum_kaynagi = sonuc.kaynak;
  }
}
if (!dene) await writeFile(DOSYA, JSON.stringify(veri, null, 1) + "\n");
console.log(`\n${bulunan}/${hedef.length} eser için konum bulundu${dene ? " (deneme: dosya değişmedi)" : `; ${DOSYA} güncellendi. Sunucuyu yeniden başlat.`}`);
