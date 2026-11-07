import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { kalfaHazirla } from "../server/kalfa.js";
import { kaynaktaDayanakVar, yuzyilKaynaktaVar, modulDogrulamasi, koddakiDisBaglantilar, adresAnahtari } from "../server/dis-kaynak.js";
import { deneySunucusu, KOK } from "./yardimci.mjs";

const { eserler: hamEserler } = JSON.parse(await readFile(path.join(KOK, "data", "eserler.json"), "utf8"));
const ORTAM = { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: "http://saglayici.test/v1", KALFA_MODEL: "m" };
const MADDE_URL = "https://tr.wikipedia.org/wiki/Galata_Kulesi";
const MADDE = "Galata Kulesi, İstanbul'un Beyoğlu ilçesinde bulunan bir kuledir. Kule 1348 yılında Cenevizliler tarafından inşa edilmiştir. Osmanlı döneminde yangın gözetleme kulesi olarak kullanılmıştır.";

// Sahte Vikipedi: arama ve madde metni (koordinatlı).
const vikiFetch = async (url) => {
  const u = new URL(url);
  if (u.searchParams.get("list") === "search") return Response.json({ query: { search: [{ title: "Galata Kulesi", snippet: "<span>Galata</span> Kulesi" }] } });
  return Response.json({ query: { pages: [{ title: "Galata Kulesi", fullurl: MADDE_URL, extract: MADDE, coordinates: [{ lat: 41.0256, lon: 28.9741 }] }] } });
};
// Sahte sağlayıcı: sırayla verilen araç çağrıları; istekler kaydedilir.
function saglayici(adimlar) {
  const istekler = [];
  const asil = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => {
    istekler.push(JSON.parse(body));
    const [ad, girdi] = adimlar[istekler.length - 1];
    const mesaj = { role: "assistant", content: "", tool_calls: [{ id: String(istekler.length), type: "function", function: { name: ad, arguments: JSON.stringify(girdi) } }] };
    return Response.json({ choices: [{ message: mesaj }] });
  };
  return { istekler, geri: () => { globalThis.fetch = asil; }, aracYaniti: (i) => istekler[i].messages.at(-1).content };
}

test("uydurma denetimi: maddede olmayan yıl ve metin reddedilir", () => {
  assert.deepEqual(kaynaktaDayanakVar("Kule 1348 yılında Cenevizliler tarafından inşa edilmiştir.", MADDE), []);
  assert.ok(kaynaktaDayanakVar("Kule 1520 yılında Mimar Sinan tarafından onarıldı.", MADDE).some((h) => h.includes("1520")));
  assert.ok(kaynaktaDayanakVar("Kubbesi altın yaldızlı mozaiklerle süslenmiş muhteşem saray bahçeleri vardır.", MADDE).length);
  assert.ok(yuzyilKaynaktaVar(14, MADDE));
  assert.ok(!yuzyilKaynaktaVar(16, MADDE));
});

test("modül doğrulaması: Vikipedi bağlantısı ya da doğrulanmamış kayıt varsa tik yok", () => {
  const eserler = [{ id: "a", dogrulanmis: false, kaynakTuru: "Vikipedi" }, { id: "b" }];
  assert.deepEqual(modulDogrulamasi({ kod: `eserler.getir("b")`, eserler }), { dogrulanmis: true, kaynaklar: [] });
  assert.deepEqual(modulDogrulamasi({ kod: `eserler.getir("a")`, eserler }), { dogrulanmis: false, kaynaklar: ["Vikipedi"] });
  assert.equal(modulDogrulamasi({ kod: `const u = "${MADDE_URL}";`, eserler }).dogrulanmis, false);
  assert.deepEqual(koddakiDisBaglantilar(`"${MADDE_URL}" ve "https://tr.wikipedia.org/wiki/Galata%20Kulesi"`).length, 2);
  assert.equal(adresAnahtari(MADDE_URL), adresAnahtari("https://tr.wikipedia.org/wiki/Galata%20Kulesi"));
});

test("usta: dış kaynak araçları yok; bilgi bankasında olmayan eser için öneri kartı hazırlanır", async () => {
  const s = saglayici([
    ["izin_iste", { tur: "dis_kaynak", konu: "Galata Kulesi", soru: "?" }],
    ["eser_istegi", { metin: "Galata Kulesi bilgi bankamızda yok. İstersen admin'e eklenmesi için öneri gönderebilirsin.", ad: "Galata Kulesi", il: "İstanbul", not: "Çocuklar için kule oyunu" }],
  ]);
  try {
    const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: vikiFetch });
    const r = await k.calistir([{ rol: "usta", metin: "Galata Kulesi hakkında bir oyun" }]);
    const araclar = s.istekler[0].tools.map((t) => t.function.name);
    assert.ok(araclar.includes("eser_istegi") && !araclar.includes("dis_kaynak_oku") && !araclar.includes("bilgi_bankasina_ekle"));
    assert.match(s.aracYaniti(1), /Bilinmeyen araç/);
    assert.equal(r.tur, "sohbet");
    assert.deepEqual(r.eserIstegi, { ad: "Galata Kulesi", il: "İstanbul", not: "Çocuklar için kule oyunu" });
    assert.equal(r.kalfaDurumu, undefined);
  } finally { s.geri(); }
});

