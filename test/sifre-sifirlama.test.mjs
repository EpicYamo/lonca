// Şifremi unuttum: e-postaya tek kullanımlık bağlantı, bağlantıyla yeni şifre (SMTP sahte göndericiyle taklit edilir).
import { test } from "node:test";
import assert from "node:assert/strict";
import { deneySunucusu, kayitGovdesi } from "./yardimci.mjs";

const gidenler = [];
const s = await deneySunucusu({}, { epostaGonderici: async (m) => { gidenler.push(m); } });
const iste = (eposta, host = "localhost:3000") => s.app.inject({ method: "POST", url: "/api/hesap/sifre-sifirla/iste", headers: { host }, payload: { eposta, donus: "/studio/" } });
const jetonu = (m) => decodeURIComponent(m.metin.match(/#sifre-sifirla=([A-Za-z0-9_-]+)/)[1]);

test("ayarlar şifre sıfırlamanın açık olduğunu bildirir; SMTP yoksa istek 503", async () => {
  assert.equal((await s.istek("GET", "/api/ayarlar")).json().hesap.sifreSifirlama, true);
  const kapali = await deneySunucusu();
  assert.equal((await kapali.istek("GET", "/api/ayarlar")).json().hesap.sifreSifirlama, false);
  assert.equal((await kapali.istek("POST", "/api/hesap/sifre-sifirla/iste", { govde: { eposta: "a@ornek.test" } })).statusCode, 503);
});

test("kayıtlı e-postaya bağlantı gider, kayıtsıza gitmez; yanıt ikisinde de aynı", async () => {
  await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "unutkan", eposta: "unutkan@ornek.test", sifre: "eskisifre1" }) });
  gidenler.length = 0;
  const kayitli = await iste("Unutkan@ornek.test");
  const kayitsiz = await iste("yok@ornek.test");
  assert.equal(kayitli.statusCode, 200);
  assert.deepEqual(kayitli.json(), kayitsiz.json());
  assert.equal(gidenler.length, 1);
  assert.equal(gidenler[0].kime, "unutkan@ornek.test");
  assert.match(gidenler[0].metin, /http:\/\/localhost:3000\/studio\/#sifre-sifirla=/);
});

test("bağlantı localhost dışında uydurulmuş Host'a kurulmaz", async () => {
  const y = await iste("unutkan@ornek.test", "kotu.example");
  assert.equal(y.statusCode, 503);
});

test("bağlantıyla yeni şifre belirlenir, oturum açılır; bağlantı tek kullanımlık", async () => {
  gidenler.length = 0;
  await iste("unutkan@ornek.test");
  const jeton = jetonu(gidenler[0]);
  const sifirla = (g) => s.istek("POST", "/api/hesap/sifre-sifirla", { govde: g });
  const uyusmaz = await sifirla({ jeton, yeniSifre: "yenisifre12", yeniSifreTekrar: "baskasifre" });
  assert.equal(uyusmaz.statusCode, 400);
  assert.equal(uyusmaz.json().hata, "Şifreler eşleşmiyor");
  const y = await sifirla({ jeton, yeniSifre: "yenisifre12", yeniSifreTekrar: "yenisifre12" });
  assert.equal(y.statusCode, 200);
  assert.equal(y.json().hesap.kimlik, "unutkan");
  assert.ok(y.json().jeton);
  assert.equal((await sifirla({ jeton, yeniSifre: "dahayeni123", yeniSifreTekrar: "dahayeni123" })).statusCode, 400, "ikinci kullanım reddedilmeli");
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "unutkan", sifre: "eskisifre1" } })).statusCode, 401);
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "unutkan@ornek.test", sifre: "yenisifre12" } })).statusCode, 200);
  assert.equal((await sifirla({ jeton: "uydurma", yeniSifre: "yenisifre12", yeniSifreTekrar: "yenisifre12" })).statusCode, 400);
});

test("hazır admin hesabı sıfırlamayla ilk şifre zorunluluğundan çıkar", async () => {
  const gelen = [];
  const t = await deneySunucusu({ ILK_SIFRE: "ilk-sifre", ILK_KULLANICILAR: "sevilay" }, { epostaGonderici: async (m) => { gelen.push(m); } });
  const g = (await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "sevilay", sifre: "ilk-sifre" } })).json();
  await t.istek("PUT", "/api/hesap/profil", { basliklar: { authorization: `Bearer ${g.jeton}` }, govde: { eposta: "sevilay@ornek.test" } });
  await t.app.inject({ method: "POST", url: "/api/hesap/sifre-sifirla/iste", headers: { host: "localhost" }, payload: { eposta: "sevilay@ornek.test" } });
  const y = await t.istek("POST", "/api/hesap/sifre-sifirla", { govde: { jeton: jetonu(gelen[0]), yeniSifre: "sevilayin-sifresi", yeniSifreTekrar: "sevilayin-sifresi" } });
  assert.equal(y.json().hesap.rol, "editor");
  assert.equal(y.json().hesap.sifreDegismeli, false);
});
