// Tuval oyunları: SDK'nın oyun.* akışı, kalfa denetimi ve istemdeki oyun yönergesi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { kalfaHazirla } from "../server/kalfa.js";
import { KOK } from "./yardimci.mjs";

const { eserler } = JSON.parse(await readFile(path.join(KOK, "data", "eserler.json"), "utf8"));
const kalfa = kalfaHazirla({ kok: KOK, eserler, ortam: { KALFA_SAHTE: "1" } });
const sdkKaynagi = await readFile(path.join(KOK, "sdk", "lonca-sdk.js"), "utf8");

// lonca-sdk.js'i modül çerçevesi gibi bir ortamda çalıştırır: parent'a giden mesajlar toplanır, gelen mesajlar elle verilir.
function cerceve() {
  const giden = [];
  let dinleyici = null;
  const parent = { postMessage: (m) => giden.push(structuredClone(m)) };
  const window = { addEventListener: (ad, fn) => { if (ad === "message") dinleyici = fn; } };
  const baglam = vm.createContext({ parent, window, structuredClone, Promise, Object, Array, Map, Set, Math, Number, String, Error });
  baglam.globalThis = baglam;
  vm.runInContext(sdkKaynagi, baglam);
  return { lonca: baglam.lonca, giden, gelen: (data) => dinleyici({ source: parent, data: { lonca: 1, ...data } }) };
}
const akislar = (giden, tur) => giden.filter((m) => m.tur === "akis" && m.veri.tur === tur).map((m) => m.veri);

test("oyun.ciz kalem komutlarını tek mesajda gönderir; eser verilince ilk fotoğrafı çizer", () => {
  const { lonca, giden } = cerceve();
  const eser = { fotograflar: ["/medya/eserler/a.jpg"] };
  lonca.oyun.ciz("alan", (k) => {
    k.temizle("#000").dikdortgen(1, 2, 3, 4, "red", { yuvarlak: 2 }).daire(5, 6, 7, "blue");
    k.yazi(12, 10, 20, { boyut: 30, hiza: "orta" }).gorsel(eser, 0, 0, 50, 40).gorsel({ fotograflar: [] }, 0, 0, 1, 1);
  });
  const [c] = akislar(giden, "ciz");
  assert.equal(c.id, "alan");
  assert.equal(c.komutlar.map((k) => k[0]).join(","), "temizle,dikdortgen,daire,yazi,gorsel");
  assert.equal(c.komutlar[3][1], "12");
  assert.equal(c.komutlar[4][1], "/medya/eserler/a.jpg");
});

test("oyun döngüsü: her kare onaylanır, döngüdeki çizimler onayla gider, durdurunca devam: false", () => {
  const { lonca, giden, gelen } = cerceve();
  const dtler = [];
  lonca.oyun.dongu((dt) => { dtler.push(dt); lonca.oyun.ciz("alan", (k) => k.temizle("#111")); });
  assert.deepEqual(akislar(giden, "dongu").at(-1), { tur: "dongu", acik: true });
  gelen({ tur: "kare", dt: 0.016, t: 0.016 });
  const onay = akislar(giden, "kare_tamam").at(-1);
  assert.equal(onay.devam, true);
  assert.deepEqual(Object.keys(onay.cizimler), ["alan"]);
  assert.equal(akislar(giden, "ciz").length, 0, "döngü içindeki çizim ayrı mesaj olmaz");
  lonca.oyun.durdur();
  gelen({ tur: "kare", dt: 0.016, t: 0.032 });
  assert.equal(akislar(giden, "kare_tamam").at(-1).devam, false);
  assert.deepEqual(dtler, [0.016]);
});

test("dokunma ve klavye girdisi durum olarak okunur ve dinleyicilere gider", () => {
  const { lonca, gelen } = cerceve();
  const olaylar = [];
  lonca.oyun.dinle("basla", (o) => olaylar.push(o.tur));
  gelen({ tur: "girdi", olay: { tur: "basla", tuval: "alan", parmak: 1, x: 10, y: 20 } });
  gelen({ tur: "girdi", olay: { tur: "surukle", tuval: "alan", parmak: 1, x: 40, y: 25 } });
  assert.equal(JSON.stringify(lonca.oyun.dokunmalar("alan").map((d) => [d.x, d.y, d.ilkX])), "[[40,25,10]]");
  assert.equal(lonca.oyun.dokunmalar("baska").length, 0);
  gelen({ tur: "girdi", olay: { tur: "birak", tuval: "alan", parmak: 1, x: 40, y: 25 } });
  assert.equal(lonca.oyun.dokunmalar().length, 0);
  gelen({ tur: "girdi", olay: { tur: "tus", tus: "ArrowLeft" } });
  assert.equal(lonca.oyun.tus("ArrowLeft"), true);
  gelen({ tur: "girdi", olay: { tur: "tus_birak", tus: "ArrowLeft" } });
  assert.equal(lonca.oyun.tus("ArrowLeft"), false);
  assert.deepEqual(olaylar, ["basla"]);
});

test("tamSayi sınırlar içinde tam sayı, sec dizinin bir öğesini verir", () => {
  const { lonca } = cerceve();
  for (let i = 0; i < 200; i++) {
    const t = lonca.oyun.tamSayi(1, 3);
    assert.ok(Number.isInteger(t) && t >= 1 && t <= 3);
    assert.ok(["a", "b"].includes(lonca.oyun.sec(["a", "b"])));
  }
  assert.equal(lonca.oyun.sec([]), undefined);
});

