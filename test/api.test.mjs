import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deneySunucusu, KOK } from "./yardimci.mjs";

let s;
before(async () => { s = await deneySunucusu(); });
after(async () => { await s.app.close(); });

const ornekKod = () => readFile(path.join(KOK, "sdk", "ornekler", "yuzyil-avi.js"), "utf8");

test("eserler listelenir ve her eserde kaynak vardır", async () => {
  const y = await s.istek("GET", "/api/eserler");
  assert.equal(y.statusCode, 200);
  const liste = y.json();
  assert.ok(liste.length > 100);
  assert.ok(liste.every((e) => typeof e.kaynak === "string" && e.kaynak.length > 3));
});

test("tarihsel bağlar listelenir ve esere göre süzülür", async () => {
  const hepsi = (await s.istek("GET", "/api/eser-iliskileri")).json();
  assert.ok(hepsi.length >= 20);
  assert.ok(hepsi.every((i) => i.id && i.a && i.b && i.tur && i.baslik && i.aciklama && i.kaynak));

  const ulucami = (await s.istek("GET", "/api/eser-iliskileri?eser=bursa-ulucami")).json();
  assert.ok(ulucami.length > 0);
  assert.ok(ulucami.every((i) => i.diger && (i.a === "bursa-ulucami" || i.b === "bursa-ulucami")));
  assert.ok(ulucami.every((i) => i.diger.id !== "bursa-ulucami"));
});

test("yakındaki eserler konum ister ve uzaklığa göre sıralanır", async () => {
  assert.equal((await s.istek("GET", "/api/eserler/yakin")).statusCode, 400);
  const liste = (await s.istek("GET", "/api/eserler/yakin?lat=40.1836&lng=29.0625&limit=5")).json();
  assert.equal(liste.length, 5);
  for (let i = 1; i < liste.length; i++) assert.ok(liste[i].mesafe_m >= liste[i - 1].mesafe_m);
});

test("geçersiz modül reddedilir, ayrıntılar döner", async () => {
  const y = await s.istek("POST", "/api/moduller", { govde: { id: "kotu", ad: "Kötü", kod: "export default async function basla() { document.body.innerHTML = 'x'; }" } });
  assert.equal(y.statusCode, 400);
  assert.ok(y.json().ayrintilar.length > 0);
});

test("modül yaşam döngüsü: onay → yayın → kaldırma → arşiv → silme", async () => {
  const kod = await ornekKod();
  let y = await s.istek("POST", "/api/moduller", { govde: { id: "yuzyil-avi", ad: "Yüzyıl Avı", kod, renk: "murdum" } });
  assert.equal(y.statusCode, 201);
  assert.equal(y.json().durum, "bekliyor");

  assert.deepEqual((await s.istek("GET", "/api/moduller")).json(), []);
  assert.equal((await s.istek("GET", "/api/moduller/yuzyil-avi/kod")).statusCode, 403);
  assert.equal((await s.istek("POST", "/api/moduller/yuzyil-avi/durum", { govde: { durum: "onayli" } })).statusCode, 401);
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi")).statusCode, 401);

  y = await s.istek("POST", "/api/moduller/yuzyil-avi/durum", { govde: { durum: "onayli" }, yonetici: true });
  assert.equal(y.json().durum, "onayli");
  assert.equal((await s.istek("GET", "/api/moduller")).json().length, 1);
  assert.equal((await s.istek("GET", "/api/moduller/yuzyil-avi/kod")).statusCode, 200);

  assert.equal((await s.istek("POST", "/api/moduller", { govde: { id: "yuzyil-avi", ad: "Ele geçirme", kod } })).statusCode, 409);

  for (const durum of ["kaldirildi", "arsiv"]) {
    y = await s.istek("POST", "/api/moduller/yuzyil-avi/durum", { govde: { durum }, yonetici: true });
    assert.equal(y.json().durum, durum);
    assert.equal((await s.istek("GET", "/api/moduller")).json().length, 0);
  }
  assert.equal((await s.istek("POST", "/api/moduller/yuzyil-avi/durum", { govde: { durum: "uydurma" }, yonetici: true })).statusCode, 400);
  assert.equal((await s.istek("DELETE", "/api/moduller/yuzyil-avi")).statusCode, 401);
  assert.equal((await s.istek("DELETE", "/api/moduller/yuzyil-avi", { yonetici: true })).statusCode, 200);
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { yonetici: true })).json().length, 0);
});

