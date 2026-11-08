// Tuval oyunları: SDK'nın oyun.* akışı, kalfa denetimi ve istemdeki oyun yönergesi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { kalfaHazirla, eksikAdlariTamamla } from "../server/kalfa.js";
import { KOK, deneySunucusu } from "./yardimci.mjs";

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

test("oyun.boyut: önce uygulama ekranı, sonra tuvalin gerçek boyutu (boyut girdisi ve her kare)", () => {
  const { lonca, gelen } = cerceve();
  assert.deepEqual({ ...lonca.oyun.boyut("alan") }, { en: 360, boy: 640 });
  gelen({ tur: "calistir", kod: "", ekran: { en: 412, boy: 860 } });
  assert.deepEqual({ ...lonca.oyun.boyut("alan") }, { en: 412, boy: 860 }, "tuval ekrana gelmeden ekran boyutu");
  const olaylar = [];
  lonca.oyun.dinle("boyut", (o) => olaylar.push([o.en, o.boy]));
  gelen({ tur: "girdi", olay: { tur: "boyut", tuval: "alan", en: 390, boy: 780 } });
  assert.deepEqual({ ...lonca.oyun.boyut("alan") }, { en: 390, boy: 780 });
  assert.deepEqual({ ...lonca.oyun.boyut() }, { en: 390, boy: 780 }, "kimliksiz: ilk tuval");
  let karede = null;
  lonca.oyun.dongu(() => { karede = { ...lonca.oyun.boyut("alan") }; });
  gelen({ tur: "kare", dt: 0.016, t: 0.016, boyutlar: { alan: [1280, 800] } });
  assert.deepEqual(karede, { en: 1280, boy: 800 }, "kare güncel boyutu taşır");
  assert.deepEqual(olaylar, [[390, 780]]);
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
  await sahne.ciz({ tip: "tuval", id: "masa", cocuklar: [] });
  oyun.dongu((dt) => {
    const { en, boy } = oyun.boyut("masa");
    const p = oyun.dokunmalar("masa")[0];
    if (p) x = p.x;
    oyun.ciz("masa", (k) => { k.temizle("#000"); k.dikdortgen(x, boy - 40, en / 4, 12, "#fff", { yuvarlak: 6 }); });
    if (oyun.tus("ArrowLeft")) { oyun.ses("vurus"); oyun.titres("hafif"); }
  });`);
  assert.deepEqual(kalfa.dogrula(gecerli), []);
  assert.ok(kalfa.dogrula(oyunKodu(`  oyun.ciz("masa", (k) => k.temizle());`)).some((h) => h.includes("tuval")));
  // Sabit 360 × 640 tuval ekranda küçük kalır: tam ekran tuval ve oyun.boyut istenir.
  assert.ok(kalfa.dogrula(gecerli.replace(`id: "masa", cocuklar`, `id: "masa", en: 360, boy: 640, cocuklar`).replace(/const \{ en, boy \} = oyun\.boyut\("masa"\);/, "const en = 360, boy = 640;")).some((h) => h.includes("tam ekran")));
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
    await k.calistir([{ rol: "usta", metin: "ping pong oyunu nasıl olur?" }], undefined, { genis: true });
    await k.calistir([{ rol: "usta", metin: "ping pong oyunu nasıl olur?" }], undefined, { admin: true, genis: true });
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

// ---------- Genişletilmiş mod onayı ----------
const TUVAL_KODU = `import { sahne, oyun } from "@lonca/sdk";
export default async function basla() {
  await sahne.ayarla({ baslik: "Pong", tema: { zemin: "gece" } });
  await sahne.ciz({ tip: "tuval", id: "masa" });
  oyun.dongu(() => oyun.ciz("masa", (k) => k.temizle("#000")));
}
`;
const SAGLAYICI_ORTAMI = { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m" };
// Sahte sağlayıcı: sırayla verilen araç çağrıları; istekler (sistem istemi ve araçlar dahil) kaydedilir.
function saglayici(adimlar) {
  const istekler = [];
  const asil = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => {
    istekler.push(JSON.parse(body));
    const [ad, girdi] = adimlar[Math.min(istekler.length, adimlar.length) - 1];
    const mesaj = { role: "assistant", content: "", tool_calls: [{ id: String(istekler.length), type: "function", function: { name: ad, arguments: JSON.stringify(girdi) } }] };
    return Response.json({ choices: [{ message: mesaj }] });
  };
  return { istekler, geri: () => { globalThis.fetch = asil; } };
}
const istem = (i) => i.messages[0].content;
const araclar = (i) => i.tools.map((t) => t.function.name);

test("standart mod: oyun adı geçen istekte kart sunucudan çıkar; onaysız tuvalli kod da kart açar", async () => {
  const k = kalfaHazirla({ kok: KOK, eserler, ortam: SAGLAYICI_ORTAMI });
  // 1) Oyun adı: model hiç çağrılmadan kart (sınıflandırma modele bırakılmaz).
  let p = saglayici([["yanit_ver", { metin: "x" }]]);
  try {
    for (const istek of ["ping pong oyunu yap", "bana half life vakıf eseri yap. benzer olsun", "snake yap", "Mario gibi bir şey hazırla"]) {
      const r = await k.calistir([{ rol: "usta", metin: istek }]);
      assert.equal(r.izin?.tur, "genis_mod", istek);
      assert.equal(r.kalfaDurumu.izinler.at(-1).durum, "bekliyor");
    }
    assert.equal(p.istekler.length, 0, "sağlayıcıya istek gitmedi");
    // Soru turunda kendiliğinden kart yok; kalfa yanıtlar.
    const soru = await k.calistir([{ rol: "usta", metin: "ping pong oyununun kuralları neler?" }]);
    assert.equal(soru.izin, undefined);
  } finally { p.geri(); }
  // 2) Oyun adı yok ama model onaysız tuval kullandı: modül reddedilmez, ustaya kart gösterilir.
  p = saglayici([["modul_yaz", { id: "x", ad: "Kayan Toplar", aciklama: "x", kod: TUVAL_KODU, aciklama_ustaya: "x" }], ["genis_mod_iste", { konu: "x", metin: "x" }]]);
  try {
    const r = await k.calistir([{ rol: "usta", metin: "eğlenceli bir şey yap" }]);
    assert.doesNotMatch(istem(p.istekler[0]), /Örnek 2|interface Oyun|export const oyun|tip: "tuval"/);
    assert.match(istem(p.istekler[0]), /STANDART MOD/);
    assert.ok(araclar(p.istekler[0]).includes("genis_mod_iste"));
    assert.equal(r.tur, "sohbet");
    assert.equal(r.izin.tur, "genis_mod");
    assert.equal(r.izin.konu, "Kayan Toplar");
  } finally { p.geri(); }
  // 3) Model kendisi de kart isteyebilir (özellikleriyle).
  p = saglayici([["genis_mod_iste", { konu: "kayan toplar", metin: "Genişletilmiş mod gerekiyor.", ozellikler: ["tuval", "oyun döngüsü"] }]]);
  try {
    const r = await k.calistir([{ rol: "usta", metin: "eğlenceli bir şey yap" }]);
    assert.deepEqual(r.izin.ozellikler, ["tuval", "oyun döngüsü"]);
  } finally { p.geri(); }
});

test("onaylanınca genişletilmiş istem ve tuval açılır; standart seçilince yeniden sorulmaz", async () => {
  const k = kalfaHazirla({ kok: KOK, eserler, ortam: SAGLAYICI_ORTAMI });
  const karar = (karar) => ({ izinler: [{ id: "abcd1234", tur: "genis_mod", konu: "ping pong", durum: karar === "ac" ? "verildi" : "reddedildi", karar }], disKaynaklar: [] });
  let p = saglayici([["modul_yaz", { id: "pong", ad: "Pong", aciklama: "x", kod: TUVAL_KODU, aciklama_ustaya: "x" }]]);
  try {
    const r = await k.calistir([{ rol: "usta", metin: "Genişletilmiş modu aç: ping pong için … Modülü yaz." }], undefined, { izinDurumu: karar("ac") });
    assert.equal(r.tur, "modul");
    assert.equal(r.genisMod, true);
    assert.match(istem(p.istekler[0]), /Örnek 2 — tuval/);
    assert.ok(!araclar(p.istekler[0]).includes("genis_mod_iste"));
  } finally { p.geri(); }
  p = saglayici([["genis_mod_iste", { konu: "ping pong", metin: "Yine sorayım mı?" }], ["yanit_ver", { metin: "Standart bir masa tenisi yapalım." }]]);
  try {
    const r = await k.calistir([{ rol: "usta", metin: "Standart kalsın: ping pong için genişletilmiş modu açma." }], undefined, { izinDurumu: karar("standart") });
    assert.equal(r.tur, "sohbet");
    assert.match(p.istekler[0].messages.at(-1).content, /genişletilmiş modu açmadı/);
    assert.match(p.istekler[1].messages.at(-1).content, /standart kalmayı seçti/);
  } finally { p.geri(); }
  p = saglayici([["modul_yaz", { id: "pong", ad: "Pong", aciklama: "x", kod: TUVAL_KODU, aciklama_ustaya: "x" }], ["yanit_ver", { metin: "Standart yapayım." }]]);
  try {
    const r = await k.calistir([{ rol: "usta", metin: "Standart kalsın: ping pong için genişletilmiş modu açma; standart düğümlerle isteğe en yakın modülü yaz." }], undefined, { izinDurumu: karar("standart") });
    assert.equal(r.izin, undefined, "standart seçildikten sonra yeni kart yok");
    assert.match(p.istekler[1].messages.at(-1).content, /Genişletilmiş mod kapalı/);
  } finally { p.geri(); }
  // Studio'daki kod zaten tuval kullanıyorsa (onayla ya da elle yazılmış) değiştirmek için aynı sözleşme açılır.
  p = saglayici([["yanit_ver", { metin: "Tamam." }]]);
  try {
    await k.calistir([{ rol: "usta", metin: "rengi değiştir" }], TUVAL_KODU);
    assert.match(istem(p.istekler[0]), /Örnek 2 — tuval/);
  } finally { p.geri(); }
  // Elle yazılan ve hazır modüllerin denetimi (kalfa.dogrula) tam sözleşmeyle yapılır.
  assert.deepEqual(k.dogrula(TUVAL_KODU), []);
});

test("API: usta genişletilmiş mod kartını yanıtlar, dış kaynak kartını yanıtlayamaz; karar oturumda saklanır", async () => {
  const p = saglayici([["modul_yaz", { id: "pong", ad: "Pong", aciklama: "x", kod: TUVAL_KODU, aciklama_ustaya: "x" }]]);
  const s = await deneySunucusu({ ...SAGLAYICI_ORTAMI, KALFA_SAHTE: "" });
  try {
    const o = (await s.istek("POST", "/api/atolye/oturumlar", { usta: true, govde: {} })).json();
    const y1 = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "ping pong oyunu yap" } });
    assert.equal(y1.statusCode, 200);
    const izin = y1.json().izin;
    assert.equal(p.istekler.length, 0, "kartı sunucu çıkardı");
    assert.equal(izin.tur, "genis_mod");
    // Usta dış kaynak kararı veremez; genişletilmiş mod kartında da yalnızca ac | standart geçerlidir.
    assert.equal((await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "evet", izin: { id: izin.id, karar: "ver" } } })).statusCode, 403);
    const y2 = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "Genişletilmiş modu aç", izin: { id: izin.id, karar: "ac" } } });
    assert.equal(y2.statusCode, 200);
    assert.equal(y2.json().tur, "modul");
    assert.equal(y2.json().genisMod, true);
    assert.match(y2.json().istek, /Genişletilmiş modu aç/);
    assert.match(istem(p.istekler.find((i) => araclar(i).includes("modul_yaz"))), /Örnek 2 — tuval/, "onay oturumdan okundu");
    // Aynı kart ikinci kez yanıtlanamaz.
    assert.equal((await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "x", izin: { id: izin.id, karar: "standart" } } })).statusCode, 409);
  } finally { p.geri(); }
});

test("modul_yaz'da unutulan ad ve açıklama koddan ve ustaya açıklamadan tamamlanır", () => {
  const g = eksikAdlariTamamla({ kod: TUVAL_KODU, aciklama_ustaya: "Gerçek bir ping pong yaptım. Raketi sürükle." });
  assert.equal(g.ad, "Pong");
  assert.equal(g.aciklama, "Gerçek bir ping pong yaptım.");
  assert.equal(eksikAdlariTamamla({ kod: TUVAL_KODU, ad: "Benim", aciklama: "x" }).ad, "Benim");
});
