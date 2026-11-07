import { test } from "node:test";
import assert from "node:assert/strict";
import { bakislariTemizle, kaynakKaniti } from "../server/dalis-kalfasi.js";

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