test("yanlış yönetici şifresi reddedilir", async () => {
  const y = await s.istek("POST", "/api/moduller/x/durum", { govde: { durum: "onayli" }, basliklar: { "x-yonetici-sifre": "yanlis" } });
  assert.equal(y.statusCode, 401);
});

test("topluluk önerisi: hata bildirimi ve yeni eser onay kuyruğuna düşer, onaylanınca yayına girer", async () => {
  const eser = (await s.istek("GET", "/api/eserler")).json()[0];
  assert.equal((await s.istek("POST", "/api/eser-oneriler", { govde: { tur: "not", eserId: eser.id, not: "x" } })).statusCode, 400);
  assert.equal((await s.istek("POST", "/api/eser-oneriler", { govde: { tur: "not", eserId: eser.id, not: "Yüzyılı yanlış yazılmış." } })).statusCode, 201);

  const eksik = await s.istek("POST", "/api/eser-oneriler", { govde: { tur: "yeni", veri: { ad: "Deneme Çeşmesi", tur: "cesme", tarihce: { tr: "Mahalle arasında küçük bir çeşme." } } } });
  assert.equal(eksik.statusCode, 400);
  const yeni = await s.istek("POST", "/api/eser-oneriler", { govde: { tur: "yeni", veri: { ad: "Deneme Çeşmesi", tur: "cesme", ilce: "Osmangazi", tarihce: { tr: "Mahalle arasında küçük bir çeşme." }, kaynak: "Mahalle kitabesi" } } });
  assert.equal(yeni.statusCode, 201);

  assert.ok(!(await s.istek("GET", "/api/eserler?ad=Deneme")).json().length);
  assert.equal((await s.istek("GET", "/api/eser-oneriler")).statusCode, 401);
  const kuyruk = (await s.istek("GET", "/api/eser-oneriler", { yonetici: true })).json();
  assert.equal(kuyruk.length, 2);

  const y = await s.istek("POST", `/api/eser-oneriler/${yeni.json().id}/karar`, { govde: { karar: "onayla" }, yonetici: true });
  assert.equal(y.statusCode, 200);
  const eklenen = (await s.istek("GET", "/api/eserler?ad=Deneme")).json();
  assert.equal(eklenen.length, 1);
  assert.equal(eklenen[0].kaynak, "Mahalle kitabesi");
  assert.equal((await s.istek("POST", `/api/eser-oneriler/${yeni.json().id}/karar`, { govde: { karar: "onayla" }, yonetici: true })).statusCode, 409);

  const dosya = JSON.parse(await readFile(path.join(s.veri, "eserler.json"), "utf8"));
  assert.ok(dosya.eserler.some((e) => e.ad === "Deneme Çeşmesi"));
});

test("uzman düzenleme önerisi: kaynaksız reddedilir, onaylanana dek yayına girmez", async () => {
  const eser = (await s.istek("GET", "/api/eserler")).json()[2];
  const yol = "/api/eser-oneriler";
  assert.equal((await s.istek("POST", yol, { govde: { tur: "duzenle", eserId: eser.id, veri: { adres: "Uzman eklemesi" } } })).statusCode, 400);
  assert.equal((await s.istek("POST", yol, { govde: { tur: "duzenle", eserId: eser.id, veri: {}, kaynak: "Envanter, Cilt 1" } })).statusCode, 400);
  const o = await s.istek("POST", yol, { govde: { tur: "duzenle", eserId: eser.id, veri: { adres: "Uzman eklemesi" }, kaynak: "Envanter, Cilt 1, s. 37", oneren: "Uzman" } });
  assert.equal(o.statusCode, 201);
  assert.notEqual((await s.istek("GET", `/api/eserler/${eser.id}`)).json().adres, "Uzman eklemesi");
  const kayit = (await s.istek("GET", yol, { yonetici: true })).json().find((x) => x.id === o.json().id);
  assert.equal(kayit.kaynak, "Envanter, Cilt 1, s. 37");
  assert.equal(kayit.oneren, "Uzman");
  assert.equal((await s.istek("POST", `${yol}/${kayit.id}/karar`, { govde: { karar: "onayla" }, yonetici: true })).statusCode, 200);
  assert.equal((await s.istek("GET", `/api/eserler/${eser.id}`)).json().adres, "Uzman eklemesi");
});

