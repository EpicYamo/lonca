import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { kalfaHazirla, istemDegistir, izinliMaddeMetinleri } from "../server/kalfa.js";
import { kaynaktaDayanakVar, yuzyilKaynaktaVar, modulDogrulamasi, koddakiDisBaglantilar, adresAnahtari, bulunmaEki, vikipediIlListesi } from "../server/dis-kaynak.js";
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
  // Parantezli madde adresleri kesilmez; adresin dışındaki parantez ve noktalama adrese katılmaz.
  const hamam = "https://tr.wikipedia.org/wiki/%C4%B0sa_Bey_Hamam%C4%B1_(Sel%C3%A7uk)";
  assert.deepEqual(koddakiDisBaglantilar(`url: "${hamam}" (bkz. https://tr.wikipedia.org/wiki/Hisar_Camii). ${hamam.replace("(", "%28").replace(")", "%29")},`),
    [hamam, "https://tr.wikipedia.org/wiki/Hisar_Camii", hamam.replace("(", "%28").replace(")", "%29")]);
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

// ---------- İl düzeyinde genişleme (bilgi bankasında olmayan il, ör. İzmir) ----------
const IZMIR = {
  "Kategori:İzmir ilindeki camiler": [{ ns: 0, title: "Tire Ulu Camii" }, { ns: 14, title: "Kategori:Konak'taki camiler" }, { ns: 14, title: "Kategori:Konak'taki yapılar" }],
  "Kategori:Konak'taki camiler": [{ ns: 0, title: "Hisar Camii" }, { ns: 0, title: "Kemeraltı Camii (İzmir)" }],
  "Kategori:İzmir ilindeki hamamlar": [{ ns: 0, title: "Namazgâh Hamamı" }],
};
const MADDELER = {
  "Hisar Camii": "Hisar Camii, İzmir'in Konak ilçesinde Kemeraltı çarşısında bulunan bir camidir. Cami 1597 yılında yapılmıştır.",
  "Namazgâh Hamamı": "Namazgâh Hamamı, İzmir'in Konak ilçesinde bulunan tarihî bir hamamdır. Hamam Osmanlı döneminde yapılmıştır.",
  "Tire Ulu Camii": "Tire Ulu Camii, İzmir'in Tire ilçesinde bulunan bir camidir. Cami Aydınoğulları döneminde yapılmıştır.",
};
const vikiUrl = (b) => `https://tr.wikipedia.org/wiki/${encodeURIComponent(b.replace(/ /g, "_"))}`;
const izmirIstekleri = [];
const izmirFetch = async (url) => {
  const u = new URL(url);
  const p = u.searchParams;
  izmirIstekleri.push(Object.fromEntries(p));
  if (p.get("prop") === "categoryinfo") {
    return Response.json({ query: { pages: p.get("titles").split("|").map((t) => (IZMIR[t] ? { title: t, categoryinfo: { pages: 1, subcats: 1 } } : { title: t, missing: true })) } });
  }
  if (p.get("list") === "categorymembers") return Response.json({ query: { categorymembers: IZMIR[p.get("cmtitle")] ?? [] } });
  if (p.get("list") === "search") return Response.json({ query: { search: p.get("srsearch").includes("han") ? [{ title: "Kızlarağası Hanı", snippet: "han" }] : [] } });
  const b = p.get("titles");
  return Response.json({ query: { pages: [MADDELER[b] ? { title: b, fullurl: vikiUrl(b), extract: MADDELER[b] } : { title: b, missing: true }] } });
};

test("bulunma eki ünlü uyumu ve sertleşmeyle", () => {
  assert.deepEqual(["İzmir", "Bursa", "Sinop", "Kars", "Konya", "Tokat", "Bolu", "Ürgüp"].map(bulunmaEki),
    ["İzmir'deki", "Bursa'daki", "Sinop'taki", "Kars'taki", "Konya'daki", "Tokat'taki", "Bolu'daki", "Ürgüp'teki"]);
});

test("il listesi: dolu kategoriler, aynı türün alt kategorileri ve arama birleşir, tekrarsız", async () => {
  izmirIstekleri.length = 0;
  const r = await vikipediIlListesi({ il: "İzmir" }, izmirFetch);
  const basliklar = r.sonuclar.map((x) => x.baslik);
  assert.deepEqual(new Set(basliklar), new Set(["Tire Ulu Camii", "Namazgâh Hamamı", "Hisar Camii", "Kemeraltı Camii (İzmir)", "Kızlarağası Hanı"]));
  assert.equal(new Set(basliklar).size, basliklar.length);
  assert.ok(r.kategoriler.includes("Konak'taki camiler"));
  assert.ok(!r.kategoriler.includes("Konak'taki yapılar")); // başka türün alt kategorisine inilmez
  // Olmayan kategorilerin üyeleri tek tek sorulmaz: önce tek istekte varlık denetimi.
  const uyeIstekleri = izmirIstekleri.filter((x) => x.list === "categorymembers").map((x) => x.cmtitle);
  assert.deepEqual(new Set(uyeIstekleri), new Set(["Kategori:İzmir ilindeki camiler", "Kategori:İzmir ilindeki hamamlar", "Kategori:Konak'taki camiler"]));
  assert.ok(izmirIstekleri.find((x) => x.prop === "categoryinfo").titles.includes("Kategori:İzmir'deki camiler"));
});

