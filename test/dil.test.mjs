// Arayüz dili: İngilizce sözlüğün tutarlılığı ve sayfalardaki sabit Türkçe metinlerin karşılığı olması.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EN } from "../public/ortak/ceviri-en.js";

const bosluk = (s) => s.replace(/\s+/g, " ").trim();
const yerTutucular = (s) => [...s.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1]));

test("sözlük değerleri metin ya da işlev, yer tutucular tutarlı", () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.ok(bosluk(k), "boş anahtar");
    const tutucu = yerTutucular(k);
    if (typeof v === "function") {
      const sonuc = v(...tutucu.map((i) => String(i + 3)));
      assert.equal(typeof sonuc, "string", k);
      assert.ok(sonuc.trim(), k);
      continue;
    }
    assert.equal(typeof v, "string", k);
    assert.ok(v.trim(), `boş çeviri: ${k}`);
    for (const i of yerTutucular(v)) assert.ok(tutucu.includes(i), `"${k}" anahtarında {${i}} yok`);
  }
});

test("boşlukları tekleştirince çakışan anahtar yok", () => {
  const gorulen = new Set();
  for (const k of Object.keys(EN)) {
    const n = bosluk(k);
    assert.ok(!gorulen.has(n), `yinelenen anahtar: ${n}`);
    gorulen.add(n);
  }
});

test("yüzyıl ve çoğul işlevleri doğru İngilizce üretir", () => {
  assert.equal(EN["{0}. yüzyıl"]("1"), "1st century");
  assert.equal(EN["{0}. yüzyıl"]("12"), "12th century");
  assert.equal(EN["{0}. yüzyıl"]("21"), "21st century");
  assert.equal(EN["{0}. yüzyıl"]("13"), "13th century");
  assert.equal(EN["{0} eser"]("1"), "1 heritage site");
  assert.equal(EN["{0} eser"]("5"), "5 heritage sites");
});

// index.html'lerdeki sabit Türkçe metinler (etiket içi metin ve erişilebilirlik öznitelikleri) sözlükte olmalı;
// yoksa İngilizce arayüzde Türkçe kalırlar.
const ATLA = new Set(["Bursa Vakıf Eserleri Envanteri".toLowerCase()]);
for (const dosya of ["public/app/index.html", "public/studio/index.html", "public/web/index.html"]) {
  test(`${dosya}: sabit arayüz metinlerinin İngilizcesi var`, async () => {
    let html = await readFile(new URL(`../${dosya}`, import.meta.url), "utf8");
    html = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<head>[\s\S]*?<\/head>/, "");
    const metinler = [
      ...[...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]),
      ...[...html.matchAll(/\b(?:placeholder|title|aria-label|alt)="([^"]+)"/g)].map((m) => m[1]),
    ].map(bosluk).filter((s) => /[çğıöşüÇĞİÖŞÜ]/.test(s) && !ATLA.has(s.toLowerCase()));
    const eksik = [...new Set(metinler)].filter((s) => !(s in EN) && !Object.keys(EN).some((k) => bosluk(k) === s));
    assert.deepEqual(eksik, []);
  });
}
