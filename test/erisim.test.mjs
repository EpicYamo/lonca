import { test } from "node:test";
import assert from "node:assert/strict";
import { deneySunucusu } from "./yardimci.mjs";

const ANA = "ana-anahtar-123";

test("anahtar yoksa /api açık kalır", async () => {
  const { istek } = await deneySunucusu();
  assert.equal((await istek("GET", "/api/ayarlar")).statusCode, 200);
  assert.deepEqual((await istek("GET", "/api/merhaba")).json(), { lonca: true, anahtarGerekli: false });
});

test("anahtar varsa /api korunur, merhaba açıktır", async () => {
  const { istek } = await deneySunucusu({ LONCA_API_ANAHTARI: ANA });
  const r = await istek("GET", "/api/ayarlar");
  assert.equal(r.statusCode, 401);
  assert.equal(r.json().anahtarGerekli, true);
  assert.equal((await istek("GET", "/api/eserler", { basliklar: { "x-lonca-anahtar": "yanlis" } })).statusCode, 401);
  assert.equal((await istek("GET", "/api/eserler", { basliklar: { "x-lonca-anahtar": ANA } })).statusCode, 200);
  assert.deepEqual((await istek("GET", "/api/merhaba")).json(), { lonca: true, anahtarGerekli: true });
  // Statik dosyalar ve tarayıcı yönlendirmesi
  assert.equal((await istek("GET", "/app/app.js")).statusCode, 200);
  const y = await istek("GET", "/studio/");
  assert.equal(y.statusCode, 302);
  assert.match(y.headers.location, /^\/giris\?devam=/);
});

test("eşleştirme kodu tek kullanımlık cihaz anahtarı verir, cihaz silinince geçersizleşir", async () => {
  const { istek } = await deneySunucusu({ LONCA_API_ANAHTARI: ANA });
  assert.equal((await istek("POST", "/api/eslestirme-kodu")).statusCode, 401);
  const { kod } = (await istek("POST", "/api/eslestirme-kodu", { basliklar: { "x-lonca-anahtar": ANA } })).json();
  assert.match(kod, /^\d{6}$/);
  assert.equal((await istek("POST", "/api/eslestir", { govde: { kod: "000000".replace(/./g, (c, i) => (kod[i] === "0" ? "1" : "0")) } })).statusCode, 401);
  const e = await istek("POST", "/api/eslestir", { govde: { kod, ad: "Pixel" } });
  assert.equal(e.statusCode, 200);
  const { anahtar, cihaz } = e.json();
  assert.equal((await istek("POST", "/api/eslestir", { govde: { kod } })).statusCode, 401, "kod ikinci kez kullanılamaz");
  const cihazla = { "x-lonca-anahtar": anahtar };
  assert.equal((await istek("GET", "/api/eserler", { basliklar: cihazla })).statusCode, 200);
  assert.equal((await istek("GET", "/api/cihazlar", { basliklar: cihazla })).statusCode, 401, "cihaz anahtarı yönetim yapamaz");
  assert.equal((await istek("DELETE", `/api/cihazlar/${cihaz.id}`, { basliklar: { "x-lonca-anahtar": ANA } })).statusCode, 200);
  assert.equal((await istek("GET", "/api/eserler", { basliklar: cihazla })).statusCode, 401);
});

test("tarayıcı girişi çerezle çalışır", async () => {
  const { istek } = await deneySunucusu({ LONCA_API_ANAHTARI: ANA });
  const form = { "content-type": "application/x-www-form-urlencoded" };
  assert.equal((await istek("POST", "/giris", { govde: "anahtar=yanlis&devam=%2Fstudio%2F", basliklar: form })).statusCode, 401);
  const g = await istek("POST", "/giris", { govde: `anahtar=${ANA}&devam=%2Fstudio%2F`, basliklar: form });
  assert.equal(g.statusCode, 302);
  assert.equal(g.headers.location, "/studio/");
  const cerez = g.headers["set-cookie"].split(";")[0];
  assert.equal((await istek("GET", "/api/eserler", { basliklar: { cookie: cerez } })).statusCode, 200);
  assert.equal((await istek("GET", "/studio/", { basliklar: { cookie: cerez } })).statusCode, 200);
  assert.doesNotMatch(g.headers["set-cookie"], /Secure/, "düz HTTP'de Secure yok");
  const h = await istek("POST", "/giris", { govde: `anahtar=${ANA}`, basliklar: { ...form, "x-forwarded-proto": "https" } });
  assert.match(h.headers["set-cookie"], /; Secure$/, "Nginx arkasında HTTPS'te Secure");
  const d = await istek("POST", "/giris", { govde: `anahtar=${ANA}&devam=%2F%2Fkotu.example`, basliklar: form });
  assert.equal(d.headers.location, "/app/", "dış adrese yönlendirmez");
});

test("hız sınırı vekil arkasında LONCA_IP_BASLIGI'ndaki gerçek istemci IP'sini sayar", async () => {
  const { hizSiniri, istemciIp } = await import("../server/guvenlik.js");
  const onceki = process.env.LONCA_IP_BASLIGI;
  const sahteYanit = () => ({ kod: 200, header() { return this; }, code(k) { this.kod = k; return this; }, send() { return this; } });
  const istek = (ip) => ({ ip: "172.18.0.5", headers: { "cf-connecting-ip": ip, "x-forwarded-for": "1.1.1.1" } });
  try {
    delete process.env.LONCA_IP_BASLIGI;
    assert.equal(istemciIp(istek("203.0.113.7")), "172.18.0.5", "başlık ayarlı değilken req.ip kullanılır");
    process.env.LONCA_IP_BASLIGI = "CF-Connecting-IP";
    assert.equal(istemciIp(istek("203.0.113.7")), "203.0.113.7");
    assert.equal(istemciIp({ ip: "172.18.0.5", headers: {} }), "172.18.0.5", "başlık yoksa req.ip'ye düşer");
    const sinir = hizSiniri({ adet: 1, pencereMs: 60_000 });
    const a = sahteYanit(), b = sahteYanit(), c = sahteYanit();
    await sinir(istek("203.0.113.7"), a);
    await sinir(istek("198.51.100.9"), b);
    await sinir(istek("203.0.113.7"), c);
    assert.deepEqual([a.kod, b.kod, c.kod], [200, 200, 429], "aynı vekil IP'sinden gelen farklı istemciler ayrı sayılır");
  } finally {
    if (onceki === undefined) delete process.env.LONCA_IP_BASLIGI; else process.env.LONCA_IP_BASLIGI = onceki;
  }
});
