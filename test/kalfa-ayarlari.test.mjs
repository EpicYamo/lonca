import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deneySunucusu, KOK } from "./yardimci.mjs";
import { kalfaSaglayicisi, dalisSaglayicisi, modelleriSiniflandir, AYAR_DOSYASI, VARSAYILAN } from "../server/kalfa-ayarlari.js";
import { kalfaAyarDogrula, kalfaTaramaDogrula } from "../server/dogrulama.js";
import { modelDene, saglikEkle, hataOzeti } from "../server/model-tarama.js";

// UstaGPT /models yanıtının gerçek şekli (anahtarsız örnek)
const MODELLER = {
  object: "list",
  data: [
    { id: "gemini-3.8-flash", object: "model", owned_by: "google", context_window: 1048576, endpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"] },
    { id: "gemini-3.5-flash", object: "model", owned_by: "google", endpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"] },
    { id: "gpt-6.1-sol", object: "model", owned_by: "openai", endpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"] },
    { id: "gemini-3.1-flash-image", object: "model", owned_by: "ustagpt", endpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"] },
    { id: "nano-banana-2", object: "model", owned_by: "google", endpoints: ["/v1/images/generations", "/v1/images/edits"] },
    { id: "tts-1", object: "model", owned_by: "openai", endpoints: ["/v1/audio/speech"] },
    { id: "text-embedding-3-small", object: "model", owned_by: "openai", endpoints: ["/v1/embeddings"] },
  ],
};
const USTA = { USTAGPT_BASE_URL: "https://usta.example/v1/", USTAGPT_API_KEY: "deneme-anahtari" };

const gercekFetch = globalThis.fetch;
let cagrilar = [], fetchYaniti;
before(() => {
  globalThis.fetch = async (url, secenek = {}) => {
    cagrilar.push({ url: String(url), yetki: secenek.headers?.authorization });
    return fetchYaniti(String(url), secenek);
  };
});
after(() => { globalThis.fetch = gercekFetch; });
beforeEach(() => { cagrilar = []; fetchYaniti = () => new Response(JSON.stringify(MODELLER), { status: 200 }); });

test("model listesi metin ve görsel olarak sınıflandırılır; ses ve gömme modelleri elenir", () => {
  const l = modelleriSiniflandir(MODELLER);
  const bul = (id) => l.find((m) => m.id === id);
  assert.equal(bul("gpt-6.1-sol").tur, "metin");
  assert.equal(bul("gemini-3.1-flash-image").tur, "gorsel");
  assert.equal(bul("gemini-3.1-flash-image").deger, "sohbet:gemini-3.1-flash-image");
  assert.equal(bul("nano-banana-2").deger, "nano-banana-2");
  assert.equal(bul("tts-1"), undefined);
  assert.equal(bul("text-embedding-3-small"), undefined);
});

test("UstaGPT birincildir; seçim .env modelini geçersiz kılar, başka uç noktada uygulanmaz", async () => {
  const dizin = await mkdtemp(path.join(tmpdir(), "lonca-ayar-"));
  const dosya = path.join(dizin, "kalfa-ayarlari.json");
  const ortam = { ...USTA, ANTHROPIC_API_KEY: "x", KALFA_MODEL: "gpt-6.1-sol", [AYAR_DOSYASI]: dosya };

  let s = kalfaSaglayicisi(ortam);
  assert.equal(s.tur, "openai-uyumlu");
  assert.equal(s.url, "https://usta.example/v1");
  assert.equal(s.model, "gpt-6.1-sol");
  assert.equal(kalfaSaglayicisi({ ...USTA, [AYAR_DOSYASI]: dosya }).model, VARSAYILAN.kalfaModeli);

  await writeFile(dosya, JSON.stringify({ kalfaModeli: "gemini-3.5-flash", dalisMetinModelleri: ["gpt-6.1-sol"] }));
  assert.equal(kalfaSaglayicisi(ortam).model, "gemini-3.5-flash");
  assert.deepEqual(dalisSaglayicisi(ortam).metinModelleri, ["gpt-6.1-sol"]);
  assert.deepEqual(dalisSaglayicisi(ortam).modeller, VARSAYILAN.dalisGorselModelleri);

  // Başka bir uç noktaya yönlendirilmiş kalfada UstaGPT seçimi ve anahtarı kullanılmaz.
  s = kalfaSaglayicisi({ ...ortam, KALFA_API_URL: "http://localhost:11434/v1", KALFA_MODEL: "qwen" });
  assert.equal(s.model, "qwen");
  assert.equal(s.anahtar, "");
  assert.equal(kalfaSaglayicisi({ ...ortam, KALFA_SAHTE: "1" }).tur, "sahte");
});

test("ayar doğrulaması: biçim, tür ve listede bulunma", () => {
  const modeller = modelleriSiniflandir(MODELLER);
  assert.deepEqual(kalfaAyarDogrula({ kalfaModeli: "gpt-6.1-sol" }, modeller), { hatalar: [], ayar: { kalfaModeli: "gpt-6.1-sol" } });
  assert.ok(kalfaAyarDogrula({ kalfaModeli: "yok-boyle-model" }, modeller).hatalar.length);
  assert.ok(kalfaAyarDogrula({ kalfaModeli: "nano-banana-2" }, modeller).hatalar.length, "görsel model kalfaya seçilemez");
  assert.ok(kalfaAyarDogrula({ dalisGorselModelleri: ["gpt-6.1-sol"] }, modeller).hatalar.length, "metin modeli görsel listeye giremez");
  assert.equal(kalfaAyarDogrula({ dalisGorselModelleri: ["sohbet:gemini-3.1-flash-image", "nano-banana-2"] }, modeller).hatalar.length, 0);
  assert.ok(kalfaAyarDogrula({ dalisMetinModelleri: [] }).hatalar.length);
  assert.ok(kalfaAyarDogrula({ dalisMetinModelleri: ["a", "a"] }).hatalar.length);
  assert.ok(kalfaAyarDogrula({ kalfaModeli: "<script>" }).hatalar.length);
  assert.ok(kalfaAyarDogrula({ baska: 1 }).hatalar.length);
  assert.ok(kalfaAyarDogrula({}).hatalar.length);
  assert.ok(kalfaAyarDogrula([]).hatalar.length);
  assert.deepEqual(kalfaAyarDogrula({ kalfaModeli: null }).ayar, { kalfaModeli: null });
});

test("GET /api/kalfa/modeller yönetici ister, listeyi önbellekten verir, anahtarı sızdırmaz", async () => {
  const s = await deneySunucusu({ ...USTA, KALFA_SAHTE: "" });
  try {
    assert.equal((await s.istek("GET", "/api/kalfa/modeller")).statusCode, 401);
    const y = await s.istek("GET", "/api/kalfa/modeller", { yonetici: true });
    assert.equal(y.statusCode, 200);
    const j = y.json();
    assert.equal(j.modeller.length, 5);
    assert.equal(j.secili.kalfaModeli, VARSAYILAN.kalfaModeli);
    assert.deepEqual(j.secili.dalisMetinModelleri, VARSAYILAN.dalisMetinModelleri);
    assert.equal(cagrilar.length, 1);
    assert.equal(cagrilar[0].url, "https://usta.example/v1/models");
    assert.equal(cagrilar[0].yetki, "Bearer deneme-anahtari");
    assert.ok(!y.body.includes("deneme-anahtari"));

    await s.istek("GET", "/api/kalfa/modeller", { yonetici: true });
    assert.equal(cagrilar.length, 1, "ikinci istek önbellekten");
    await s.istek("GET", "/api/kalfa/modeller?yenile=1", { yonetici: true });
    assert.equal(cagrilar.length, 2);
  } finally { await s.app.close(); }
});

test("PUT /api/kalfa/ayarlar seçimi kaydeder, kalfa hemen kullanır; listede olmayanı reddeder", async () => {
  const s = await deneySunucusu({ ...USTA, KALFA_SAHTE: "" });
  try {
    const govde = { kalfaModeli: "gpt-6.1-sol", dalisGorselModelleri: ["nano-banana-2"], dalisMetinModelleri: ["gemini-3.5-flash"] };
    assert.equal((await s.istek("PUT", "/api/kalfa/ayarlar", { govde })).statusCode, 401);

    let y = await s.istek("PUT", "/api/kalfa/ayarlar", { govde: { kalfaModeli: "olmayan-model" }, yonetici: true });
    assert.equal(y.statusCode, 400);
    assert.match(y.json().hata, /listesinde/);
    y = await s.istek("PUT", "/api/kalfa/ayarlar", { govde: { kalfaModeli: 42 }, yonetici: true });
    assert.equal(y.statusCode, 400);

    y = await s.istek("PUT", "/api/kalfa/ayarlar", { govde, yonetici: true });
    assert.equal(y.statusCode, 200);
    assert.equal(y.json().secili.kalfaModeli, "gpt-6.1-sol");
    assert.deepEqual(y.json().secili.dalisGorselModelleri, ["nano-banana-2"]);
    assert.deepEqual(JSON.parse(await readFile(path.join(s.veri, "kalfa-ayarlari.json"), "utf8")), govde);
    assert.equal(s.kalfa.model, "gpt-6.1-sol", "yeniden başlatmadan geçerli");
    assert.equal((await s.istek("GET", "/api/kalfa")).json().model, "gpt-6.1-sol");

    // null alanı siler; .env / varsayılan geri gelir
    y = await s.istek("PUT", "/api/kalfa/ayarlar", { govde: { kalfaModeli: null }, yonetici: true });
    assert.equal(y.json().secili.kalfaModeli, VARSAYILAN.kalfaModeli);
    assert.deepEqual(y.json().secili.dalisGorselModelleri, ["nano-banana-2"]);
  } finally { await s.app.close(); }
});

test("UstaGPT tanımlı değilse ya da hata verirse anlaşılır yanıt döner", async () => {
  const yok = await deneySunucusu();
  try {
    const y = await yok.istek("GET", "/api/kalfa/modeller", { yonetici: true });
    assert.equal(y.statusCode, 503);
    assert.match(y.json().hata, /USTAGPT_BASE_URL/);
    assert.equal((await yok.istek("PUT", "/api/kalfa/ayarlar", { govde: { kalfaModeli: "gpt-6.1-sol" }, yonetici: true })).statusCode, 503);
  } finally { await yok.app.close(); }

  fetchYaniti = () => new Response("yetkisiz", { status: 401 });
  const s = await deneySunucusu({ ...USTA });
  try {
    const y = await s.istek("GET", "/api/kalfa/modeller", { yonetici: true });
    assert.equal(y.statusCode, 502);
    assert.match(y.json().hata, /401/);
  } finally { await s.app.close(); }
});

// ---------- Kalfa model taraması ----------

// modul_yaz araç çağrısı içeren bir OpenAI uyumlu yanıt (gerçek kalfa yolunu çalıştırır).
const modulYaniti = (kod) => new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: [{
  id: "c1", type: "function", function: { name: "modul_yaz", arguments: JSON.stringify({ id: "tarama-deneme", ad: "Tarama", aciklama: "Deneme", kod, aciklama_ustaya: "Hazır." }) },
}] } }] }), { status: 200, headers: { "content-type": "application/json" } });

