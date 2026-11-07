// Hesaplar ve roller. İlk sürüm: yalives7 (fix dalı, "studioda giris ekrani").
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deneySunucusu, KOK } from "./yardimci.mjs";

let s;
before(async () => { s = await deneySunucusu(); });
after(async () => { await s.app.close(); });

const kaydol = async (govde) => (await s.istek("POST", "/api/hesap/kayit", { govde })).json();
const yetki = (jeton) => ({ authorization: `Bearer ${jeton}` });

test("vatandaş kaydolur ve jetonla kendi bilgisine ulaşır", async () => {
  const kayit = await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "su.gungor", sifre: "cokgizli" } });
  assert.equal(kayit.statusCode, 201);
  const gov = kayit.json();
  assert.equal(gov.hesap.rol, "vatandas");
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
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "a", sifre: "sifresifre" } })).statusCode, 400);
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "kisa-sifre", sifre: "123" } })).statusCode, 400);
  assert.equal((await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "uzun-sifre", sifre: "x".repeat(500) } })).statusCode, 400);
});

test("aynı kullanıcı adıyla ikinci kayıt reddedilir", async () => {
  await kaydol({ kimlik: "tekrar", sifre: "sifre123" });
  const y = await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "Tekrar", sifre: "baskasifre" } });
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

test("usta rolü anahtarsız seçilebilir, editör rolü doğru davet anahtarı ister", async () => {
  assert.equal((await kaydol({ kimlik: "usta-biri", sifre: "sifresifre", rol: "usta" })).hesap.rol, "usta");
  const yanlis = await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "sahte-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "yanlis" } });
  assert.equal(yanlis.statusCode, 403);
  const dogru = await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "gercek-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "gizli-sifre" } });
  assert.equal(dogru.statusCode, 201);
  assert.equal(dogru.json().hesap.rol, "editor");
});

test("profil güncellenir", async () => {
  const { jeton } = await kaydol({ kimlik: "profilli", sifre: "sifresifre" });
  const y = await s.istek("PUT", "/api/hesap/profil", { basliklar: yetki(jeton), govde: { ad: "Su", renk: "firuze" } });
  assert.equal(y.statusCode, 200);
  assert.equal(y.json().profil.ad, "Su");
  assert.equal(y.json().profil.renk, "firuze");
});

test("editör başka bir hesabın rolünü değiştirebilir, vatandaş değiştiremez", async () => {
  const editor = await kaydol({ kimlik: "rol-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "gizli-sifre" });
  const vatandas = await kaydol({ kimlik: "rol-terfi", sifre: "sifresifre" });
  const izinsiz = await s.istek("PUT", `/api/hesap/${vatandas.hesap.id}/rol`, { basliklar: yetki(vatandas.jeton), govde: { rol: "editor" } });
  assert.equal(izinsiz.statusCode, 401);
  const izinli = await s.istek("PUT", `/api/hesap/${vatandas.hesap.id}/rol`, { basliklar: yetki(editor.jeton), govde: { rol: "usta" } });
  assert.equal(izinli.statusCode, 200);
  assert.equal(izinli.json().rol, "usta");
});

test("rolü düşürülen hesap eski jetonuyla yetkisini hemen kaybeder", async () => {
  const editor = await kaydol({ kimlik: "dusen-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "gizli-sifre" });
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(editor.jeton) })).statusCode, 200);
  await s.istek("PUT", `/api/hesap/${editor.hesap.id}/rol`, { yonetici: true, govde: { rol: "vatandas" } });
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(editor.jeton) })).statusCode, 401);
});

test("editör hesabı yönetici şifresi olmadan editör uçlarına girer, vatandaş giremez", async () => {
  const editor = await kaydol({ kimlik: "api-editor", sifre: "sifresifre", rol: "editor", editorAnahtari: "gizli-sifre" });
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi")).statusCode, 401);
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(editor.jeton) })).statusCode, 200);
  const vatandas = await kaydol({ kimlik: "api-vatandas", sifre: "sifresifre" });
  assert.equal((await s.istek("GET", "/api/moduller?durum=hepsi", { basliklar: yetki(vatandas.jeton) })).statusCode, 401);
  // Model ayarları (maliyet) yalnızca yönetici şifresiyle
  assert.equal((await s.istek("PUT", "/api/kalfa/ayarlar", { basliklar: yetki(editor.jeton), govde: {} })).statusCode, 401);
});

test("vatandaş atölyeyi kullanamaz; bir usta başka ustanın taslağını ezemez", async () => {
  const kod = await readFile(path.join(KOK, "sdk", "ornekler", "yuzyil-avi.js"), "utf8");
  const vatandas = await kaydol({ kimlik: "atolye-vatandas", sifre: "sifresifre" });
  assert.equal((await s.istek("POST", "/api/moduller", { basliklar: yetki(vatandas.jeton), govde: { id: "taslak-a", ad: "Taslak", kod } })).statusCode, 401);

  const ilk = await s.istek("POST", "/api/moduller", { usta: true, govde: { id: "taslak-a", ad: "Taslak", kod } });
  assert.equal(ilk.statusCode, 201);
  const baska = await kaydol({ kimlik: "baska-usta", sifre: "sifresifre", rol: "usta" });
  assert.equal((await s.istek("POST", "/api/moduller", { basliklar: yetki(baska.jeton), govde: { id: "taslak-a", ad: "Ele geçirme", kod } })).statusCode, 409);
  assert.equal((await s.istek("POST", "/api/moduller", { usta: true, govde: { id: "taslak-a", ad: "Taslak 2", kod } })).statusCode, 201);
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
