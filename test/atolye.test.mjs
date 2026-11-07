// Atölye oturumları: Studio'da kalfa sohbeti ve modül taslağı sayfa yenilense de sunucuda kalır (issue #26).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deneySunucusu } from "./yardimci.mjs";
import { atolyeKur } from "../server/atolye.js";
import { atolyeTaslakDogrula } from "../server/dogrulama.js";

let s;
before(async () => { s = await deneySunucusu(); });
after(async () => { await s.app.close(); });

const yeniOturum = async (secenek = { usta: true }) => (await s.istek("POST", "/api/atolye/oturumlar", { govde: {}, ...secenek })).json();

test("atölye oturumları usta ya da editör hesabı ister", async () => {
  assert.equal((await s.istek("GET", "/api/atolye/oturumlar")).statusCode, 401);
  assert.equal((await s.istek("POST", "/api/atolye/oturumlar", { govde: {} })).statusCode, 401);
  // Kayıt olan usta olur; vatandaş rolü yönetici şifresiyle verilir.
  const vatandas = (await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "atolye-vatandas", sifre: "sifresifre" } })).json();
  await s.istek("PUT", `/api/hesap/${vatandas.hesap.id}/rol`, { yonetici: true, govde: { rol: "vatandas" } });
  const y = await s.istek("GET", "/api/atolye/oturumlar", { basliklar: { authorization: `Bearer ${vatandas.jeton}` } });
  assert.equal(y.statusCode, 401);
});

test("kalfanın yanıtı ve modül taslağı oturuma yazılır; oturum yeniden açılınca geri gelir", async () => {
  const o = await yeniOturum();
  assert.match(o.id, /^[a-f0-9]{12}$/);
  // İlk mesaj bir fikir: kalfa yalnızca sohbet eder, kod yazmaz.
  const fikir = (await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "hanlarda bir hazine avı", kod: "" } })).json();
  assert.equal(fikir.tur, "sohbet");
  assert.equal(fikir.kod, undefined);
  assert.ok(fikir.oneriler.length > 0);
  let ara = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json();
  assert.ok(!ara.taslak?.kod, "sohbet yanıtı taslağa kod yazmaz");
  assert.equal(ara.mesajlar[1].ek.tur, "sohbet");
  assert.deepEqual(ara.mesajlar[1].ek.oneriler, fikir.oneriler);

  const y = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "tamam, yap", kod: "" } });
  assert.equal(y.statusCode, 200);
  const sonuc = y.json();
  assert.equal(sonuc.tur, "modul");

  // Sayfa yenilendi: istemci oturumu sunucudan okur.
  const geri = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json();
  assert.equal(geri.baslik, "hanlarda bir hazine avı");
  assert.deepEqual(geri.mesajlar.map((m) => m.rol), ["usta", "kalfa", "usta", "kalfa"]);
  assert.equal(geri.mesajlar[3].metin, sonuc.aciklama_ustaya);
  assert.equal(geri.mesajlar[3].ek.model, "sahte");
  assert.equal(geri.mesajlar[3].ek.tur, "modul");
  assert.equal(geri.taslak.kod, sonuc.kod);
  assert.equal(geri.taslak.id, sonuc.id);
  assert.equal(geri.bekleyen, null);

  // Kalfa ürettiği kodu hâlâ tanır (modül gönderilince kaynak "kalfa" yazılır).
  const liste = (await s.istek("GET", "/api/atolye/oturumlar", { usta: true })).json().oturumlar;
  const ozet = liste.find((x) => x.id === o.id);
  assert.equal(ozet.mesajSayisi, 4);
  assert.equal(ozet.modul, sonuc.ad);
  assert.equal(ozet.bekliyor, false);
});

