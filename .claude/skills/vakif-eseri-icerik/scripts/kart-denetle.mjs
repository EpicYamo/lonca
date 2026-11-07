#!/usr/bin/env node
// Dalış bilgi kartlarını kaynaklarıyla karşılaştıran denetim aracı (bağımlılık yok, Node 20+).
//
//   node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs                 # data/dalislar/*.json hepsi
//   node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs bursa-koza-hani # tek dalış
//   ... /yol/taslak.json   # bir dosyayı doğrudan denetle
//   ... --viki "Koza Han"        Vikipedi madde başlığını elle ver (dalışta vikipedi alanı yoksa)
//   ... --cevrimdisi             Vikipedi'yi indirme; V kartlarını yalnızca biçim yönünden denetle
//
// Ne yapar:
//   - Biçim: her kartta u/b/m/k var mı, uzunluklar sınırda mı, k ∈ {E, V, G, ""} (başka bir metin uyarı verir).
//   - E kartı: metindeki sayılar, sayı sözcükleri ve özel adlar eserin envanter metninde (eserler.json → tarihce.tr) geçiyor mu.
//   - V kartı: aynı denetim Türkçe Vikipedi maddesinin düz metnine karşı.
//   - G kartı: genel kavram kartında tarih, sayı ya da özel ad olmamalı (olursa kaynaklı karta dönüşmeli).
//   - Kaynak metinde PDF çıkarımından kalan bozuk harfler ("!" = ş, "%" = Ş/İ) var mı.
// Çıktı bir "şüpheliler" listesidir; karar her zaman insan editöründür. Ek, çekim ya da eş anlamlı yazım
// yüzünden yanlış alarm olabilir; atlanmış bir uydurma ise hiçbir zaman yayına girmemelidir.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const KOK = resolve(dirname(new URL(import.meta.url).pathname), "../../../..");
const arg = process.argv.slice(2);
const bayrak = (a) => arg.includes(a);
const deger = (a) => (arg.includes(a) ? arg[arg.indexOf(a) + 1] : null);
const hedefler = arg.filter((a, i) => !a.startsWith("--") && !["--viki"].includes(arg[i - 1]));

// Elle hazırlanan dalışlarda "vikipedi" alanı yok; V kartlarının yazıldığı maddeler (2026-11 doğrulandı).
const VIKI_BASLIK = {
  "bursa-ulucami": "Bursa Ulu Camii",
  "bursa-koza-hani": "Koza Han",
  "bursa-sehzade-mustafa-turbesi": "Muradiye Külliyesi",
};
const SINIR = { u: [20, 24], b: [45, 60], m: [230, 300] };
const SAYI_SOZ = "bir iki üç dört beş altı yedi sekiz dokuz on yirmi otuz kırk elli altmış yetmiş seksen doksan yüz bin".split(" ");
const BUYUK_HARF_ISTISNA = new Set("Bu Bir Burada Buradan Şimdi Her İçeride Gezi Ama Ancak Böylece Ayrıca İki Üç Dört Beş Altı Yedi Sekiz Dokuz On Yirmi Kırk Yüz Bin Kare Kıble Hat İslam Kur'an Allah".split(" "));