test("admin: izinsiz dış kaynak yok, izinle okur, ayrı izinle ve uydurmadan bilgi bankasına ekler", async () => {
  const eserler = [...hamEserler];
  const eklenen = [];
  const eserEkle = async (veri) => { const e = { id: "istanbul-galata-kulesi", ...veri }; eklenen.push(e); eserler.push(e); return { eser: e }; };
  const k = kalfaHazirla({ kok: KOK, eserler, ortam: ORTAM, disFetch: vikiFetch, eserEkle });

  // 1. İzin yokken okuma reddedilir; kalfa izin ister.
  let s = saglayici([["dis_kaynak_oku", { baslik: "Galata Kulesi" }], ["izin_iste", { tur: "dis_kaynak", konu: "Galata Kulesi", soru: "Vikipedi'den bilgi çekeyim mi?" }]]);
  let r;
  try { r = await k.calistir([{ rol: "usta", metin: "Galata Kulesi için bir rehber" }], undefined, { admin: true }); } finally { s.geri(); }
  assert.match(s.aracYaniti(1), /izin vermedi/);
  assert.equal(r.izin.tur, "dis_kaynak");
  let durum = r.kalfaDurumu;
  assert.equal(durum.izinler[0].durum, "bekliyor");

  // 2. Admin izin verdi: madde okunur, kayıt kararı için ikinci izin istenir.
  Object.assign(durum.izinler[0], { durum: "verildi", karar: "ver" });
  s = saglayici([["dis_kaynak_ara", { sorgu: "Galata Kulesi" }], ["dis_kaynak_oku", { baslik: "Galata Kulesi" }],
    ["izin_iste", { tur: "kayit", konu: "Galata Kulesi", soru: "Bilgi bankasına ekleyeyim mi?", kaynak_url: MADDE_URL }]]);
  try { r = await k.calistir([{ rol: "usta", metin: "İzin veriyorum" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  assert.equal(r.izin.tur, "kayit");
  assert.equal(r.izin.kaynak_url, MADDE_URL);
  durum = r.kalfaDurumu;
  assert.equal(durum.disKaynaklar.length, 1);
  assert.deepEqual(r.kaynaklar.dis.map((d) => d.url), [MADDE_URL]);

  // 3. "Bilgi bankasına ekle": uydurma yıl reddedilir, maddeye dayanan kayıt eklenir; izin bir kez kullanılır.
  Object.assign(durum.izinler[1], { durum: "verildi", karar: "bilgi-bankasi" });
  const kayit = { kaynak_url: MADDE_URL, ad: "Galata Kulesi", il: "İstanbul", ilce: "Beyoğlu", tur: "diger" };
  s = saglayici([
    ["bilgi_bankasina_ekle", { ...kayit, tarihce: "Kule 1453 yılında Fatih Sultan Mehmet tarafından yaptırılmıştır." }],
    ["bilgi_bankasina_ekle", { ...kayit, yuzyil: 14, tarihce: "Galata Kulesi Beyoğlu ilçesinde bulunan bir kuledir. Kule 1348 yılında Cenevizliler tarafından inşa edilmiştir." }],
    ["bilgi_bankasina_ekle", { ...kayit, tarihce: "Galata Kulesi Beyoğlu ilçesinde bulunan bir kuledir." }],
    ["yanit_ver", { metin: "Ekledim." }],
  ]);
  try { r = await k.calistir([{ rol: "usta", metin: "Bilgi bankasına eklensin" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  assert.match(s.aracYaniti(1), /1453/);
  assert.match(s.aracYaniti(3), /izni vermedi/); // aynı izinle ikinci ekleme yok
  assert.equal(eklenen.length, 1);
  assert.equal(eklenen[0].dogrulanmis, false);
  assert.equal(eklenen[0].kaynakUrl, MADDE_URL);
  assert.deepEqual(eklenen[0].konum, { lat: 41.0256, lng: 28.9741 });
  assert.equal(r.kalfaDurumu.izinler[1].durum, "kullanildi");
});

test("admin: modüle özel dış içerik bağlantı ve uyarı ister; okunmamış madde bağlantısı reddedilir", async () => {
  const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: vikiFetch });
  const madde = { kaynak: "Vikipedi", dil: "tr", baslik: "Galata Kulesi", url: MADDE_URL, metin: MADDE, konum: null };
  const durum = { disKaynaklar: [madde], izinler: [
    { id: "a1", tur: "dis_kaynak", konu: "Galata Kulesi", durum: "verildi", karar: "ver" },
    { id: "a2", tur: "kayit", konu: "Galata Kulesi", kaynak_url: MADDE_URL, baslik: "Galata Kulesi", durum: "verildi", karar: "modul" }] };
  const kod = (ek) => `import { sahne } from "@lonca/sdk";\n${ek}\nexport default async function basla() {\n  await sahne.ayarla({ baslik: "Kule", tema: { zemin: "gece" } });\n  await sahne.ciz({ tip: "metin", metin: "x" });\n}\n`;
  const modul = (k2) => ["modul_yaz", { id: "galata", ad: "Galata", aciklama: "x", aciklama_ustaya: "x", kod: k2 }];
  const s = saglayici([
    modul(kod("const DIS_ICERIK = { ad: \"Galata Kulesi\" };")),
    modul(kod(`const DIS_ICERIK = { kaynak: { ad: "Vikipedi", url: "https://tr.wikipedia.org/wiki/Uydurma" } };`)),
    modul(kod(`const DIS_ICERIK = { uyari: "Kaynak doğrulanmamış: Vikipedi", kaynak: { ad: "Vikipedi", url: "${MADDE_URL}" } };`)),
  ]);
  let r;
  try { r = await k.calistir([{ rol: "usta", metin: "Modüle özel kalsın, yap" }], undefined, { admin: true, izinDurumu: durum, insa: true }); } finally { s.geri(); }
  assert.match(s.aracYaniti(1), /bağlantısını/);
  assert.match(s.aracYaniti(2), /Uydurma: bu madde okunmadı/);
  assert.equal(r.tur, "modul");
  assert.deepEqual(r.disKaynaklar.map((d) => d.url), [MADDE_URL]);
});

test("API: usta eser isteği gönderir, admin listede görür; modül kaydı doğrulama taşır", async () => {
  const s = await deneySunucusu();
  assert.equal((await s.istek("POST", "/api/eser-oneriler", { govde: { tur: "istek", istek: { ad: "Galata Kulesi", il: "İstanbul" } } })).statusCode, 401);
  const y = await s.istek("POST", "/api/eser-oneriler", { usta: true, govde: { tur: "istek", istek: { ad: "Galata Kulesi", il: "İstanbul", not: "Kule oyunu" } } });
  assert.equal(y.statusCode, 201);
  assert.equal((await s.istek("POST", "/api/eser-oneriler", { usta: true, govde: { tur: "istek", istek: { ad: "galata kulesi" } } })).json().zatenVar, true);
  const liste = (await s.istek("GET", "/api/eser-oneriler", { yonetici: true })).json();
  assert.equal(liste[0].tur, "istek");
  assert.equal(liste[0].oneren, "test-usta");
  assert.equal(liste[0].istek.ad, "Galata Kulesi");
  const karar = await s.istek("POST", `/api/eser-oneriler/${liste[0].id}/karar`, { yonetici: true, govde: { karar: "onayla" } });
  assert.equal(karar.statusCode, 200);
  assert.equal(karar.json().eser, null);

  const kod = (ek) => `import { sahne } from "@lonca/sdk";\nexport default async function basla() {\n  await sahne.ayarla({ baslik: "T", tema: { zemin: "gece" } });\n  await sahne.ciz({ tip: "metin", metin: "${ek}" });\n}\n`;
  const m1 = await s.istek("POST", "/api/moduller", { yonetici: true, govde: { id: "vakif-m", ad: "V", kod: kod("x") } });
  assert.deepEqual(m1.json().dogrulama, { dogrulanmis: true, kaynaklar: [] });
  const m2 = await s.istek("POST", "/api/moduller", { yonetici: true, govde: { id: "viki-m", ad: "W", kod: kod(`Kaynak doğrulanmamış: Vikipedi ${MADDE_URL}`) } });
  assert.deepEqual(m2.json().dogrulama, { dogrulanmis: false, kaynaklar: ["Vikipedi"] });
});

test("API: izin kartını yalnızca admin yanıtlar", async () => {
  const s = await deneySunucusu();
  const o = (await s.istek("POST", "/api/atolye/oturumlar", { usta: true, govde: {} })).json();
  const y = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "evet", izin: { id: "abcd1234", karar: "ver" } } });
  assert.equal(y.statusCode, 403);
  const o2 = (await s.istek("POST", "/api/atolye/oturumlar", { yonetici: true, govde: {} })).json();
  const y2 = await s.istek("POST", "/api/kalfa", { yonetici: true, govde: { oturum: o2.id, istek: "evet", izin: { id: "abcd1234", karar: "ver" } } });
  assert.equal(y2.statusCode, 404);
});
