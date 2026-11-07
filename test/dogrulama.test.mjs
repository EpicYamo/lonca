import { test } from "node:test";
import assert from "node:assert/strict";
import { eserDogrula, kimlikUret, oneriEkiDogrula } from "../server/dogrulama.js";

const tam = { ad: "Koza Hanı", tur: "han", tarihce: { tr: "İpek ticaretinin merkezi olan han." }, kaynak: "Envanter, Cilt 1" };

test("geçerli eser temizlenerek kabul edilir", () => {
  const { hatalar, eser } = eserDogrula({ ...tam, ad: "  Koza Hanı  ", fazladan: "<script>", yuzyil: "15" });
  assert.deepEqual(hatalar, []);
  assert.equal(eser.ad, "Koza Hanı");
  assert.equal(eser.yuzyil, 15);
  assert.ok(!("fazladan" in eser));
});

test("zorunlu alanlar ve sınırlar denetlenir", () => {
  assert.ok(eserDogrula({ ...tam, kaynak: "" }).hatalar.length);
  assert.ok(eserDogrula({ ...tam, tur: "uzay-istasyonu" }).hatalar.length);
  assert.ok(eserDogrula({ ...tam, yuzyil: 0 }).hatalar.length);
  assert.ok(eserDogrula({ ...tam, konum: { lat: 120, lng: 29 } }).hatalar.length);
  assert.ok(eserDogrula({ ...tam, fotograflar: ["http://duz-http.example/a.jpg"] }).hatalar.length);
  assert.ok(eserDogrula(null).hatalar.length);
});

test("kısmi düzenlemede yalnızca gönderilen alanlar denetlenir", () => {
  const { hatalar, eser } = eserDogrula({ yuzyil: 16 }, { kismi: true });
  assert.deepEqual(hatalar, []);
  assert.deepEqual(eser, { yuzyil: 16 });
});

test("kimlik Türkçe karakterlerden arındırılır", () => {
  assert.equal(kimlikUret("Bursa Şehzade Çeşmesi (Güzel)"), "bursa-sehzade-cesmesi-guzel");
});

test("tamlık: eksik temel alanlar ve süzgeç", async () => {
  const { tamlik, tamlikSuzgeci } = await import("../server/dogrulama.js");
  const tamEser = { ad: "A", tur: "cami", il: "Bursa", ilce: "Osmangazi", yuzyil: 15, konum: { lat: 40, lng: 29 }, adres: "x", tarihce: { tr: "uzun bir tarihçe metni" }, fotograflar: [] };
  assert.deepEqual(tamlik(tamEser).eksikler, []);
  const konumsuz = { ...tamEser, konum: null };
  assert.deepEqual(tamlik(konumsuz).eksikler, ["konum"]);
  assert.equal(tamlikSuzgeci({ eksik: "konum" })(konumsuz), true);
  assert.equal(tamlikSuzgeci({ eksik: "konum" })({ ...konumsuz, adres: null }), false);
  assert.equal(tamlikSuzgeci({ tam: "1" })(tamEser), true);
  assert.equal(tamlikSuzgeci({ gerekli: "fotograf" })(tamEser), false);
  assert.equal(tamlikSuzgeci({ olmayan: "fotograf" })(tamEser), true);
});

test("uzman düzenleme önerisi kaynak ve en az bir değişiklik ister", () => {
  assert.ok(oneriEkiDogrula("duzenle", { kaynak: "Envanter, Cilt 1, s. 37" }, {}).hatalar.length);
  assert.ok(oneriEkiDogrula("duzenle", { kaynak: " " }, { yuzyil: 15 }).hatalar.length);
  const r = oneriEkiDogrula("duzenle", { kaynak: "  Envanter, Cilt 1, s. 37 ", oneren: "Dr. Ayşe" }, { yuzyil: 15 });
  assert.deepEqual(r, { hatalar: [], kaynak: "Envanter, Cilt 1, s. 37", oneren: "Dr. Ayşe" });
  assert.deepEqual(oneriEkiDogrula("not", {}).hatalar, []);
});