const katla = (s) => String(s ?? "").toLocaleLowerCase("tr").replace(/[’'`´]/g, "'").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

function olgular(metin) {
  const sayilar = [...String(metin).matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0]);
  const sozler = katla(metin).split(/[^a-z0-9]+/).filter((k) => SAYI_SOZ.map(katla).includes(k));
  const adlar = [];
  const cumleler = String(metin).split(/(?<=[.!?:;"“”])\s+/);
  for (const c of cumleler) {
    const kel = c.split(/\s+/);
    kel.forEach((k, i) => {
      const temiz = k.replace(/^[“"(«]+|[”")»,.;:!?]+$/g, "");
      if (i === 0 || !/^[A-ZÇĞİÖŞÜÂÎÛ]/.test(temiz) || BUYUK_HARF_ISTISNA.has(temiz)) return;
      adlar.push(temiz.split(/['’]/)[0]);
    });
  }
  return { sayilar, sozler, adlar: [...new Set(adlar)].filter((a) => a.length > 2) };
}
// Türkçe ek almış bir adı gövdesiyle arar ("Bayezid" ↔ "Bayezid'in", "Mehmed" ↔ "Mehmed’e").
function geciyor(kaynak, ifade) {
  const k = katla(kaynak), i = katla(ifade);
  if (k.includes(i)) return true;
  const govde = i.slice(0, Math.max(4, i.length - 3));
  return govde.length >= 4 && k.includes(govde);
}

async function vikipediMetni(baslik) {
  const u = `https://tr.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", redirects: "1", titles: baslik, format: "json", formatversion: "2" })}`;
  const y = await fetch(u, { headers: { "User-Agent": "lonca-kart-denetle/1" }, signal: AbortSignal.timeout(20_000) });
  const s = (await y.json())?.query?.pages?.[0];
  return s?.extract ? { baslik: s.title, metin: s.extract } : null;
}

const eserler = JSON.parse(readFileSync(join(KOK, "data/eserler.json"), "utf8")).eserler;
const dizin = join(KOK, "data/dalislar");
// Hedef bir eser id'si (data/dalislar/<id>.json) ya da bir dosya yolu olabilir (taslağı yayından önce denetlemek için).
const dosyalar = (hedefler.length ? hedefler : readdirSync(dizin).filter((f) => f.endsWith(".json")))
  .map((h) => (existsSync(h) && h.endsWith(".json") ? resolve(h) : join(dizin, `${h.replace(/\.json$/, "")}.json`)))
  .filter((f) => existsSync(f) || (console.error(`yok: ${f}`), false));

let toplamHata = 0, toplamUyari = 0;
for (const f of dosyalar) {
  const tanim = JSON.parse(readFileSync(f, "utf8"));
  const eser = eserler.find((e) => e.id === tanim.eser);
  const envanter = eser?.tarihce?.tr ?? "";
  const vikiBaslik = deger("--viki") ?? tanim.vikipedi?.baslik ?? VIKI_BASLIK[tanim.eser] ?? null;
  let viki = null;
  if (vikiBaslik && !bayrak("--cevrimdisi")) viki = await vikipediMetni(vikiBaslik).catch(() => null);

  const satirlar = [];
  const hata = (m) => { satirlar.push(`  ✗ ${m}`); toplamHata++; };
  const uyari = (m) => { satirlar.push(`  ! ${m}`); toplamUyari++; };

  if (!eser) hata(`eser kaydı yok: ${tanim.eser}`);
  const bozuk = [...envanter.matchAll(/\w*[!%]\w+/g)].map((m) => m[0]);
  if (bozuk.length) uyari(`envanter metninde PDF çıkarım bozukluğu (! = ş, % = Ş/İ): ${[...new Set(bozuk)].slice(0, 6).join(", ")}`);
  if (vikiBaslik && !viki && !bayrak("--cevrimdisi")) uyari(`Vikipedi maddesi alınamadı: "${vikiBaslik}"`);
  if (!vikiBaslik) uyari(`Vikipedi başlığı bilinmiyor (--viki "<başlık>" ver); V kartları içerik yönünden denetlenmedi`);

  const gorulen = new Set();
  for (const [ki, kare] of (tanim.kareler ?? []).entries()) {
    for (const [bi, kart] of (kare.k ?? []).entries()) {
      const yer = `${kare.g}#${ki}/${bi} "${kart.b ?? ""}"`;
      const imza = `${kart.u}|${kart.b}|${kart.m}`;
      if (gorulen.has(imza)) continue; // aynı kart tekrar kullanılmışsa bir kez denetle
      gorulen.add(imza);
      for (const a of ["u", "b", "m"]) {
        const n = String(kart[a] ?? "").length;
        if (!n && a !== "u") hata(`${yer}: "${a}" boş`);
        else if (n > SINIR[a][1]) hata(`${yer}: "${a}" ${n} harf (en çok ${SINIR[a][1]})`);
        else if (n > SINIR[a][0]) uyari(`${yer}: "${a}" ${n} harf (önerilen en çok ${SINIR[a][0]})`);
      }
      if (!("k" in kart)) { hata(`${yer}: kaynak (k) yok`); continue; }
      // Serbest metin modülde olduğu gibi gösterilir (KAYNAK[k] ?? k); kabul edilir ama içerik denetlenemez.
      if (!["E", "V", "G", ""].includes(kart.k)) uyari(`${yer}: serbest kaynak metni "${kart.k}" (E/V/G tercih edilir; içerik denetlenmedi)`);
      // Başlıklar çoğu zaman Başlık Düzeninde yazıldığından özel adlar yalnızca metinden (m) çıkarılır; sayılar ikisinden.
      const o = olgular(kart.m ?? "");
      o.sayilar.push(...olgular(kart.b ?? "").sayilar);
      if (kart.k === "G") {
        const dikkat = [...o.sayilar.filter((s) => s.length >= 3), ...o.adlar];
        if (dikkat.length) uyari(`${yer}: G (genel) kartta özgül bilgi var → E/V olmalı ya da çıkarılmalı: ${dikkat.join(", ")}`);
        continue;
      }
      const kaynak = kart.k === "E" ? envanter : kart.k === "V" ? viki?.metin : null;
      if (!kaynak) continue;
      const eksik = [
        ...o.sayilar.filter((s) => !katla(kaynak).includes(katla(s))),
        ...o.sozler.filter((s) => !new RegExp(`(^|[^a-z])${s}([^a-z]|$)`).test(katla(kaynak))),
        ...o.adlar.filter((a) => !geciyor(kaynak, a)),
      ];
      if (eksik.length) uyari(`${yer} [${kart.k}]: kaynakta bulunamadı → ${[...new Set(eksik)].join(", ")}`);
    }
  }
  console.log(`\n${tanim.eser}  (${tanim.durum ?? "?"}, ${tanim.kaynak ?? "?"}${viki ? `, Vikipedi: ${viki.baslik}` : ""})`);
  console.log(satirlar.length ? satirlar.join("\n") : "  ✓ sorun bulunmadı");
}
console.log(`\nToplam: ${toplamHata} hata, ${toplamUyari} uyarı. Uyarılar insan gözüyle kaynağa bakılarak kapatılır.`);
process.exitCode = toplamHata ? 1 : 0;
