// Hesaplar ve roller: kayıt olan usta, hazır hesaplar admin (editör).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deneySunucusu, kayitGovdesi, KOK } from "./yardimci.mjs";

let s;
before(async () => { s = await deneySunucusu(); });
after(async () => { await s.app.close(); });

const kaydol = async (govde) => (await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi(govde) })).json();
const yetki = (jeton) => ({ authorization: `Bearer ${jeton}` });
// Kayıt herkesi usta yapar; admin (editör) ve vatandaş hesapları yönetici şifresiyle rol değiştirerek hazırlanır.
const rolluAc = async (kimlik, rol) => {
  const g = await kaydol({ kimlik, sifre: "sifresifre" });
  await s.istek("PUT", `/api/hesap/${g.hesap.id}/rol`, { yonetici: true, govde: { rol } });
  return g;
};

test("kayıt olan usta olur ve jetonla kendi bilgisine ulaşır", async () => {
  const kayit = await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "su.gungor", sifre: "cokgizli" }) });
  assert.equal(kayit.statusCode, 201);
  const gov = kayit.json();
  assert.equal(gov.hesap.rol, "usta");
  assert.equal(gov.hesap.kimlik, "su.gungor");
  assert.ok(!("sifre" in gov.hesap), "şifre özeti dışarı sızmamalı");

  const ben = await s.istek("GET", "/api/hesap/ben", { basliklar: yetki(gov.jeton) });
  assert.equal(ben.statusCode, 200);
  assert.equal(ben.json().kimlik, "su.gungor");
});

test("şifre düz metin saklanmaz", async () => {
  await kaydol({ kimlik: "duz-metin", sifre: "duzmetinsifre" });
  const kayitlar = JSON.parse(await readFile(path.join(s.veri, "kullanicilar.json"), "utf8"));
  const h = kayitlar.find((x) => x.kimlik === "duz-metin");
  assert.ok(h.sifre && !h.sifre.includes("duzmetinsifre"));
  assert.match(h.sifre, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test("jetonsuz, bozuk ya da değiştirilmiş jeton reddedilir", async () => {
  assert.equal((await s.istek("GET", "/api/hesap/ben")).statusCode, 401);
  assert.equal((await s.istek("GET", "/api/hesap/ben", { basliklar: yetki("bozuk") })).statusCode, 401);
  const { jeton } = await kaydol({ kimlik: "jeton-testi", sifre: "sifresifre" });
  const [gov, imza] = jeton.split(".");
  const sahte = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(gov, "base64url")), id: "baskasi" })).toString("base64url");
  assert.equal((await s.istek("GET", "/api/hesap/ben", { basliklar: yetki(`${sahte}.${imza}`) })).statusCode, 401);
});

test("geçersiz kullanıcı adı ve kısa şifre reddedilir", async () => {
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "a", sifre: "sifresifre" }) })).statusCode, 400);
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "kisa-sifre", sifre: "123" }) })).statusCode, 400);
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "uzun-sifre", sifre: "x".repeat(500) }) })).statusCode, 400);
});

test("aynı kullanıcı adıyla ikinci kayıt reddedilir", async () => {
  await kaydol({ kimlik: "tekrar", sifre: "sifre123" });
  const y = await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "Tekrar", sifre: "baskasifre" }) });
  assert.equal(y.statusCode, 409);
});

test("yanlış şifreyle ya da olmayan hesapla giriş reddedilir, doğrusuyla kabul edilir", async () => {
  await kaydol({ kimlik: "giris-testi", sifre: "dogrusifre" });
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "giris-testi", sifre: "yanlissifre" } })).statusCode, 401);
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "olmayan-biri", sifre: "dogrusifre" } })).statusCode, 401);
  const dogru = await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "giris-testi", sifre: "dogrusifre" } });
  assert.equal(dogru.statusCode, 200);
  assert.ok(dogru.json().jeton);
});

test("kayıtta rol seçilemez: editör isteyen de, davet anahtarı veren de usta olur", async () => {
  const y = await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "sahte-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "gizli-sifre" }) });
  assert.equal(y.statusCode, 201);
  assert.equal(y.json().hesap.rol, "usta");
});