test("istem: admin istemi usta yönlendirme satırını ve kayıtlı iller kısıtını içermez, usta istemi içerir", async () => {
  const yanit = ["yanit_ver", { metin: "Merhaba", oneriler: ["Başlayalım"] }];
  const s = saglayici([yanit, yanit]);
  try {
    const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: izmirFetch });
    await k.calistir([{ rol: "usta", metin: "İzmir'deki vakıf eserleriyle bir rehber yap" }]);
    await k.calistir([{ rol: "usta", metin: "İzmir'deki vakıf eserleriyle bir rehber yap" }], undefined, { admin: true });
  } finally { s.geri(); }
  const [usta, admin] = s.istekler.map((x) => x.messages[0].content);
  const yonlendirme = "- Usta bilgi bankasında OLMAYAN bir eser";
  assert.ok(usta.includes(yonlendirme) && usta.includes("- KAPSAM: Yalnızca bilgi bankamızdaki") && usta.includes("Şu an kayıtlı iller:"));
  assert.ok(!admin.includes(yonlendirme) && !admin.includes("- KAPSAM: Yalnızca bilgi bankamızdaki") && !admin.includes("Şu an kayıtlı iller:"));
  assert.match(admin, /"yalnızca kayıtlı illeri yapabilirim" DEME/);
  assert.match(admin, /Bilgi bankasındaki \(doğrulanmış\) iller: .*; diğer iller için izinle dış kaynak kullanılabilir\./);
  assert.ok(!usta.includes("dis_kaynak_liste") && admin.includes("dis_kaynak_liste"));
  assert.ok(s.istekler[1].tools.some((t) => t.function.name === "dis_kaynak_liste"));
  assert.ok(!s.istekler[0].tools.some((t) => t.function.name === "dis_kaynak_liste"));
  assert.throws(() => istemDegistir("a b", [["c", "d"]]), /bulunamadı/);
});

