import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { kalfaHazirla, insaIstegiMi, insaIzniVar } from "../server/kalfa.js";
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
    const r = await kalfa.calistir([{ rol: "usta", metin: istek }], undefined, { insa: true });
    assert.deepEqual(kalfa.dogrula(r.kod), [], istek);
  }
});

test("açık bir yapım isteği yoksa kalfa sohbet eder, kod yazmaz", async () => {
  const r = await kalfa.calistir([{ rol: "usta", metin: "Çocuklar için hanlarda hazine avı" }]);
  assert.equal(r.tur, "sohbet");
  assert.equal(r.kod, undefined);
  assert.ok(r.oneriler.length >= 2 && r.oneriler.length <= 3);
  const m = await kalfa.calistir([{ rol: "usta", metin: "Çocuklar için hanlarda hazine avı" }, { rol: "kalfa", metin: "…" }, { rol: "usta", metin: "Tamam, yap" }]);
  assert.equal(m.tur, "modul");
  assert.deepEqual(kalfa.dogrula(m.kod), []);
});

test("modül yalnızca bilgi bankasındaki eserleri, illeri ve türleri kullanabilir", () => {
  const hatalar = kalfa.dogrula(sarmala(`  const e = await eserler.getir("eyfel-kulesi");\n  const l = await eserler.liste({ il: "Paris", tur: "kule" });`));
  assert.ok(hatalar.some((h) => h.includes("eyfel-kulesi")), "olmayan eser kimliği");
  assert.ok(hatalar.some((h) => h.includes("Paris")), "olmayan il");
  assert.ok(hatalar.some((h) => h.includes("kule")), "olmayan tür");
  assert.deepEqual(kalfa.dogrula(sarmala(`  const e = await eserler.getir("bursa-ulucami");\n  const l = await eserler.liste({ il: "Bursa", tur: "han" });\n  await sahne.ciz({ tip: "metin", metin: String(e?.ad ?? l.length) });`)), []);
});

test("yapım isteği sezgisi: yapı/yazı gibi adlar istek sayılmaz", () => {
  for (const m of ["bunu yap", "Modülü oluştur", "inşa et", "kodla şunu", "renkleri değiştir", "bir başarım ekle", "evet", "tamam", "yazar mısın", "yapabilir misin"]) assert.ok(insaIstegiMi(m), m);
  for (const m of ["Bu yapı ne zaman inşaat edildi?", "kitabedeki yazı ne diyor", "hanlarda hazine avı", "Ulucami'nin banisi kim?", "SDK'da harita var mı", "Vakfın kurucusu kim?"]) assert.ok(!insaIstegiMi(m), m);
});

test("kod yazma yalnızca 'yap' kelimesine bağlı değil: düz soruda reddedilir, istek her biçimde kabul edilir", () => {
  for (const m of ["şunu da ekleyelim", "Haritası da olsun", "başlayalım", "hazırla bakalım", "renkler mavi olsun", "Harika, devam", "bir puan tablosu koy", "Bunu bana kodlar mısın?", "Bursa hanlarıyla bir oyun istiyorum"]) assert.ok(insaIzniVar(m), m);
  for (const m of ["Koza Han'ı kim yaptırdı?", "SDK'da harita var mı", "Bu modül nasıl çalışıyor?", "Hangi eserler var"]) assert.ok(!insaIzniVar(m), m);
});

