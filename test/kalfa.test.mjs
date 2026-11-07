import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { kalfaHazirla } from "../server/kalfa.js";
import { deneySunucusu, KOK } from "./yardimci.mjs";

const { eserler } = JSON.parse(await readFile(path.join(KOK, "data", "eserler.json"), "utf8"));
const kalfa = kalfaHazirla({ kok: KOK, eserler, ortam: { KALFA_SAHTE: "1" } });
const sarmala = (govde) => `import { sahne, eserler } from "@lonca/sdk";\nexport default async function basla() {\n  await sahne.ayarla({ baslik: "T", tema: { zemin: "gece" } });\n${govde}\n}\n`;

test("örnek modüller denetimden geçer", async () => {
  for (const f of await readdir(path.join(KOK, "sdk", "ornekler"))) {
    assert.deepEqual(kalfa.dogrula(await readFile(path.join(KOK, "sdk", "ornekler", f), "utf8")), [], f);
  }
});

test("tarayıcı API'leri ve dış içe aktarmalar yasak", () => {
  assert.ok(kalfa.dogrula(sarmala("  const x = await fetch('https://kotu.example');")).length);
  assert.ok(kalfa.dogrula(sarmala("  document.title = 'x';")).length);
  assert.ok(kalfa.dogrula(`import x from "fs";\n` + sarmala("")).length);
  assert.ok(kalfa.dogrula(sarmala("  eval('1');")).length);
});

test("bilinmeyen düğüm tipi, ikon ve tema reddedilir", () => {
  assert.ok(kalfa.dogrula(sarmala(`  await sahne.ciz({ tip: "video", src: "x" });`)).some((h) => h.includes("düğüm tipi")));
  assert.ok(kalfa.dogrula(sarmala(`  await sahne.ciz({ tip: "dugme", id: "a", metin: "b", ikon: "roket" });`)).some((h) => h.includes("ikon")));
  assert.ok(kalfa.dogrula(sarmala(`  await sahne.ayarla({ tema: { zemin: "neon" } });`)).some((h) => h.includes("zemin")));
});

test("uygulama olmayan (sahne.ayarla çağırmayan) modül reddedilir", () => {
  const kod = `import { ekran } from "@lonca/sdk";\nexport default async function basla() { await ekran.metin("merhaba"); }\n`;
  assert.ok(kalfa.dogrula(kod).some((h) => h.includes("uygulama")));
});

test("sahte kalfa her istek türü için geçerli bir modül üretir", async () => {
  for (const istek of ["bursa haritası", "hanlar için bir oyun", "Çocuklar için hanlarda hazine avı", "bir şey yap"]) {
    const r = await kalfa.calistir([{ rol: "usta", metin: istek }]);
    assert.deepEqual(kalfa.dogrula(r.kod), [], istek);
  }
});

test("kalfa uç noktası hız sınırına uyar", async () => {
  const s = await deneySunucusu({ KALFA_SINIR: "2" });
  const govde = { sohbet: [{ rol: "usta", metin: "bir oyun" }] };
  assert.equal((await s.istek("POST", "/api/kalfa", { govde })).statusCode, 200);
  assert.equal((await s.istek("POST", "/api/kalfa", { govde })).statusCode, 200);
  assert.equal((await s.istek("POST", "/api/kalfa", { govde })).statusCode, 429);
  await s.app.close();
});

test("olay döngüsünden sonra const ile tanımlanan yardımcı yakalanır", () => {
  const kod = `import { sahne } from "@lonca/sdk";
export default async function basla() {
  await sahne.ayarla({ baslik: "x" });
  await sahne.ciz({ tip: "metin", metin: yardimci() });
  for await (const olay of sahne.olaylar()) { await sahne.ciz({ tip: "metin", metin: yardimci() }); }
  const yardimci = () => "merhaba";
}
`;
  assert.ok(kalfa.dogrula(kod).some((h) => h.includes("yardimci")));
  assert.deepEqual(kalfa.dogrula(kod.replace('const yardimci = () => "merhaba";', 'function yardimci() { return "merhaba"; }')), []);
});