test("ikinci istekte kalfaya önceki konuşma da gider", async () => {
  const o = await yeniOturum();
  await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "cami yarışması" } });
  const gonderilen = [];
  const eski = s.kalfa.calistir;
  s.kalfa.calistir = async (sohbet, kod) => { gonderilen.push(sohbet); return eski(sohbet, kod); };
  try {
    await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "renkleri değiştir", kod: "// eski kod" } });
  } finally { s.kalfa.calistir = eski; }
  assert.deepEqual(gonderilen[0].map((m) => m.rol), ["usta", "kalfa", "usta"]);
  assert.equal(gonderilen[0].at(-1).metin, "renkleri değiştir");
});

test("kalfa hata verirse hata mesajı oturuma yazılır ve sonraki isteğe karışmaz", async () => {
  const o = await yeniOturum();
  const eski = s.kalfa.calistir;
  s.kalfa.calistir = async () => { throw Object.assign(new Error("sağlayıcı yanıt vermedi"), { ayrintilar: ["zaman aşımı"] }); };
  let y;
  try { y = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "bozuk istek" } }); }
  finally { s.kalfa.calistir = eski; }
  assert.equal(y.statusCode, 502);
  const geri = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json();
  assert.equal(geri.mesajlar.at(-1).hata, true);
  assert.match(geri.mesajlar.at(-1).metin, /zaman aşımı/);
  assert.equal(geri.bekleyen, null);

  const gonderilen = [];
  s.kalfa.calistir = async (sohbet, kod) => { gonderilen.push(sohbet); return eski(sohbet, kod); };
  try { await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "yeniden dene" } }); }
  finally { s.kalfa.calistir = eski; }
  assert.deepEqual(gonderilen[0], [{ rol: "usta", metin: "yeniden dene" }]);
});

test("kalfa çalışırken oturum 'bekliyor' görünür; aynı oturuma ikinci istek reddedilir", async () => {
  const o = await yeniOturum();
  let bitir;
  const eski = s.kalfa.calistir;
  s.kalfa.calistir = (sohbet, kod) => new Promise((coz) => { bitir = () => coz(eski(sohbet, kod)); });
  const ilk = s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "uzun süren istek" } });
  try {
    for (let i = 0; i < 50 && !bitir; i++) await new Promise((r) => setTimeout(r, 10));
    // İstemci bu sırada sayfayı yeniledi: oturum isteği ve bekleme durumunu gösterir.
    const ara = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json();
    assert.ok(ara.bekleyen?.baslangic);
    assert.equal(ara.mesajlar.at(-1).metin, "uzun süren istek");
    const ikinci = await s.istek("POST", "/api/kalfa", { usta: true, govde: { oturum: o.id, istek: "bir daha" } });
    assert.equal(ikinci.statusCode, 409);
    assert.equal((await s.istek("DELETE", `/api/atolye/oturumlar/${o.id}`, { usta: true })).statusCode, 409);
    bitir();
    assert.equal((await ilk).statusCode, 200);
  } finally { s.kalfa.calistir = eski; }
  const son = (await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json();
  assert.equal(son.bekleyen, null);
  assert.equal(son.mesajlar.at(-1).rol, "kalfa");
});

test("taslak kaydedilir, doğrulanır; oturum silinebilir", async () => {
  const o = await yeniOturum();
  const taslak = { kod: "import { sahne } from \"@lonca/sdk\";", ad: "Deneme", id: "deneme", aciklama: "", renk: "firuze", ikon: "", kategori: "oyun" };
  assert.equal((await s.istek("PUT", `/api/atolye/oturumlar/${o.id}/taslak`, { usta: true, govde: taslak })).statusCode, 200);
  assert.deepEqual((await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).json().taslak, taslak);

  assert.equal((await s.istek("PUT", `/api/atolye/oturumlar/${o.id}/taslak`, { usta: true, govde: { kod: 5 } })).statusCode, 400);
  assert.equal((await s.istek("PUT", `/api/atolye/oturumlar/${o.id}/taslak`, { usta: true, govde: { kod: "x".repeat(150_001) } })).statusCode, 400);
  assert.equal((await s.istek("PUT", `/api/atolye/oturumlar/${o.id}/taslak`, { usta: true, govde: { gizli: "1" } })).statusCode, 400);
  assert.equal((await s.istek("GET", "/api/atolye/oturumlar/../../kullanicilar", { usta: true })).statusCode, 404);
  assert.equal((await s.istek("GET", "/api/atolye/oturumlar/ZZZ", { usta: true })).statusCode, 400);

  assert.equal((await s.istek("DELETE", `/api/atolye/oturumlar/${o.id}`, { usta: true })).statusCode, 200);
  assert.equal((await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { usta: true })).statusCode, 404);
});