test("kalfa bilgi bankasından yanıtlar; kaynaklar yalnızca araçların döndürdüğü eserlerden kurulur", async () => {
  const asilFetch = globalThis.fetch;
  const istekler = [];
  // Sahte sağlayıcı: önce eser_ara + eser_bilgisi, sonra izinsiz modul_yaz, en sonda yanit_ver.
  const yanitlar = [
    { tool_calls: [{ id: "1", type: "function", function: { name: "eser_ara", arguments: JSON.stringify({ ad: "Ulucami", il: "Bursa" }) } },
      { id: "2", type: "function", function: { name: "eser_bilgisi", arguments: JSON.stringify({ id: "bursa-ulucami" }) } }] },
    { tool_calls: [{ id: "3", type: "function", function: { name: "modul_yaz", arguments: JSON.stringify({ id: "x", ad: "x", aciklama: "x", kod: "x", aciklama_ustaya: "x" }) } }] },
    { tool_calls: [{ id: "4", type: "function", function: { name: "yanit_ver", arguments: JSON.stringify({
      metin: "Ulucami'nin açılışı 1399'da yapılmış.", kaynaklar: ["bursa-ulucami", "uydurma-eser"], sdk: ["eserler.getir", "eserler.uydurma", "kapak", "fetch"],
      oneriler: ["Bunu bir yarışmaya çevir", "Bunu bir yarışmaya çevir", "Başka hangi camiler var?", "Fotoğrafları göster", "fazla"] }) } }] },
  ];
  globalThis.fetch = async (_url, { body }) => {
    istekler.push(JSON.parse(body));
    const mesaj = { role: "assistant", content: "", ...yanitlar[istekler.length - 1] };
    return new Response(JSON.stringify({ choices: [{ message: mesaj }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const iliskiler = JSON.parse(await readFile(path.join(KOK, "data", "eser-iliskileri.json"), "utf8")).iliskiler;
    const k = kalfaHazirla({ kok: KOK, eserler, iliskiler, ortam: { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m" } });
    const r = await k.calistir([{ rol: "usta", metin: "Ulucami ne zaman açıldı?" }]);
    assert.equal(r.tur, "sohbet");
    assert.equal(r.metin, "Ulucami'nin açılışı 1399'da yapılmış.");
    assert.deepEqual(r.kaynaklar.eserler.map((e) => e.id), ["bursa-ulucami"]);
    assert.match(r.kaynaklar.eserler[0].kaynak, /Vakıf Katılım/);
    assert.deepEqual(r.kaynaklar.sdk, ["eserler.getir", "kapak"]);
    assert.deepEqual(r.oneriler, ["Bunu bir yarışmaya çevir", "Başka hangi camiler var?", "Fotoğrafları göster"]);
    // eser_bilgisi tarihçeyi ve kaynağı verdi; izinsiz modul_yaz reddedildi.
    const araclar = istekler[1].messages.filter((m) => m.role === "tool");
    assert.match(araclar.find((m) => m.tool_call_id === "2").content, /Vakıf Katılım/);
    assert.match(istekler[2].messages.find((m) => m.tool_call_id === "3").content, /yazmanı istemedi/);
  } finally { globalThis.fetch = asilFetch; }
});

test("araç çağırmadan düz metinle yanıtlayan model sohbet yanıtı sayılır", async () => {
  const asilFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Merhaba usta!" } }] }), { status: 200 });
  try {
    const k = kalfaHazirla({ kok: KOK, eserler, ortam: { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m" } });
    const r = await k.calistir([{ rol: "usta", metin: "merhaba" }]);
    assert.equal(r.tur, "sohbet");
    assert.equal(r.metin, "Merhaba usta!");
  } finally { globalThis.fetch = asilFetch; }
});

test("giriş yapmamış biri kalfayla konuşamaz", async () => {
  const s = await deneySunucusu();
  const y = await s.istek("POST", "/api/kalfa", { govde: { sohbet: [{ rol: "usta", metin: "bir oyun" }] } });
  assert.equal(y.statusCode, 401);
  await s.app.close();
});

test("kalfa uç noktası hız sınırına uyar", async () => {
  const s = await deneySunucusu({ KALFA_SINIR: "2" });
  const govde = { sohbet: [{ rol: "usta", metin: "bir oyun" }] };
  assert.equal((await s.istek("POST", "/api/kalfa", { govde, usta: true })).statusCode, 200);
  assert.equal((await s.istek("POST", "/api/kalfa", { govde, usta: true })).statusCode, 200);
  assert.equal((await s.istek("POST", "/api/kalfa", { govde, usta: true })).statusCode, 429);
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

test("let x = null; iç fonksiyonda atanan değişkenin never daraltması modülü reddetmez", () => {
  const kod = `import { sahne } from "@lonca/sdk";
export default async function basla() {
  let oyun = null;
  await sahne.ayarla({ baslik: "Deneme", tema: { zemin: "acik", renk: "firuze", yazi: "sans" } });
  await sahne.ciz({ tip: "metin", metin: "x" });
  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "dokun") oyunuKur();
    if (oyun && !oyun.cevap) oyun.sira++;
  }
  function oyunuKur() { oyun = { sira: 0, cevap: null }; }
}`;
  assert.deepEqual(kalfa.dogrula(kod), []);
  assert.ok(kalfa.dogrula(kod.replace("sahne.ciz(", "sahne.cizz(")).length, "gerçek tip hataları yine yakalanır");
});

test("sağlayıcı yanıt vermezse istek zaman aşımıyla anlaşılır biçimde biter", async () => {
  const asilFetch = globalThis.fetch;
  // AbortSignal.timeout timerı unref edebildiği için test bitene dek event loop'u açık tut.
  const beklet = setTimeout(() => {}, 500);
  globalThis.fetch = (_url, { signal }) => new Promise((_, red) => signal.addEventListener("abort", () => red(signal.reason)));
  try {
    const k = kalfaHazirla({ kok: KOK, eserler: [], ortam: { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m", KALFA_ZAMAN_ASIMI_SN: "0.05" } });
    await assert.rejects(k.calistir([{ rol: "usta", metin: "oyun" }]), /zaman aşımı/);
    // Dışarıdan iptal (model taraması) kendi gerekçesiyle biter; seçenekteki model istekte kullanılır.
    let istenenModel;
    globalThis.fetch = (_url, { signal, body }) => { istenenModel = JSON.parse(body).model; return new Promise((_, red) => signal.addEventListener("abort", () => red(signal.reason))); };
    const iptal = new AbortController();
    const is = k.calistir([{ rol: "usta", metin: "oyun" }], undefined, { model: "baska-model", sinyal: iptal.signal });
    iptal.abort(new Error("durduruldu"));
    await assert.rejects(is, /durduruldu/);
    assert.equal(istenenModel, "baska-model");
  } finally { clearTimeout(beklet); globalThis.fetch = asilFetch; }
});
