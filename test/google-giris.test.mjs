// E-posta alanı, şifre tekrarı ve Google ile giriş (Google'ın token uç noktası sahte fetch ile taklit edilir).
import { test } from "node:test";
import assert from "node:assert/strict";
import { deneySunucusu, kayitGovdesi } from "./yardimci.mjs";

const ISTEMCI = "test-istemci.apps.googleusercontent.com";
const GOOGLE_ORTAMI = { GOOGLE_ISTEMCI_KIMLIGI: ISTEMCI, GOOGLE_ISTEMCI_SIRRI: "test-sirri" };
const idJetonu = (yuk) => ["e30", Buffer.from(JSON.stringify(yuk)).toString("base64url"), "imza"].join(".");

// Sıradaki takasta Google'ın döndüreceği kimlik; testler bunu değiştirir.
let siradaki = null;
const sahteGoogle = async (url, init) => {
  assert.equal(url, "https://oauth2.googleapis.com/token");
  const p = new URLSearchParams(String(init.body));
  assert.equal(p.get("client_secret"), "test-sirri");
  assert.equal(p.get("redirect_uri"), "http://localhost:80/api/hesap/google/donus");
  return new Response(JSON.stringify({ id_token: idJetonu({ iss: "https://accounts.google.com", aud: ISTEMCI, exp: Math.floor(Date.now() / 1000) + 600, ...siradaki }) }), { status: 200 });
};

const s = await deneySunucusu(GOOGLE_ORTAMI, { googleFetch: sahteGoogle });

// baslat → (Google) → donus → takas zincirini bir tarayıcı gibi yürütür; { jeton, hesap } ya da { hata } döner.
async function googleIleGir(kimlik, { istemci = "web", donus = "/studio/", sunucu = s } = {}) {
  siradaki = kimlik;
  const b = await sunucu.app.inject({ method: "GET", url: `/api/hesap/google/baslat?istemci=${istemci}&donus=${encodeURIComponent(donus)}`, headers: { host: "localhost:80" } });
  assert.equal(b.statusCode, 302);
  const yetki = new URL(b.headers.location);
  assert.equal(yetki.origin + yetki.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(yetki.searchParams.get("client_id"), ISTEMCI);
  const cerez = String(b.headers["set-cookie"]).split(";")[0];
  const d = await sunucu.app.inject({
    method: "GET", url: `/api/hesap/google/donus?code=kod123&state=${encodeURIComponent(yetki.searchParams.get("state"))}`,
    headers: { host: "localhost:80", cookie: cerez },
  });
  let kod, hata;
  if (istemci === "uygulama") {
    assert.equal(d.statusCode, 200);
    const m = d.body.match(/com\.kozmos\.lonca:\/\/google\?([^"]+)"/);
    const q = new URLSearchParams(m[1].replace(/&amp;/g, "&"));
    kod = q.get("kod"); hata = q.get("hata");
  } else {
    assert.equal(d.statusCode, 302);
    const [yol, parca] = d.headers.location.split("#");
    assert.equal(yol, donus);
    const q = new URLSearchParams(parca);
    kod = q.get("google-kod"); hata = q.get("google-hata");
  }
  if (hata) return { hata };
  const t = await sunucu.istek("POST", "/api/hesap/google/takas", { govde: { kod } });
  assert.equal(t.statusCode, 200);
  const ikinci = await sunucu.istek("POST", "/api/hesap/google/takas", { govde: { kod } });
  assert.equal(ikinci.statusCode, 401, "kod tek kullanımlık olmalı");
  return t.json();
}

test("kayıt e-posta ve eşleşen şifre tekrarı ister; e-posta tekil", async () => {
  const kayit = (g) => s.istek("POST", "/api/hesap/kayit", { govde: g });
  assert.equal((await kayit({ kimlik: "epostasiz", sifre: "sifresifre", sifreTekrar: "sifresifre" })).statusCode, 400);
  const yanlis = await kayit({ kimlik: "tekrarsiz", eposta: "t@ornek.test", sifre: "sifresifre", sifreTekrar: "baskasifre" });
  assert.equal(yanlis.statusCode, 400);
  assert.equal(yanlis.json().hata, "Şifreler eşleşmiyor");
  const ilk = await kayit({ kimlik: "eposta-ilk", eposta: "Ayni@Ornek.test", sifre: "sifresifre", sifreTekrar: "sifresifre" });
  assert.equal(ilk.statusCode, 201);
  assert.equal(ilk.json().hesap.eposta, "ayni@ornek.test");
  assert.equal((await kayit({ kimlik: "eposta-ikinci", eposta: "ayni@ornek.test", sifre: "sifresifre", sifreTekrar: "sifresifre" })).statusCode, 409);
});

test("e-postayla ya da kullanıcı adıyla giriş yapılır", async () => {
  await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "ikili-giris", eposta: "ikili@ornek.test", sifre: "dogrusifre" }) });
  const ile = (kimlik, sifre = "dogrusifre") => s.istek("POST", "/api/hesap/giris", { govde: { kimlik, sifre } });
  assert.equal((await ile("ikili-giris")).statusCode, 200);
  assert.equal((await ile("IKILI@ornek.test")).json().hesap.kimlik, "ikili-giris");
  assert.equal((await ile("ikili@ornek.test", "yanlissifre")).statusCode, 401);
  assert.equal((await ile("yok@ornek.test")).statusCode, 401);
});