test("profil güncellenir", async () => {
  const { jeton } = await kaydol({ kimlik: "profilli", sifre: "sifresifre" });
  const y = await s.istek("PUT", "/api/hesap/profil", { basliklar: yetki(jeton), govde: { ad: "Su", renk: "firuze" } });
  assert.equal(y.statusCode, 200);
  assert.equal(y.json().profil.ad, "Su");
  assert.equal(y.json().profil.renk, "firuze");
});

test("editör başka bir hesabın rolünü değiştirebilir, vatandaş değiştiremez", async () => {
  const editor = await rolluAc("rol-editor", "editor");
  const vatandas = await rolluAc("rol-terfi", "vatandas");
  const izinsiz = await s.istek("PUT", `/api/hesap/${vatandas.hesap.id}/rol`, { basliklar: yetki(vatandas.jeton), govde: { rol: "editor" } });
  assert.equal(izinsiz.statusCode, 401);
  const izinli = await s.istek("PUT", `/api/hesap/${vatandas.hesap.id}/rol`, { basliklar: yetki(editor.jeton), govde: { rol: "usta" } });
  assert.equal(izinli.statusCode, 200);
  assert.equal(izinli.json().rol, "usta");
});

test("rolü düşürülen hesap eski jetonuyla yetkisini hemen kaybeder", async () => {
  const editor = await rolluAc("dusen-editor", "editor");
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(editor.jeton) })).statusCode, 200);
  await s.istek("PUT", `/api/hesap/${editor.hesap.id}/rol`, { yonetici: true, govde: { rol: "vatandas" } });
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(editor.jeton) })).statusCode, 401);
});

test("admin (editör) her şeyi düzenler; usta Studio listelerini yalnızca görür; vatandaş göremez", async () => {
  const editor = await rolluAc("api-editor", "editor");
  const usta = await kaydol({ kimlik: "api-usta", sifre: "sifresifre" });
  const vatandas = await rolluAc("api-vatandas", "vatandas");
  const okuma = ["/api/moduller?durum=hepsi", "/api/eser-oneriler", "/api/eser-gecmisi", "/api/dalislar-yonetim"];
  for (const yol of okuma) {
    assert.equal((await s.istek("GET", yol)).statusCode, 401, `girişsiz ${yol}`);
    assert.equal((await s.istek("GET", yol, { basliklar: yetki(vatandas.jeton) })).statusCode, 401, `vatandaş ${yol}`);
    assert.equal((await s.istek("GET", yol, { basliklar: yetki(usta.jeton) })).statusCode, 200, `usta ${yol}`);
    assert.equal((await s.istek("GET", yol, { basliklar: yetki(editor.jeton) })).statusCode, 200, `editör ${yol}`);
  }
  const eserId = (await s.istek("GET", "/api/eserler")).json()[0].id;
  const yazma = [
    ["PUT", `/api/eserler/${eserId}`, { ad: "Değişti" }],
    ["POST", "/api/eserler", { ad: "Yeni" }],
    ["DELETE", `/api/eserler/${eserId}`],
    ["POST", "/api/moduller/yok/durum", { durum: "onayli" }],
    ["DELETE", "/api/moduller/yok"],
    ["POST", "/api/eser-oneriler/yok/karar", { karar: "onayla" }],
    ["GET", "/api/eserler-disa-aktar"],
    ["POST", "/api/dalislar/yok/durum", { durum: "onayli" }],
    ["PUT", "/api/kalfa/ayarlar", {}],
    ["GET", "/api/kalfa/modeller"],
  ];
  for (const [yontem, yol, govde] of yazma) {
    assert.equal((await s.istek(yontem, yol, { govde, basliklar: yetki(usta.jeton) })).statusCode, 401, `usta ${yontem} ${yol}`);
  }
  // Dalış: usta da hazırlatabilir (yayın yine admin onayıyla); mevcut dalışın üzerine yazamaz; vatandaş hiç kullanamaz.
  assert.equal((await s.istek("POST", "/api/dalis-kalfasi", { govde: {}, basliklar: yetki(vatandas.jeton) })).statusCode, 401);
  assert.equal((await s.istek("POST", "/api/dalis-kalfasi", { govde: {}, basliklar: yetki(usta.jeton) })).statusCode, 400, "usta dalış kalfasına ulaşır");
  assert.equal((await s.istek("POST", "/api/dalis-kalfasi", { govde: { eser: eserId, uzerineYaz: true }, basliklar: yetki(usta.jeton) })).statusCode, 403);
  assert.equal((await s.istek("GET", "/api/dalis-kalfasi/oneriler", { basliklar: yetki(vatandas.jeton) })).statusCode, 401);
  const { oneriler } = (await s.istek("GET", `/api/dalis-kalfasi/oneriler?haric=${eserId}`, { basliklar: yetki(usta.jeton) })).json();
  assert.equal(oneriler.length, 3);
  const eserAdlari = new Map((await s.istek("GET", "/api/eserler")).json().map((e) => [e.id, e.ad]));
  for (const o of oneriler) {
    assert.notEqual(o.eser, eserId, "haric verilen eser önerilmez");
    assert.ok(o.metin.startsWith(eserAdlari.get(o.eser)), "öneri bilgi bankasındaki eser adıyla kurulur");
  }
  // Model ayarlarını artık admin hesabı da değiştirebilir (yalnızca yönetici şifresi değil).
  assert.notEqual((await s.istek("PUT", "/api/kalfa/ayarlar", { basliklar: yetki(editor.jeton), govde: {} })).statusCode, 401);
});