test("modelDene: çalışan, hata veren ve zaman aşımına uğrayan model", async () => {
  const simdi = () => new Date("2026-11-07T10:00:00Z");
  const iyi = await modelDene({ calistir: async () => ({ kod: "a\nb\nc", deneme: 2 }) }, "m1", { simdi });
  assert.deepEqual({ ...iyi, sure: 0 }, { durum: "calisiyor", sure: 0, deneme: 2, satir: 3, tarih: "2026-11-07T10:00:00.000Z" });

  const kotu = await modelDene({ calistir: async () => { throw Object.assign(new Error("Yapay zekâ sağlayıcısı hata verdi (503): Internal server error"), { durumKodu: 503 }); } }, "m2");
  assert.equal(kotu.durum, "hata");
  assert.equal(kotu.hata, "503 · Internal server error");

  // Kalfa iptal sinyaline uyar; modelin toplam süresi dolunca tarama beklemez.
  const takili = { calistir: (_s, _k, { sinyal }) => new Promise((_, red) => sinyal.addEventListener("abort", () => red(sinyal.reason))) };
  const z = await modelDene(takili, "m3", { zamanAsimiMs: 30 });
  assert.equal(z.durum, "hata");
  assert.match(z.hata, /zaman aşımı/);

  assert.match(hataOzeti(Object.assign(new Error("Kalfa geçerli bir modül üretemedi"), { ayrintilar: ["satır 3: x"] })), /^doğrulama: satır 3/);
  assert.match(hataOzeti(Object.assign(new Error("kota"), { durumKodu: 429 })), /^429/);
});

