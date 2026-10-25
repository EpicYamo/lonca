#!/usr/bin/env node
//   npm run konum              → konumu olmayan eserler
import { readFile, writeFile } from "node:fs/promises";

try { process.loadEnvFile(); } catch {}
const DOSYA = "data/eserler.json";
const MERKEZ = { lat: 40.1885, lng: 29.061 };
const hepsi = process.argv.includes("--hepsi"), dene = process.argv.includes("--dene");
const anahtar = process.env.GOOGLE_HARITA_ANAHTARI;
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

function uzaklikKm(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function google(sorgu) {
  const y = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": anahtar, "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress" },
    body: JSON.stringify({ textQuery: sorgu, languageCode: "tr", regionCode: "TR", maxResultCount: 1,
      locationBias: { circle: { center: { latitude: MERKEZ.lat, longitude: MERKEZ.lng }, radius: 40000 } } }),
  });
  if (!y.ok) throw new Error(`Google ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const p = (await y.json()).places?.[0];
  return p ? { lat: p.location.latitude, lng: p.location.longitude, ad: p.displayName?.text, kaynak: "google" } : null;
}

async function nominatim(sorgu) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(sorgu)}`;
  const y = await fetch(u, { headers: { "user-agent": "Lonca/0.1 (KOK&KOD hackathon; vakif eserleri)" } });
  await bekle(1100); 
  if (!y.ok) return null;
  const s = (await y.json())[0];
  return s ? { lat: Number(s.lat), lng: Number(s.lon), ad: s.display_name, kaynak: "openstreetmap" } : null;
}

const veri = JSON.parse(await readFile(DOSYA, "utf8"));
const hedef = veri.eserler.filter((e) => hepsi || !e.konum);
console.log(`${hedef.length} eser için konum aranıyor (${anahtar ? "Google Places + " : ""}OpenStreetMap)…`);
let bulunan = 0;
for (const e of hedef) {
  const sorgu = [e.ad, e.ilce, e.il ?? "Bursa"].filter(Boolean).join(", ");
  let sonuc = null;
  try { if (anahtar) sonuc = await google(sorgu); } catch (h) { console.warn(h.message); }
  if (!sonuc) try { sonuc = await nominatim(sorgu); } catch {}
  if (sonuc && uzaklikKm(MERKEZ, sonuc) > 45) sonuc = null;
  if (!sonuc) { console.log(`  – ${e.ad}: bulunamadı`); continue; }
  bulunan++;
  console.log(`  ✓ ${e.ad} → ${sonuc.lat.toFixed(5)}, ${sonuc.lng.toFixed(5)} (${sonuc.kaynak}: ${String(sonuc.ad).slice(0, 60)})`);
  if (!dene) {
    e.konum = { lat: Math.round(sonuc.lat * 1e6) / 1e6, lng: Math.round(sonuc.lng * 1e6) / 1e6, yaklasik: sonuc.kaynak !== "google" };
    e.konum_kaynagi = sonuc.kaynak;
  }
}
if (!dene) await writeFile(DOSYA, JSON.stringify(veri, null, 1) + "\n");
console.log(`\n${bulunan}/${hedef.length} eser için konum bulundu${dene ? " (deneme: dosya değişmedi)" : `; ${DOSYA} güncellendi. Sunucuyu yeniden başlat.`}`);