test("yönetici eseri düzenler; geçersiz alanlar reddedilir", async () => {
  const eser = (await s.istek("GET", "/api/eserler")).json()[1];
  assert.equal((await s.istek("PUT", `/api/eserler/${eser.id}`, { govde: { yuzyil: 40 }, yonetici: true })).statusCode, 400);
  assert.equal((await s.istek("PUT", `/api/eserler/${eser.id}`, { govde: { fotograflar: ["javascript:alert(1)"] }, yonetici: true })).statusCode, 400);
  const y = await s.istek("PUT", `/api/eserler/${eser.id}`, { govde: { yuzyil: 15, konum: { lat: 40.18, lng: 29.06, yaklasik: true } }, yonetici: true });
  assert.equal(y.statusCode, 200);
  assert.equal(y.json().yuzyil, 15);
  assert.equal(y.json().ad, eser.ad); 
});

test("medya: yalnızca gerçek fotoğraf kabul edilir; onaylanmadan herkese açık değildir", async () => {
  const sahte = await s.istek("POST", "/api/medya", { govde: { dosya: `data:image/png;base64,${Buffer.from("<script>").toString("base64")}` } });
  assert.equal(sahte.statusCode, 400);
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
  const y = await s.istek("POST", "/api/medya", { govde: { dosya: `data:image/png;base64,${png.toString("base64")}` } });
  assert.equal(y.statusCode, 201);
  const { yol } = y.json();
  assert.equal((await s.istek("GET", yol)).statusCode, 404);
  assert.equal((await s.istek("GET", yol, { yonetici: true })).statusCode, 200);
});

test("veri tamlığı: tam=1, eksik=, gerekli=, olmayan= süzgeçleri ve özet", async () => {
  const hepsi = (await s.istek("GET", "/api/eserler")).json();
  const ozet = (await s.istek("GET", "/api/eserler-tamlik")).json();
  assert.equal(ozet.toplam, hepsi.length);

  const tam = (await s.istek("GET", "/api/eserler?tam=1")).json();
  assert.equal(tam.length, ozet.tam);
  assert.ok(tam.every((e) => e.konum && e.adres && Number.isInteger(e.yuzyil) && e.ilce));

  const yalnizKonum = (await s.istek("GET", "/api/eserler?eksik=konum")).json();
  assert.equal(yalnizKonum.length, ozet.tekEksik.konum ?? 0);
  assert.ok(yalnizKonum.every((e) => !e.konum && e.adres && Number.isInteger(e.yuzyil)));

  const fotoluYuzyilli = (await s.istek("GET", "/api/eserler?gerekli=fotograf,yuzyil")).json();
  assert.ok(fotoluYuzyilli.length > 0 && fotoluYuzyilli.every((e) => e.fotograflar.length && Number.isInteger(e.yuzyil)));
  const konumsuz = (await s.istek("GET", "/api/eserler?olmayan=konum")).json();
  assert.equal(konumsuz.length, ozet.alanlar.konum.yok);
});