test("sağlık bilgisi: çalışanlar hızlıdan yavaşa üstte, hata verenler en altta; görsel modeller dokunulmaz", () => {
  const modeller = modelleriSiniflandir(MODELLER);
  const l = saglikEkle(modeller, {
    "gemini-3.8-flash": { durum: "hata", hata: "503" },
    "gpt-6.1-sol": { durum: "calisiyor", sure: 9000 },
    "gemini-3.5-flash": { durum: "calisiyor", sure: 4000 },
  });
  const metin = l.filter((m) => m.tur === "metin");
  assert.deepEqual(metin.map((m) => m.deger), ["gemini-3.5-flash", "gpt-6.1-sol", "gemini-3.8-flash"]);
  assert.equal(metin[2].saglik.durum, "hata");
  assert.ok(l.filter((m) => m.tur === "gorsel").every((m) => !("saglik" in m)));
  assert.equal(saglikEkle(modeller).find((m) => m.deger === "gpt-6.1-sol").saglik.durum, "denenmedi");
});

test("tarama doğrulaması: boş gövde, liste biçimi ve listede bulunma", () => {
  const modeller = modelleriSiniflandir(MODELLER);
  assert.deepEqual(kalfaTaramaDogrula({}), { hatalar: [], liste: null });
  assert.deepEqual(kalfaTaramaDogrula(undefined), { hatalar: [], liste: null });
  assert.deepEqual(kalfaTaramaDogrula({ modeller: ["gpt-6.1-sol"] }, modeller), { hatalar: [], liste: ["gpt-6.1-sol"] });
  assert.ok(kalfaTaramaDogrula({ modeller: ["nano-banana-2"] }, modeller).hatalar.length, "görsel model kalfayla sınanmaz");
  assert.ok(kalfaTaramaDogrula({ modeller: [] }).hatalar.length);
  assert.ok(kalfaTaramaDogrula({ modeller: "gpt-6.1-sol" }).hatalar.length);
  assert.ok(kalfaTaramaDogrula({ modeller: ["a", "a"] }).hatalar.length);
  assert.ok(kalfaTaramaDogrula({ modeller: ["<script>"] }).hatalar.length);
  assert.ok(kalfaTaramaDogrula({ baska: 1 }).hatalar.length);
  assert.ok(kalfaTaramaDogrula([]).hatalar.length);
});