test("admin: dis_kaynak_liste izinsiz reddedilir, izinle il maddelerini döndürür", async () => {
  const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: izmirFetch });
  let s = saglayici([["dis_kaynak_liste", { il: "İzmir" }], ["izin_iste", { tur: "dis_kaynak", konu: "İzmir", soru: "İzmir için Vikipedi'den toplayayım mı?" }]]);
  let r;
  try { r = await k.calistir([{ rol: "usta", metin: "İzmir'deki vakıf eserleriyle bir rehber yap" }], undefined, { admin: true }); } finally { s.geri(); }
  assert.match(s.aracYaniti(1), /izin vermedi/);
  assert.equal(r.izin.tur, "dis_kaynak");
  const durum = r.kalfaDurumu;
  Object.assign(durum.izinler[0], { durum: "verildi", karar: "ver" });
  s = saglayici([["dis_kaynak_liste", { il: "İzmir" }], ["yanit_ver", { metin: "Buldum." }]]);
  try { r = await k.calistir([{ rol: "usta", metin: "İzin veriyorum" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  const liste = JSON.parse(s.aracYaniti(1));
  assert.ok(liste.sonuclar.some((x) => x.baslik === "Hisar Camii"));
  assert.ok(r.aramalar.some((a) => a.dis?.includes("İzmir")));
});

test("admin: toplu kayıt izniyle iki madde eklenir, izinsiz üçüncü ve aynı maddeye ikinci ekleme reddedilir", async () => {
  const eserler = [...hamEserler];
  const eklenen = [];
  const eserEkle = async (veri) => { const e = { id: `izmir-${eklenen.length + 1}`, ...veri }; eklenen.push(e); eserler.push(e); return { eser: e }; };
  const k = kalfaHazirla({ kok: KOK, eserler, ortam: ORTAM, disFetch: izmirFetch, eserEkle });
  const [hisar, hamam, tire] = ["Hisar Camii", "Namazgâh Hamamı", "Tire Ulu Camii"].map(vikiUrl);
  let durum = { izinler: [{ id: "d1", tur: "dis_kaynak", konu: "İzmir", durum: "verildi", karar: "ver" }], disKaynaklar: [] };

  // Üç madde okunur; toplu kayıt kartı yalnızca ikisini kapsar.
  let s = saglayici([
    ["dis_kaynak_oku", { baslik: "Hisar Camii" }], ["dis_kaynak_oku", { baslik: "Namazgâh Hamamı" }], ["dis_kaynak_oku", { baslik: "Tire Ulu Camii" }],
    ["izin_iste", { tur: "kayit", konu: "İzmir", soru: "Bu iki madde bilgi bankasına eklensin mi?", kaynak_urller: [hisar, hamam, "https://tr.wikipedia.org/wiki/Okunmamis"] }],
    ["izin_iste", { tur: "kayit", konu: "İzmir", soru: "Bu iki madde bilgi bankasına eklensin mi?", kaynak_urller: [hisar, hamam] }],
  ]);
  let r;
  try { r = await k.calistir([{ rol: "usta", metin: "Devam" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  assert.match(s.aracYaniti(4), /Okunmamis: önce dis_kaynak_oku/);
  assert.deepEqual(r.izin.maddeler.map((m) => m.baslik), ["Hisar Camii", "Namazgâh Hamamı"]);
  assert.equal(r.izin.kaynak_url, undefined);
  durum = r.kalfaDurumu;
  assert.equal(durum.disKaynaklar.length, 3);
  const izin = durum.izinler.at(-1);
  assert.deepEqual(izin.urller, [hisar, hamam]);
  Object.assign(izin, { durum: "verildi", karar: "bilgi-bankasi" });

  const kayit = (url, ad, tur, tarihce) => ["bilgi_bankasina_ekle", { kaynak_url: url, ad, il: "İzmir", ilce: "Konak", tur, tarihce }];
  s = saglayici([
    kayit(hisar, "Hisar Camii", "cami", "Hisar Camii Konak ilçesinde Kemeraltı çarşısında bulunan bir camidir. Cami 1597 yılında yapılmıştır."),
    kayit(tire, "Tire Ulu Camii", "cami", "Tire Ulu Camii Tire ilçesinde bulunan bir camidir. Cami Aydınoğulları döneminde yapılmıştır."),
    kayit(hamam, "Namazgâh Hamamı", "hamam", "Namazgâh Hamamı Konak ilçesinde bulunan tarihî bir hamamdır. Hamam Osmanlı döneminde yapılmıştır."),
    kayit(hisar, "Hisar Camii", "cami", "Hisar Camii Konak ilçesinde Kemeraltı çarşısında bulunan bir camidir."),
    ["yanit_ver", { metin: "Ekledim." }],
  ]);
  try { r = await k.calistir([{ rol: "usta", metin: "Bilgi bankasına eklensin" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  assert.match(s.aracYaniti(2), /izni vermedi/); // Tire: okundu ama izin kartında yoktu
  assert.match(s.aracYaniti(4), /izni vermedi/); // Hisar: izin bu madde için kullanıldı
  assert.deepEqual(eklenen.map((e) => e.ad), ["Hisar Camii", "Namazgâh Hamamı"]);
  assert.ok(eklenen.every((e) => e.dogrulanmis === false && e.kaynakTuru === "Vikipedi"));
  assert.deepEqual(eklenen.map((e) => e.kaynakUrl), [hisar, hamam]);
  const son = r.kalfaDurumu.izinler.at(-1);
  assert.equal(son.durum, "kullanildi");
  assert.deepEqual(son.kullanilanlar, [hisar, hamam]);
  assert.deepEqual(son.eserIdler, { [hisar]: "izmir-1", [hamam]: "izmir-2" });
});

// ---------- Uzun karar turu: izinli maddelerin metni kalfaya yeniden verilir ----------
test("karar turu: izinli ve kullanılmamış maddelerin metni son mesaja girer, sınırlar uygulanır", async () => {
  const madde = (i, uzunluk) => ({ kaynak: "Vikipedi", dil: "tr", baslik: `Madde ${i}`, url: vikiUrl(`Madde ${i}`), metin: `Metin${i} ${"x".repeat(uzunluk)}` });
  const disKaynaklar = Array.from({ length: 12 }, (_, i) => madde(i, 4000));
  const urller = disKaynaklar.slice(0, 11).map((d) => d.url);
  const durum = { disKaynaklar, izinler: [
    { id: "d1", tur: "dis_kaynak", konu: "İzmir", durum: "verildi", karar: "ver" },
    { id: "k1", tur: "kayit", konu: "İzmir", urller, kullanilanlar: [urller[0]], durum: "verildi", karar: "modul" },
    { id: "k2", tur: "kayit", konu: "Başka", urller: [disKaynaklar[11].url], durum: "reddedildi", karar: "reddet" },
  ] };
  const metin = izinliMaddeMetinleri(durum);
  assert.match(metin, /zaten okundu; yeniden dis_kaynak_oku çağırma/);
  assert.match(metin, /madde başına 2–4 kısa bilgi ya da soru, modül en çok ~400 satır/);
  assert.ok(!metin.includes("Metin0 ")); // kullanılmış madde
  assert.ok(!metin.includes("Metin11 ")); // reddedilen izin
  assert.ok(metin.includes(`### Madde 1 (${urller[1]})`));
  // Madde başına en çok 2500, toplam en çok 25000 karakter.
  const govdeler = metin.split("### ").slice(1).map((p) => p.slice(p.indexOf("\n") + 1).trimEnd().replace(/\)$/, ""));
  assert.ok(govdeler.every((g) => g.length <= 2501));
  assert.ok(govdeler.reduce((t, g) => t + g.length, 0) <= 25000 + govdeler.length);
  assert.equal(govdeler.length, 10);
  assert.equal(izinliMaddeMetinleri({ izinler: [{ tur: "kayit", durum: "bekliyor", urller }], disKaynaklar }), "");

  // calistir: metin son kullanıcı mesajında; okunmuş madde yeniden çekilmez.
  const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: async () => { throw new Error("Vikipedi'ye gidilmemeli"); } });
  const s = saglayici([["dis_kaynak_oku", { baslik: "Madde 3" }], ["yanit_ver", { metin: "Tamam", oneriler: ["Yap"] }]]);
  try { await k.calistir([{ rol: "usta", metin: "Yalnızca bu modüle özel kalsın" }], undefined, { admin: true, izinDurumu: durum }); } finally { s.geri(); }
  const son = s.istekler[0].messages.at(-1).content;
  assert.ok(son.startsWith("Yalnızca bu modüle özel kalsın") && son.includes("### Madde 2 ("));
  assert.match(s.aracYaniti(1), /Metin3/);
});

test("API: istemci bağlantıyı koparsa kalfa sunucuda sürer ve sonucu oturuma yazar", async () => {
  const asil = globalThis.fetch;
  globalThis.fetch = async (url, secenek) => {
    if (!String(url).startsWith("http://saglayici.test")) return asil(url, secenek);
    await new Promise((r) => setTimeout(r, 600)); // yavaş sağlayıcı
    const cagri = { id: "1", type: "function", function: { name: "yanit_ver", arguments: JSON.stringify({ metin: "Uzun iş bitti", oneriler: ["Devam"] }) } };
    return Response.json({ choices: [{ message: { role: "assistant", content: "", tool_calls: [cagri] } }] });
  };
  const s = await deneySunucusu({ ...ORTAM, KALFA_SAHTE: "" });
  try {
    await s.app.listen({ port: 0, host: "127.0.0.1" });
    const adres = `http://127.0.0.1:${s.app.server.address().port}`;
    const o = (await s.istek("POST", "/api/atolye/oturumlar", { yonetici: true, govde: {} })).json();
    const kes = new AbortController();
    const istek = asil(`${adres}/api/kalfa`, { method: "POST", signal: kes.signal, headers: { "content-type": "application/json", "x-yonetici-sifre": "gizli-sifre" }, body: JSON.stringify({ oturum: o.id, istek: "İzmir rehberi" }) });
    await new Promise((r) => setTimeout(r, 150));
    kes.abort(); // Cloudflare'in vazgeçmesi gibi
    await assert.rejects(istek);
    let son;
    for (let i = 0; i < 40; i++) {
      son = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { yonetici: true })).json();
      if (!son.bekleyen && son.mesajlar.length >= 2) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(son.bekleyen, null);
    assert.deepEqual(son.mesajlar.map((m) => [m.rol, m.metin]), [["usta", "İzmir rehberi"], ["kalfa", "Uzun iş bitti"]]);
  } finally { globalThis.fetch = asil; await s.app.close(); }
});

test("admin: adım sınırı aşılınca hata okunan maddeleri taşır (oturum yeniden okumaz)", async () => {
  const k = kalfaHazirla({ kok: KOK, eserler: [...hamEserler], ortam: ORTAM, disFetch: izmirFetch });
  const durum = { izinler: [{ id: "d1", tur: "dis_kaynak", konu: "İzmir", durum: "verildi", karar: "ver" }], disKaynaklar: [] };
  const s = saglayici(Array.from({ length: 18 }, () => ["dis_kaynak_oku", { baslik: "Hisar Camii" }]));
  let hata;
  try { await k.calistir([{ rol: "usta", metin: "İzin veriyorum" }], undefined, { admin: true, izinDurumu: durum }); } catch (h) { hata = h; } finally { s.geri(); }
  assert.equal(s.istekler.length, 18); // admin adım sınırı 18
  assert.match(hata.message, /yanıt üretemedi/);
  assert.deepEqual(hata.kalfaDurumu.disKaynaklar.map((d) => d.baslik), ["Hisar Camii"]);
  assert.equal(izmirIstekleri.filter((x) => x.titles === "Hisar Camii").length >= 1, true);
});