test("vatandaş atölyeyi kullanamaz; bir usta başka ustanın taslağını ezemez", async () => {
  const kod = await readFile(path.join(KOK, "sdk", "ornekler", "yuzyil-avi.js"), "utf8");
  const vatandas = await rolluAc("atolye-vatandas", "vatandas");
  assert.equal((await s.istek("POST", "/api/moduller", { basliklar: yetki(vatandas.jeton), govde: { id: "taslak-a", ad: "Taslak", kod } })).statusCode, 401);

  const ilk = await s.istek("POST", "/api/moduller", { usta: true, govde: { id: "taslak-a", ad: "Taslak", kod } });
  assert.equal(ilk.statusCode, 201);
  const baska = await kaydol({ kimlik: "baska-usta", sifre: "sifresifre" });
  assert.equal((await s.istek("POST", "/api/moduller", { basliklar: yetki(baska.jeton), govde: { id: "taslak-a", ad: "Ele geçirme", kod } })).statusCode, 409);
  assert.equal((await s.istek("POST", "/api/moduller", { usta: true, govde: { id: "taslak-a", ad: "Taslak 2", kod } })).statusCode, 201);
});

test("onay kuyruğunu yalnızca admin görür; usta yalnızca kendi modüllerini görür", async () => {
  const kod = await readFile(path.join(KOK, "sdk", "ornekler", "yuzyil-avi.js"), "utf8");
  const editor = await rolluAc("kuyruk-editor", "editor");
  const ogretmen = await kaydol({ kimlik: "kuyruk-usta-a", sifre: "sifresifre" });
  const diger = await kaydol({ kimlik: "kuyruk-usta-b", sifre: "sifresifre" });
  const gonder = (jeton, id) => s.istek("POST", "/api/moduller", { basliklar: yetki(jeton), govde: { id, ad: id, kod } });
  assert.equal((await gonder(ogretmen.jeton, "kuyruk-a")).statusCode, 201);
  assert.equal((await gonder(diger.jeton, "kuyruk-b")).statusCode, 201);

  const liste = async (jeton) => (await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(jeton) })).json().map((m) => m.id);
  assert.deepEqual(await liste(ogretmen.jeton), ["kuyruk-a"]);
  assert.deepEqual(await liste(diger.jeton), ["kuyruk-b"]);
  const tum = await liste(editor.jeton);
  assert.ok(tum.includes("kuyruk-a") && tum.includes("kuyruk-b"));

  // Yayında olmayan kodu yalnızca sahibi ve admin okur.
  const kodOku = (jeton) => s.istek("GET", "/api/moduller/kuyruk-a/kod", { basliklar: yetki(jeton) });
  assert.equal((await kodOku(ogretmen.jeton)).statusCode, 200);
  assert.equal((await kodOku(editor.jeton)).statusCode, 200);
  assert.equal((await kodOku(diger.jeton)).statusCode, 403);
});