test("POST /api/kalfa/modeller/tara gerçek kalfa yolunu çalıştırır, sonucu kaydeder ve listeye işler", async () => {
  const kod = await readFile(path.join(KOK, "sdk", "ornekler", "hanlar-rehberi.js"), "utf8");
  const modellerIstek = [];
  fetchYaniti = (url, secenek) => {
    if (url.endsWith("/models")) return new Response(JSON.stringify(MODELLER), { status: 200 });
    const model = JSON.parse(secenek.body).model;
    modellerIstek.push(model);
    return model === "gpt-6.1-sol" ? modulYaniti(kod) : new Response(JSON.stringify({ error: { message: "Internal server error" } }), { status: 503 });
  };
  const sahte = await deneySunucusu({ KALFA_SAHTE: "1" });
  try {
    const y = await sahte.istek("POST", "/api/kalfa/modeller/tara", { govde: {}, yonetici: true });
    assert.equal(y.statusCode, 409, "sahte kalfada tarama yapılmaz");
  } finally { await sahte.app.close(); }

  const s = await deneySunucusu({ ...USTA, KALFA_SAHTE: "" });
  try {
    assert.equal((await s.istek("POST", "/api/kalfa/modeller/tara", { govde: {} })).statusCode, 401);
    assert.equal((await s.istek("GET", "/api/kalfa/modeller/tara")).statusCode, 401);
    assert.equal((await s.istek("POST", "/api/kalfa/modeller/tara", { govde: { modeller: ["yok-model"] }, yonetici: true })).statusCode, 400);
    assert.equal((await s.istek("POST", "/api/kalfa/modeller/tara", { govde: { modeller: 5 }, yonetici: true })).statusCode, 400);

    const y = await s.istek("POST", "/api/kalfa/modeller/tara", { govde: { modeller: ["gpt-6.1-sol", "gemini-3.8-flash"] }, yonetici: true });
    assert.equal(y.statusCode, 202);
    assert.equal(y.json().ilerleme.toplam, 2);
    assert.equal((await s.istek("POST", "/api/kalfa/modeller/tara", { govde: {}, yonetici: true })).statusCode, 409, "aynı anda tek tarama");

    // 503 veren model kalfanın yeniden denemelerini (3 sn + 6 sn) bekler; bitene kadar yokla.
    let durum;
    for (let i = 0; i < 150; i++) {
      durum = (await s.istek("GET", "/api/kalfa/modeller/tara", { yonetici: true })).json();
      if (!durum.calisiyor) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(durum.calisiyor, false);
    assert.equal(durum.sonuclar["gpt-6.1-sol"].durum, "calisiyor");
    assert.equal(durum.sonuclar["gpt-6.1-sol"].deneme, 1);
    assert.equal(durum.sonuclar["gemini-3.8-flash"].durum, "hata");
    assert.match(durum.sonuclar["gemini-3.8-flash"].hata, /^503/);
    assert.equal(modellerIstek.filter((m) => m === "gemini-3.8-flash").length, 3, "503'te iki kez yeniden denenir");

    const kayit = JSON.parse(await readFile(path.join(s.veri, "kalfa-model-durumu.json"), "utf8"));
    assert.equal(kayit.sonuclar["gpt-6.1-sol"].durum, "calisiyor");

    const liste = (await s.istek("GET", "/api/kalfa/modeller", { yonetici: true })).json();
    const metin = liste.modeller.filter((m) => m.tur === "metin");
    assert.equal(metin[0].deger, "gpt-6.1-sol", "çalışan model üstte");
    assert.equal(metin.at(-1).deger, "gemini-3.8-flash", "hata veren en altta");
    assert.equal(metin.find((m) => m.deger === "gemini-3.5-flash").saglik.durum, "denenmedi");
    assert.equal(liste.tarama.calisiyor, false);
    assert.ok(!JSON.stringify(liste).includes("deneme-anahtari"));
    assert.equal(s.kalfa.model, VARSAYILAN.kalfaModeli, "tarama seçili modeli değiştirmez");
  } finally { await s.app.close(); }
});