test("değişiklik geçmişi: düzenleme ve silme geri alınır, geri alma da geri alınabilir", async () => {
  const id = (await s.istek("GET", "/api/eserler", { yonetici: true })).json()[0].id;
  const once = (await s.istek("GET", `/api/eserler/${id}`, { yonetici: true })).json();
  await s.istek("PUT", `/api/eserler/${id}`, { yonetici: true, govde: { fotograflar: once.fotograflar.slice(1) } });
  let gecmis = (await s.istek("GET", "/api/eser-gecmisi", { yonetici: true })).json();
  assert.equal(gecmis[0].islem, "duzenle");
  assert.deepEqual(gecmis[0].ozet, ["fotograflar"]);
  const geri = (await s.istek("POST", `/api/eser-gecmisi/${gecmis[0].id}/geri-al`, { yonetici: true })).json();
  assert.deepEqual((await s.istek("GET", `/api/eserler/${id}`, { yonetici: true })).json().fotograflar, once.fotograflar);
  await s.istek("POST", `/api/eser-gecmisi/${geri.gecmis}/geri-al`, { yonetici: true }); 
  assert.equal((await s.istek("GET", `/api/eserler/${id}`, { yonetici: true })).json().fotograflar.length, once.fotograflar.length - 1);
  await s.istek("PUT", `/api/eserler/${id}`, { yonetici: true, govde: { fotograflar: once.fotograflar } });

  const sil = (await s.istek("DELETE", `/api/eserler/${id}`, { yonetici: true })).json();
  assert.equal((await s.istek("GET", `/api/eserler/${id}`, { yonetici: true })).statusCode, 404);
  await s.istek("POST", `/api/eser-gecmisi/${sil.gecmis}/geri-al`, { yonetici: true });
  assert.equal((await s.istek("GET", `/api/eserler/${id}`, { yonetici: true })).statusCode, 200);
});

test("dışa aktar → içe aktar (birleştir); hatalı dosya hiçbir şeyi değiştirmez; içe aktarma geri alınır", async () => {
  const disa = (await s.istek("GET", "/api/eserler-disa-aktar", { yonetici: true })).json();
  const sayi = disa.eserler.length;
  const bozuk = { kip: "birlestir", eserler: [...disa.eserler.slice(0, 3), { ad: "x" }] };
  assert.equal((await s.istek("POST", "/api/eserler-ice-aktar", { yonetici: true, govde: bozuk })).statusCode, 400);
  assert.equal((await s.istek("GET", "/api/eserler", { yonetici: true })).json().length, sayi);
  const yeni = { ad: "İçe Aktarma Çeşmesi", tur: "cesme", tarihce: { tr: "İçe aktarma testinde eklenen bir çeşme." }, kaynak: "Test" };
  const r = (await s.istek("POST", "/api/eserler-ice-aktar", { yonetici: true, govde: { kip: "birlestir", eserler: [...disa.eserler, yeni] } })).json();
  assert.equal(r.eklenen, 1); assert.equal(r.guncellenen, sayi);
  assert.equal((await s.istek("GET", "/api/eserler", { yonetici: true })).json().length, sayi + 1);
  await s.istek("POST", `/api/eser-gecmisi/${r.gecmis}/geri-al`, { yonetici: true });
  assert.equal((await s.istek("GET", "/api/eserler", { yonetici: true })).json().length, sayi);
});

test("vitrin: sayılar, günün eseri ve seçki fotoğraflı eserlerden gelir", async () => {
  const v = (await s.istek("GET", "/api/vitrin")).json();
  assert.ok(v.sayilar.eser > 100);
  assert.ok(v.gununEseri.foto.startsWith("/medya/"));
  assert.ok(v.secki.length > 0 && v.secki.every((e) => e.foto));
});

test("var olan modülün üzerine yazılınca önceki kodu yedeklenir", async () => {
  const { readdir, readFile: oku } = await import("node:fs/promises");
  const kod = await ornekKod();
  const govde = { id: "yedek-deneme", ad: "Yedek", kod };
  assert.equal((await s.istek("POST", "/api/moduller", { govde, yonetici: true })).statusCode, 201);
  const yeniKod = kod.replace("Yüzyıl Avı", "Yüzyıl Avı 2");
  assert.equal((await s.istek("POST", "/api/moduller", { govde: { ...govde, kod: yeniKod }, yonetici: true })).statusCode, 201);
  const yedekler = (await readdir(path.join(s.veri, "moduller", "eski"))).filter((f) => f.startsWith("yedek-deneme-"));
  assert.equal(yedekler.length, 1);
  assert.equal(await oku(path.join(s.veri, "moduller", "eski", yedekler[0]), "utf8"), kod);
});
