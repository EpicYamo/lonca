import { test } from "node:test";
import assert from "node:assert/strict";
import { bakislariTemizle, kaynakKaniti, cumleler, eksikCumleleriEkle } from "../server/dalis-kalfasi.js";

const envanter = "Külliye, Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi. Avlunun batısında bir medrese bulunur.";
const vikipedi = "Yapı, Bursa'daki tarihî çarşı bölgesinde yer alır.";

test("dalış kaynak kanıtı yalnızca kaynaktaki aynen alıntıyı kabul eder", () => {
  assert.equal(kaynakKaniti("E", "Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi.", { E: envanter }), true);
  assert.equal(kaynakKaniti("E", "Çelebi Mehmed tarafından 1420'de inşa edildi.", { E: envanter }), false);
  assert.equal(kaynakKaniti("V", "tarihî çarşı bölgesinde yer alır", { V: vikipedi }), true);
  assert.equal(kaynakKaniti("G", "genel bir iddia", { E: envanter }), false);
});

test("dalış bilgi kartları kanıtsız iddiaları ve alıntıyla uyuşmayan tarihleri çıkarır", () => {
  const kartlar = bakislariTemizle([
    { k: "E", u: "Envanter", b: "Külliyenin tarihi", m: "Çelebi Mehmed külliyeyi 1414-1419 arasında inşa ettirdi.", kanit: "Külliye, Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi." },
    { k: "V", b: "Çarşı", m: "Eser tarihî çarşı bölgesinde yer alır.", kanit: "Yapı, Bursa'daki tarihî çarşı bölgesinde yer alır." },
    { k: "E", b: "Kanıtsız kişi", m: "Sultan Murad yapıyı yaptırdı.", kanit: "Külliye, Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi." },
    { k: "G", b: "Kubbe", m: "Bu kubbe 16. yüzyılda yapılmıştır." },
    { k: "E", b: "Yanlış tarih", m: "Yapı 1420'de tamamlandı.", kanit: "Külliye, Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi." },
    { k: "E", b: "Kanıtsız", m: "Bu yapı çok ünlüdür." },
    { k: "bilinmiyor", b: "Belirsiz kaynak", m: "Bir iddia." },
    { k: "G", b: "Gizemli unsur", m: "Bilinmeyen bir şey." },
  ], new Set(["E", "V", "G"]), { E: envanter, V: vikipedi });

  assert.equal(kartlar.length, 3);
  assert.deepEqual(kartlar.map((k) => k.k), ["E", "V", "G"]);
  assert.ok(kartlar.every((k) => k.b !== "Kanıtsız kişi"));
  assert.equal(kartlar[0].m, "Çelebi Mehmed külliyeyi 1414-1419 arasında inşa ettirdi.");
  assert.equal(kartlar[2].m, "Yapının üstünü örten yarım küre biçimli örtü.");
  assert.ok(kartlar.every((k) => !("kanit" in k)));
});

test("tarihsel bağ kartları bağın kendi künyesini, envanter kartları eserin cilt/sayfa künyesini taşır", () => {
  const baglar = [{ metin: "Yeşil İmareti: Aynı külliyenin parçası. İmaret, külliyenin vakfettiği mülklerin geliriyle işletilmiştir.", kaynak: "Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 373" }];
  const kanitlar = [];
  const kartlar = bakislariTemizle([
    { k: "B", u: "Tarihsel bağ", b: "Yeşil İmareti", m: "Yeşil İmareti, külliyenin vakfettiği mülklerin geliriyle işletilmiştir.", kanit: "İmaret, külliyenin vakfettiği mülklerin geliriyle işletilmiştir." },
    { k: "E", u: "Yapım", b: "Külliye", m: "Çelebi Mehmed 1414-1419 arasında inşa ettirdi.", kanit: "Çelebi Mehmed tarafından 1414-1419 arasında inşa edildi." },
    { k: "B", b: "Uydurma bağ", m: "Bir başka bağ.", kanit: "Bu cümle hiçbir bağda geçmiyor, uydurmadır." },
  ], new Set(["E", "B"]), { E: envanter, B: baglar, kunye: "Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 370" }, kanitlar);
  assert.deepEqual(kartlar.map((k) => [k.k, k.ky]), [["B", "Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 373"], ["E", "Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 370"]]);
  assert.equal(kanitlar.length, 2);
});

test("envanter cümleleri kısaltmalarda bölünmez", () => {
  const c = cumleler("Koza Han, Sultan II. Bayezid tarafından inşa ettirilmiştir. H. 1040 / M. 1630 tarihli bir belgede onarım anılır. Kısa.");
  assert.deepEqual(c, ["Koza Han, Sultan II. Bayezid tarafından inşa ettirilmiştir.", "H. 1040 / M. 1630 tarihli bir belgede onarım anılır."]);
});

test("planın kullanmadığı envanter cümleleri duraklara aynen eklenir, uydu karelerine eklenmez", () => {
  const kareler = [{ g: "u6", t: "uydu" }, { g: "d1", t: "gercek", k: [] }, { g: "m", t: "canlandirma", k: [] }];
  const kanitlar = ["celebi mehmed tarafindan 1414 1419 arasinda insa edildi"];
  const eklenen = eksikCumleleriEkle(kareler, envanter, kanitlar, "Cilt 2, s. 370");
  assert.equal(eklenen, 1);
  assert.equal(kareler[0].k, undefined);
  const kart = [...kareler[1].k, ...kareler[2].k][0];
  assert.equal(kart.m, "Avlunun batısında bir medrese bulunur.");
  assert.equal(kart.k, "E");
  assert.equal(kart.ky, "Cilt 2, s. 370");
});