test("özel modül onay kuyruğuna girmez, yalnızca paylaşım bağlantısıyla açılır", async () => {
  const kod = await readFile(path.join(KOK, "sdk", "ornekler", "yuzyil-avi.js"), "utf8");
  const usta = await kaydol({ kimlik: "paylasim-usta", sifre: "sifresifre" });
  const diger = await kaydol({ kimlik: "paylasim-diger", sifre: "sifresifre" });
  const gonder = (govde) => s.istek("POST", "/api/moduller", { basliklar: yetki(usta.jeton), govde: { ad: govde.id, kod, ...govde } });

  assert.equal((await gonder({ id: "paylasim-hatali", gorunurluk: "gizli" })).statusCode, 400);
  const ozel = (await gonder({ id: "paylasim-ozel", gorunurluk: "ozel" })).json();
  assert.equal(ozel.durum, "ozel");
  assert.match(ozel.paylasim, /^[A-Za-z0-9_-]{16}$/);

  // Uygulamada listelenmez, kimlikle kodu okunamaz.
  assert.ok(!(await s.istek("GET", "/api/moduller")).json().some((m) => m.id === "paylasim-ozel"));
  assert.equal((await s.istek("GET", "/api/moduller/paylasim-ozel/kod")).statusCode, 403);
  assert.equal((await s.istek("GET", "/api/moduller/paylasim-ozel/kod", { basliklar: yetki(diger.jeton) })).statusCode, 403);
  assert.equal((await s.istek("GET", "/api/paylasim/paylasim-ozel")).statusCode, 404);

  // Bağlantıyı bilen herkes (hesapsız) açar.
  const ozet = await s.istek("GET", `/api/paylasim/${ozel.paylasim}`);
  assert.equal(ozet.statusCode, 200);
  assert.equal(ozet.json().id, "paylasim-ozel");
  assert.equal(ozet.json().sahip, undefined);
  const kodYaniti = await s.istek("GET", `/api/paylasim/${ozel.paylasim}/kod`);
  assert.equal(kodYaniti.statusCode, 200);
  assert.equal(kodYaniti.body, kod);
  // Kısa davet koduyla da açılır (küçük harf ve tiresiz yazılsa bile); başkasının koduyla değil.
  assert.match(ozel.davetKodu, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  const yazilan = ozel.davetKodu.toLowerCase().replace("-", "");
  assert.equal((await s.istek("GET", `/api/paylasim/${yazilan}`)).json().id, "paylasim-ozel");
  assert.equal((await s.istek("GET", `/api/paylasim/${ozel.davetKodu}/kod`)).body, kod);
  const yonlen = await s.istek("GET", `/m/${ozel.paylasim}`);
  assert.equal(yonlen.statusCode, 302);
  assert.equal(yonlen.headers.location, `/?modul=${ozel.paylasim}`);

  // Yeniden kaydedince anahtar değişmez; herkese açığa çevrilince onay bekler ve özel bağlantı kapanır.
  const yeniden = (await gonder({ id: "paylasim-ozel", gorunurluk: "ozel" })).json();
  assert.equal(yeniden.paylasim, ozel.paylasim);
  assert.equal(yeniden.davetKodu, ozel.davetKodu);
  const acik = (await gonder({ id: "paylasim-ozel", gorunurluk: "herkes" })).json();
  assert.equal(acik.durum, "bekliyor");
  assert.equal((await s.istek("GET", `/api/paylasim/${ozel.paylasim}`)).statusCode, 404);
  assert.equal((await s.istek("GET", "/api/paylasim/paylasim-ozel")).statusCode, 404);
  assert.equal((await s.istek("GET", `/api/paylasim/${ozel.davetKodu}`)).statusCode, 404);

  // Onaylanan herkese açık modül kimliğiyle paylaşılır.
  assert.equal((await s.istek("POST", "/api/moduller/paylasim-ozel/onayla", { usta: true })).statusCode, 401);
  const editor = await rolluAc("paylasim-editor", "editor");
  assert.equal((await s.istek("POST", "/api/moduller/paylasim-ozel/onayla", { basliklar: yetki(editor.jeton) })).statusCode, 200);
  assert.equal((await s.istek("GET", "/api/paylasim/paylasim-ozel")).json().durum, "onayli");
});

test("cihazdaki profil yalnızca sunucuda veri yokken taşınır, üzerine yazmaz", async () => {
  const { jeton } = await kaydol({ kimlik: "tasima-testi", sifre: "sifresifre" });
  const ilk = await s.istek("POST", "/api/hesap/tasi", { basliklar: yetki(jeton), govde: { profil: { ad: "Cihaz Profili", puan: 120 }, basarimlar: { "modul-1": { "basarim-a": true } } } });
  assert.equal(ilk.statusCode, 200);
  assert.equal(ilk.json().profil.puan, 120);
  const ikinci = await s.istek("POST", "/api/hesap/tasi", { basliklar: yetki(jeton), govde: { profil: { ad: "Başka Profil", puan: 999 } } });
  assert.equal(ikinci.json().profil.puan, 120, "sunucuda zaten veri varken üzerine yazılmamalı");
  assert.equal(ikinci.json().profil.ad, "Cihaz Profili");
});

test("geliştirme modunda (yönetici şifresi yok) atölye girişsiz çalışır", async () => {
  const g = await deneySunucusu({ YONETICI_SIFRE: "" });
  const y = await g.istek("POST", "/api/kalfa", { govde: { sohbet: [{ rol: "usta", metin: "bir oyun" }] } });
  assert.equal(y.statusCode, 200);
  assert.equal((await g.istek("GET", "/api/ayarlar")).json().hesap.gerekli, false);
  await g.app.close();
});

test("hazır hesaplar ilk şifreyle girer, şifre değişene kadar yetki almaz, sonra editör olur", async () => {
  const t = await deneySunucusu({ ILK_SIFRE: "ilk-sifre", ILK_KULLANICILAR: "arda,Sevilay" });
  try {
    const giris = await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } });
    assert.equal(giris.statusCode, 200);
    const { jeton, hesap } = giris.json();
    assert.equal(hesap.rol, "editor");
    assert.equal(hesap.sifreDegismeli, true);
    const b = yetki(jeton);
    assert.equal((await t.istek("POST", "/api/kalfa", { govde: { sohbet: [{ rol: "usta", metin: "bir oyun" }] }, basliklar: b })).statusCode, 401, "şifre değişmeden atölye kapalı");

    assert.equal((await t.istek("PUT", "/api/hesap/sifre", { govde: { yeniSifre: "kisa" }, basliklar: b })).statusCode, 400);
    assert.equal((await t.istek("PUT", "/api/hesap/sifre", { govde: { yeniSifre: "ilk-sifre" }, basliklar: b })).statusCode, 400);
    assert.equal((await t.istek("PUT", "/api/hesap/sifre", { govde: { yeniSifre: "yepyeni-sifre" } })).statusCode, 401);
    const degis = await t.istek("PUT", "/api/hesap/sifre", { govde: { yeniSifre: "yepyeni-sifre" }, basliklar: b });
    assert.equal(degis.statusCode, 200);
    assert.equal(degis.json().sifreDegismeli, false);
    assert.equal((await t.istek("POST", "/api/kalfa", { govde: { sohbet: [{ rol: "usta", metin: "bir oyun" }] }, basliklar: b })).statusCode, 200, "şifre değişince atölye açılır");

    assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } })).statusCode, 401);
    assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "yepyeni-sifre" } })).statusCode, 200);
    // Sonraki değişimlerde mevcut şifre gerekir.
    assert.equal((await t.istek("PUT", "/api/hesap/sifre", { govde: { yeniSifre: "baska-sifre-1" }, basliklar: b })).statusCode, 403);
    assert.equal((await t.istek("PUT", "/api/hesap/sifre", { govde: { eskiSifre: "yepyeni-sifre", yeniSifre: "baska-sifre-1" }, basliklar: b })).statusCode, 200);
    assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "sevilay", sifre: "ilk-sifre" } })).statusCode, 200);
    assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "ibrahim", sifre: "ilk-sifre" } })).statusCode, 401, "listede olmayan açılmaz");
  } finally { await t.app.close(); }
});

test("hazır hesap tohumu var olan hesabın şifresine dokunmaz; ILK_SIFRE boşsa hesap açılmaz", async () => {
  const { hesaplarKur } = await import("../server/hesap.js");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const h = hesaplarKur(path.join(await mkdtemp(path.join(tmpdir(), "lonca-tohum-")), "kullanicilar.json"));
  assert.deepEqual(await h.tohumla(["arda"], ""), []);
  assert.deepEqual(await h.tohumla(["arda"], "ilk-sifre"), ["arda"]);
  await h.sifreDegistir((await h.kimlikleBul("arda")).id, { yeniSifre: "kendi-sifresi" });
  assert.deepEqual(await h.tohumla(["arda"], "ilk-sifre"), []);
  assert.ok((await h.girisYap({ kimlik: "arda", sifre: "kendi-sifresi" })).hesap);
});