test("döngüde atılan hata modülü anlaşılır bir mesajla durdurur", () => {
  const { lonca, giden, gelen } = cerceve();
  lonca.oyun.dongu(() => { throw new Error("top yok"); });
  gelen({ tur: "kare", dt: 0.016, t: 0.016 });
  assert.ok(giden.some((m) => m.tur === "hata" && /top yok/.test(m.mesaj)));
  assert.equal(lonca.oyun.calisiyor, false);
});

test("tuval oyunu denetimden geçer; tuvalsiz çizim ve async döngü reddedilir", () => {
  const oyunKodu = (govde) => `import { sahne, oyun } from "@lonca/sdk";
export default async function basla() {
  await sahne.ayarla({ baslik: "Pong", tema: { zemin: "gece" } });
${govde}
}
`;
  const gecerli = oyunKodu(`  let x = 0;
  await sahne.ciz({ tip: "tuval", id: "masa", en: 360, boy: 640, cocuklar: [] });
  oyun.dongu((dt) => {
    const p = oyun.dokunmalar("masa")[0];
    if (p) x = p.x;
    oyun.ciz("masa", (k) => { k.temizle("#000"); k.dikdortgen(x, 600, 80, 12, "#fff", { yuvarlak: 6 }); });
    if (oyun.tus("ArrowLeft")) { oyun.ses("vurus"); oyun.titres("hafif"); }
  });`);
  assert.deepEqual(kalfa.dogrula(gecerli), []);
  assert.ok(kalfa.dogrula(oyunKodu(`  oyun.ciz("masa", (k) => k.temizle());`)).some((h) => h.includes("tuval")));
  assert.ok(kalfa.dogrula(oyunKodu(`  await sahne.ciz({ tip: "tuval", id: "masa" });\n  oyun.ciz("alan", (k) => k.temizle());`)).some((h) => h.includes('oyun.ciz("alan")')));
  assert.ok(kalfa.dogrula(oyunKodu(`  await sahne.ciz({ tip: "tuval", id: "masa" });\n  oyun.dongu(async (dt) => { await oyun.bekle(1); });`)).some((h) => h.includes("async")));
  assert.ok(kalfa.dogrula(oyunKodu(`  const d = [1, 2];\n  const x = d[oyun.rastgele(0, 1)];`)).some((h) => h.includes("oyun.sec")));
  assert.deepEqual(kalfa.dogrula(oyunKodu(`  const d = [1, 2];\n  const x = oyun.sec(d) ?? d[oyun.tamSayi(0, 1)];\n  await sahne.ciz({ tip: "metin", metin: String(x) });`)), []);
  // Ağacı yalnızca döndürüp çizmeyen modül (ekran açılış ekranında takılır) reddedilir.
  assert.ok(kalfa.dogrula(oyunKodu(`  const ciz = () => ({ tip: "metin", metin: "a" });\n  await ciz();`)).some((h) => h.includes("sahne.ciz")));
  assert.ok(kalfa.dogrula(oyunKodu(`  let oyun2 = 1;\n  { let sahne = "kapak"; }`)).some((h) => h.includes('"sahne"')));
  // Tarayıcının kendi döngüsü ve tuvali modülde yoktur.
  assert.ok(kalfa.dogrula(oyunKodu(`  requestAnimationFrame(() => {});`)).length);
  assert.ok(kalfa.dogrula(oyunKodu(`  setInterval(() => {}, 16);`)).length);
});

test("usta ve admin istemi gerçek zamanlı oyunu anlatır, oyunu quiz'e indirgemeyi yasaklar", async () => {
  const asilFetch = globalThis.fetch;
  const istekler = [];
  globalThis.fetch = async (_url, { body }) => {
    istekler.push(JSON.parse(body));
    const mesaj = { role: "assistant", content: "", tool_calls: [{ id: "1", type: "function", function: { name: "yanit_ver", arguments: JSON.stringify({ metin: "Tamam.", oneriler: ["a", "b"] }) } }] };
    return new Response(JSON.stringify({ choices: [{ message: mesaj }] }), { status: 200 });
  };
  try {
    const k = kalfaHazirla({ kok: KOK, eserler, ortam: { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m" } });
    await k.calistir([{ rol: "usta", metin: "ping pong oyunu nasıl olur?" }]);
    await k.calistir([{ rol: "usta", metin: "ping pong oyunu nasıl olur?" }], undefined, { admin: true });
    const [usta, admin] = istekler.map((i) => i.messages[0].content);
    for (const istem of [usta, admin]) {
      assert.match(istem, /Uygulama içinde uygulama/);
      assert.match(istem, /ASLA bilgi yarışmasına/);
      assert.match(istem, /oyun\.dongu/);
      assert.match(istem, /tip: "tuval"/);
      assert.match(istem, /Çini Yakala/, "tuval oyunu örneği istemde");
      assert.match(istem, /konu dışı DEĞİLDİR/);
      assert.match(istem, /YAPABİLDİKLERİN/);
      assert.match(istem, /YAPAMADIKLARIN/);
      assert.match(istem, /boyama/);
    }
    assert.match(usta, /admin'e öneri gönderebileceğini/, "usta veri kuralları yerinde");
    assert.match(admin, /ADMİN KİPİ/);
    assert.doesNotMatch(admin, /admin'e öneri gönderebileceğini/);
  } finally { globalThis.fetch = asilFetch; }
});
