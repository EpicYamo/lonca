// Kayıtta e-posta doğrulaması (e-posta gönderimi açıkken). Google ile gelen hesap doğrulama istemez.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deneySunucusu, kayitGovdesi } from "./yardimci.mjs";

const ISTEMCI = "test-istemci.apps.googleusercontent.com";
const idJetonu = (yuk) => ["e30", Buffer.from(JSON.stringify(yuk)).toString("base64url"), "imza"].join(".");
let siradaki = null;
const sahteGoogle = async () => new Response(JSON.stringify({
  id_token: idJetonu({ iss: "https://accounts.google.com", aud: ISTEMCI, exp: Math.floor(Date.now() / 1000) + 600, ...siradaki }),
}), { status: 200 });

const gidenler = [];
const s = await deneySunucusu({ GOOGLE_ISTEMCI_KIMLIGI: ISTEMCI, GOOGLE_ISTEMCI_SIRRI: "sir" }, {
  googleFetch: sahteGoogle, epostaGonderici: async (m) => { gidenler.push(m); },
});
const istek = (method, url, payload) => s.app.inject({ method, url, payload, headers: { host: "localhost:3000" } });
const sonPosta = (kime) => gidenler.filter((m) => m.kime === kime).at(-1);
const dogrulamaJetonu = (m) => m.metin.match(/#eposta-dogrula=([A-Za-z0-9_-]+)/)[1];

async function googleIleGir(kimlik) {
  siradaki = kimlik;
  const b = await istek("GET", "/api/hesap/google/baslat?donus=/app/");
  const durum = new URL(b.headers.location).searchParams.get("state");
  const d = await s.app.inject({ method: "GET", url: `/api/hesap/google/donus?code=k&state=${encodeURIComponent(durum)}`, headers: { host: "localhost:3000", cookie: String(b.headers["set-cookie"]).split(";")[0] } });
  const q = new URLSearchParams(d.headers.location.split("#")[1]);
  if (q.get("google-hata")) return { hata: q.get("google-hata") };
  return (await istek("POST", "/api/hesap/google/takas", { kod: q.get("google-kod") })).json();
}

test("kayıt jeton vermez, doğrulama bağlantısı gönderir; doğrulanmadan giriş 403", async () => {
  const k = await istek("POST", "/api/hesap/kayit", { ...kayitGovdesi({ kimlik: "yeni.uye", eposta: "uye@ornek.test", sifre: "sifresifre" }), donus: "/app/" });
  assert.equal(k.statusCode, 201);
  assert.equal(k.json().dogrulamaGerekli, true);
  assert.ok(!k.json().jeton, "doğrulanmadan oturum açılmamalı");
  const posta = sonPosta("uye@ornek.test");
  assert.equal(posta.konu, "Lonca e-posta doğrulama");
  assert.match(posta.metin, /http:\/\/localhost:3000\/app\/#eposta-dogrula=/);
  const g = await istek("POST", "/api/hesap/giris", { kimlik: "yeni.uye", sifre: "sifresifre" });
  assert.equal(g.statusCode, 403);
  assert.equal(g.json().dogrulamaGerekli, true);
  // Yanlış şifrede hesabın durumu söylenmez.
  assert.equal((await istek("POST", "/api/hesap/giris", { kimlik: "yeni.uye", sifre: "yanlissifre" })).statusCode, 401);
});

test("bağlantı hesabı doğrular ve oturum açar; tek kullanımlık", async () => {
  const jeton = dogrulamaJetonu(sonPosta("uye@ornek.test"));
  const d = await istek("POST", "/api/hesap/eposta-dogrula", { jeton });
  assert.equal(d.statusCode, 200);
  assert.ok(d.json().jeton);
  assert.equal(d.json().hesap.epostaDogrulandi, true);
  assert.equal((await istek("POST", "/api/hesap/eposta-dogrula", { jeton })).statusCode, 400);
  assert.equal((await istek("POST", "/api/hesap/giris", { kimlik: "uye@ornek.test", sifre: "sifresifre" })).statusCode, 200);
});

test("yeni bağlantı istenebilir; eski bağlantı geçersiz olur, yanıt her durumda aynı", async () => {
  await istek("POST", "/api/hesap/kayit", kayitGovdesi({ kimlik: "unutan.uye", eposta: "unutan@ornek.test", sifre: "sifresifre" }));
  const eski = dogrulamaJetonu(sonPosta("unutan@ornek.test"));
  const y1 = await istek("POST", "/api/hesap/eposta-dogrula/yeniden", { eposta: "unutan@ornek.test" });
  const y2 = await istek("POST", "/api/hesap/eposta-dogrula/yeniden", { eposta: "kimse@ornek.test" });
  assert.deepEqual(y1.json(), y2.json());
  const yeni = dogrulamaJetonu(sonPosta("unutan@ornek.test"));
  assert.notEqual(eski, yeni);
  assert.equal((await istek("POST", "/api/hesap/eposta-dogrula", { jeton: eski })).statusCode, 400);
  assert.equal((await istek("POST", "/api/hesap/eposta-dogrula", { jeton: yeni })).statusCode, 200);
});

test("Google ile gelen yeni hesap doğrulama istemez", async () => {
  const g = await googleIleGir({ sub: "g-yeni", email: "googlecu@gmail.com", email_verified: true });
  assert.ok(g.jeton);
  assert.equal(g.hesap.epostaDogrulandi, true);
});

test("doğrulanmamış hesabın e-postasıyla Google girişi bağlanmaz; doğrulanınca bağlanır", async () => {
  await istek("POST", "/api/hesap/kayit", kayitGovdesi({ kimlik: "bekleyen", eposta: "bekleyen@ornek.test", sifre: "sifresifre" }));
  const once = await googleIleGir({ sub: "g-bekleyen", email: "bekleyen@ornek.test", email_verified: true });
  assert.match(once.hata, /doğrulanmamış/);
  await istek("POST", "/api/hesap/eposta-dogrula", { jeton: dogrulamaJetonu(sonPosta("bekleyen@ornek.test")) });
  const sonra = await googleIleGir({ sub: "g-bekleyen", email: "bekleyen@ornek.test", email_verified: true });
  assert.equal(sonra.hesap.kimlik, "bekleyen");
});

test("profilde e-posta değişince doğrulama bağlantısı gider, giriş engellenmez", async () => {
  const t = await deneySunucusu({ ILK_SIFRE: "ilk-sifre", ILK_KULLANICILAR: "arda" }, { epostaGonderici: async (m) => { gidenler.push(m); } });
  const g = (await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } })).json();
  const p = await t.app.inject({ method: "PUT", url: "/api/hesap/profil", headers: { host: "localhost", authorization: `Bearer ${g.jeton}` }, payload: { eposta: "arda@ornek.test" } });
  assert.equal(p.json().epostaDogrulandi, false);
  assert.equal(sonPosta("arda@ornek.test").konu, "Lonca e-posta doğrulama");
  assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } })).statusCode, 200);
});