test("her kullanıcı yalnızca kendi oturumlarını görür; hesapsız yönetici ayrı tutulur", async () => {
  const o = await yeniOturum();
  const baska = (await s.istek("POST", "/api/hesap/kayit", { govde: { kimlik: "baska-usta", sifre: "sifresifre", rol: "usta" } })).json();
  const baskaBaslik = { authorization: `Bearer ${baska.jeton}` };
  assert.equal((await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { basliklar: baskaBaslik })).statusCode, 404);
  assert.equal((await s.istek("GET", "/api/atolye/oturumlar", { basliklar: baskaBaslik })).json().oturumlar.length, 0);
  assert.equal((await s.istek("GET", `/api/atolye/oturumlar/${o.id}`, { yonetici: true })).statusCode, 404);

  const y = await yeniOturum({ yonetici: true });
  assert.ok((await s.istek("GET", "/api/atolye/oturumlar", { yonetici: true })).json().oturumlar.some((x) => x.id === y.id));
  const ustaninki = (await s.istek("GET", "/api/hesap/ben", { usta: true })).json();
  const dosya = JSON.parse(await readFile(path.join(s.veri, "atolye", `${ustaninki.id}.json`), "utf8"));
  assert.ok(dosya.oturumlar.some((x) => x.id === o.id));
});

test("sunucu yeniden başlarsa yarım kalan kalfa isteği hata olarak kapanır", async () => {
  const dizin = path.join(s.veri, "atolye-yeniden");
  const a = atolyeKur(dizin);
  const o = await a.olustur("abc123");
  await a.kalfaBaslat("abc123", o.id, { istek: "yarım kalacak", kod: null });
  // Yeni süreç: aynı dizin, çalışan iş kaydı yok.
  const b = atolyeKur(dizin);
  const geri = await b.getir("abc123", o.id);
  assert.equal(geri.bekleyen, null);
  assert.equal(geri.mesajlar.at(-1).hata, true);
  assert.equal((await b.liste("abc123"))[0].bekliyor, false);
});

test("dalış isteği oturuma iş kimliğiyle yazılır", async () => {
  const dizin = path.join(s.veri, "atolye-dalis");
  const a = atolyeKur(dizin);
  const o = await a.olustur("yonetici");
  await a.dalisEkle("yonetici", o.id, { istek: "Yeşil Türbe dalışı", is: "is-1" });
  const geri = await a.getir("yonetici", o.id);
  assert.deepEqual(geri.mesajlar.map((m) => [m.rol, m.dalis ?? null]), [["usta", null], ["kalfa", "is-1"]]);
  const { sohbet } = await a.kalfaBaslat("yonetici", o.id, { istek: "şimdi modül", kod: null });
  assert.deepEqual(sohbet, [{ rol: "usta", metin: "şimdi modül" }]);
});

test("taslak doğrulaması", () => {
  assert.equal(atolyeTaslakDogrula(null).hatalar.length, 1);
  assert.deepEqual(atolyeTaslakDogrula({ kod: "a" }).taslak, { kod: "a", ad: "", id: "", aciklama: "", renk: "", ikon: "", kategori: "" });
  assert.ok(atolyeTaslakDogrula({ ad: "x".repeat(201) }).hatalar.length);
});
