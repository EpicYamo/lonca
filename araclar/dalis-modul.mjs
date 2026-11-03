#!/usr/bin/env node
// Elle hazırlanan dalış tanımlarını (araclar/dalis/<eser>.json + üretilen kunye.json) yayın verisine çevirir:
// data/dalislar/<eser>.json. Uygulama dalışları buradan okur (GET /api/dalislar, SDK: dalislar.liste()).
// Dalış kalfası (Studio → Dalışlar) aynı biçimde, "bekliyor" durumunda yazar.
//
//   node araclar/dalis-modul.mjs bursa-ulucami bursa-koza-hani bursa-sehzade-mustafa-turbesi
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const KOK = resolve(dirname(new URL(import.meta.url).pathname), "..");
const eserler = process.argv.slice(2);
if (!eserler.length) { console.error("Kullanım: node araclar/dalis-modul.mjs <eser-id> …"); process.exit(1); }
mkdirSync(join(KOK, "data/dalislar"), { recursive: true });

for (const id of eserler) {
  const spec = JSON.parse(readFileSync(join(KOK, "araclar/dalis", `${id}.json`), "utf8"));
  const kunye = JSON.parse(readFileSync(join(KOK, "public/medya/dalis", id, "kunye.json"), "utf8"));
  if (kunye.length !== spec.kareler.length) throw new Error(`${id}: kunye.json güncel değil, önce dalis-uret.mjs çalıştır`);
  const hedefYol = join(KOK, "data/dalislar", `${id}.json`);
  const onceki = existsSync(hedefYol) ? JSON.parse(readFileSync(hedefYol, "utf8")) : null;
  const tanim = {
    eser: id, ozet: spec.ozet ?? "", hedef: spec.hedef ?? null,
    durum: onceki?.durum ?? "onayli", kaynak: "el", olusturma: onceki?.olusturma ?? new Date().toISOString(), guncelleme: new Date().toISOString(),
    kareler: spec.kareler.map((k, i) => {
      const u = kunye[i];
      const o = { g: u.gorsel, t: u.tur };
      if (u.cikis) o.c = u.cikis; else if (u.portal) o.p = u.portal;
      if (u.uydu) o.u = [u.uydu.lat, u.uydu.lng, u.uydu.z, k.ad.endsWith("x") ? 1 : 0];
      if (k.baslik) o.b = k.baslik;
      if (k.yazi) o.y = k.yazi;
      if (k.bakislar?.length) o.k = k.bakislar;
      return o;
    }),
  };
  writeFileSync(hedefYol, JSON.stringify(tanim, null, 1) + "\n");
  console.log(`data/dalislar/${id}.json: ${tanim.kareler.length} kare (${tanim.durum})`);
}