test("ayarlar Google'ın açık olduğunu bildirir; ayar yoksa kapalı ve baslat 404", async () => {
  assert.equal((await s.istek("GET", "/api/ayarlar")).json().hesap.google, true);
  const kapali = await deneySunucusu();
  assert.equal((await kapali.istek("GET", "/api/ayarlar")).json().hesap.google, false);
  assert.equal((await kapali.istek("GET", "/api/hesap/google/baslat")).statusCode, 404);
});

test("Google ile ilk giriş yeni usta hesabı açar, ikincisi aynı hesaba girer", async () => {
  const ilk = await googleIleGir({ sub: "g-1", email: "Yeni.Kisi@gmail.com", email_verified: true, name: "Yeni Kişi" });
  assert.equal(ilk.hesap.rol, "usta");
  assert.equal(ilk.hesap.kimlik, "yeni.kisi");
  assert.equal(ilk.hesap.eposta, "yeni.kisi@gmail.com");
  assert.equal(ilk.hesap.profil.ad, "Yeni Kişi");
  assert.equal(ilk.hesap.google, true);
  assert.equal(ilk.hesap.sifreVar, false);
  const ben = await s.istek("GET", "/api/hesap/ben", { basliklar: { authorization: `Bearer ${ilk.jeton}` } });
  assert.equal(ben.statusCode, 200);
  const ikinci = await googleIleGir({ sub: "g-1", email: "yeni.kisi@gmail.com", email_verified: true }, { istemci: "uygulama" });
  assert.equal(ikinci.hesap.id, ilk.hesap.id);
  // Şifresi olmayan hesap şifreyle giremez, ama eski şifre sorulmadan şifre belirleyebilir.
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "yeni.kisi", sifre: "herhangisifre" } })).statusCode, 401);
  const sifre = await s.istek("PUT", "/api/hesap/sifre", { basliklar: { authorization: `Bearer ${ilk.jeton}` }, govde: { yeniSifre: "yepyenisifre" } });
  assert.equal(sifre.statusCode, 200);
  assert.equal((await s.istek("POST", "/api/hesap/giris", { govde: { kimlik: "yeni.kisi@gmail.com", sifre: "yepyenisifre" } })).statusCode, 200);
});

test("Google e-postası kayıtlı bir hesaptaysa o hesaba bağlanır", async () => {
  const kayit = (await s.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "kayitli-kisi", eposta: "kayitli@ornek.test", sifre: "sifresifre" }) })).json();
  const g = await googleIleGir({ sub: "g-2", email: "KAYITLI@ornek.test", email_verified: true });
  assert.equal(g.hesap.id, kayit.hesap.id);
  assert.equal(g.hesap.google, true);
  assert.equal(g.hesap.sifreVar, true, "bağlanan hesabın şifresi korunur");
});

test("doğrulanmamış e-posta hiçbir hesaba bağlanmaz ve hesap açmaz", async () => {
  const g = await googleIleGir({ sub: "g-3", email: "kayitli@ornek.test", email_verified: false });
  assert.match(g.hata, /doğrulanmamış/);
});

test("hazır admin hesabı e-posta ekleyip Google'a bağlanınca ilk şifre geçersiz olur, yetkisi gelir", async () => {
  const t = await deneySunucusu({ ...GOOGLE_ORTAMI, ILK_SIFRE: "ilk-sifre", ILK_KULLANICILAR: "arda" }, { googleFetch: sahteGoogle });
    const giris = (await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } })).json();
    const yetki = { authorization: `Bearer ${giris.jeton}` };
    const p = await t.istek("PUT", "/api/hesap/profil", { basliklar: yetki, govde: { eposta: "arda@ornek.test" } });
    assert.equal(p.json().eposta, "arda@ornek.test");
    // Başka hesabın e-postası alınamaz.
    const diger = (await t.istek("POST", "/api/hesap/kayit", { govde: kayitGovdesi({ kimlik: "diger", eposta: "diger@ornek.test", sifre: "sifresifre" }) })).json();
    assert.equal((await t.istek("PUT", "/api/hesap/profil", { basliklar: yetki, govde: { eposta: "diger@ornek.test" } })).statusCode, 409);

    const g = await googleIleGir({ sub: "g-arda", email: "arda@ornek.test", email_verified: true }, { sunucu: t });
    assert.equal(g.hesap.kimlik, "arda");
    assert.equal(g.hesap.rol, "editor");
    assert.equal(g.hesap.sifreDegismeli, false);
    assert.equal((await t.istek("POST", "/api/hesap/giris", { govde: { kimlik: "arda", sifre: "ilk-sifre" } })).statusCode, 401, "ortak ilk şifre artık geçmez");
    const rol = await t.istek("PUT", `/api/hesap/${diger.hesap.id}/rol`, { basliklar: { authorization: `Bearer ${g.jeton}` }, govde: { rol: "usta" } });
    assert.equal(rol.statusCode, 200, "admin yetkisi çalışmalı");
});

test("çerezi tutmayan ya da bozuk durumla dönüş reddedilir; dönüş adresi beyaz listede", async () => {
  const b = await s.app.inject({ method: "GET", url: "/api/hesap/google/baslat?donus=https://kotu.example/", headers: { host: "localhost:80" } });
  const durum = new URL(b.headers.location).searchParams.get("state");
  const cerezsiz = await s.app.inject({ method: "GET", url: `/api/hesap/google/donus?code=x&state=${encodeURIComponent(durum)}`, headers: { host: "localhost:80" } });
  assert.equal(cerezsiz.statusCode, 302);
  assert.match(cerezsiz.headers.location, /^\/#google-hata=/);
  assert.equal((await s.istek("POST", "/api/hesap/google/takas", { govde: { kod: "uydurma" } })).statusCode, 401);
});
