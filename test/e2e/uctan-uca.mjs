import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.log("Playwright kurulu değil: npm i -D playwright && npx playwright install chromium"); process.exit(0); }

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 3900 + Math.floor(Math.random() * 90);
const ADRES = `http://localhost:${PORT}`;
const SIFRE = "e2e-sifre";

const veri = await mkdtemp(path.join(tmpdir(), "lonca-e2e-"));
await mkdir(path.join(veri, "moduller"), { recursive: true });
await copyFile(path.join(KOK, "data", "eserler.json"), path.join(veri, "eserler.json"));
await writeFile(path.join(veri, "moduller", "index.json"), "[]");
const baslatici = `import { uygulamaKur } from ${JSON.stringify(path.join(KOK, "server", "uygulama.js"))};
const { app } = await uygulamaKur({ kok: ${JSON.stringify(KOK)}, veri: ${JSON.stringify(veri)}, gunluk: false });
await app.listen({ port: ${PORT}, host: "127.0.0.1" }); console.log("hazir");`;
const sunucu = spawn(process.execPath, ["--input-type=module", "-e", baslatici], { env: { ...process.env, KALFA_SAHTE: "1", YONETICI_SIFRE: SIFRE, GOOGLE_HARITA_ANAHTARI: "" }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((coz, red) => { sunucu.stdout.on("data", (d) => String(d).includes("hazir") && coz()); sunucu.on("exit", red); });

const tarayici = await chromium.launch();
const hatalar = [];
const adim = (m) => console.log(`✓ ${m}`);
try {
  const studio = await (await tarayici.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  studio.on("pageerror", (e) => hatalar.push(`Studio: ${e.message}`));
  await studio.goto(`${ADRES}/studio/`);
  // Yönetici şifreli sunucuda atölye kilitli: usta hesabı aç
  await studio.waitForSelector("#atolye-kilit:not([hidden])");
  await studio.click("#kilit-kayit");
  await studio.fill("#hesap-kimlik", "e2e-usta");
  await studio.fill("#hesap-sifre", "e2e-usta-sifre");
  await studio.click("#hesap-gonder");
  await studio.waitForSelector("#hesap-pencere:not([open])", { state: "attached" });
  await studio.waitForSelector("#atolye-kilit", { state: "hidden" });
  adim("usta hesabı açıldı, atölye kilidi kalktı");
  await studio.fill("#istek", "Bursa hanları için süreli bir oyun");
  await studio.press("#istek", "Enter");
  await studio.waitForFunction(() => document.querySelector("#kod").value.includes("sahne.ayarla"), null, { timeout: 15000 });
  await studio.frameLocator("#cerceve").locator(".s-kapak").waitFor({ timeout: 10000 });
  adim("kalfa modülü yazdı, önizlemede kapak açıldı");
  await studio.click("#onaya-gonder");
  await studio.waitForSelector("#durum.iyi");
  adim("modül onaya gönderildi");

  await studio.click(".sekme-d[data-sayfa=moduller]");
  // Usta tüm modül listesini göremez: hesap penceresinden yönetici şifresine geçilir
  await studio.waitForSelector("#hesap-pencere[open]");
  await studio.click("#hesap-yonetici");
  await studio.waitForSelector("#giris[open]");
  await studio.fill("#giris-sifre", SIFRE);
  await studio.click("#giris-formu .birincil");
  await studio.click(".modul-ogesi >> text=Yayınla");
  await studio.waitForSelector(".etiket.onayli");
  adim("yönetici girişi yapıldı, modül yayınlandı");

  const tel = await (await tarayici.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  tel.on("pageerror", (e) => hatalar.push(`Uygulama: ${e.message}`));
  await tel.goto(`${ADRES}/app/`);
  await tel.fill("#tanisma-ad", "Deneme");
  await tel.click("#tanisma-formu button:not([type=button])");
  await tel.click("#moduller .karo");
  await tel.waitForSelector(".s-kapak");
  assert.ok(await tel.isVisible("#kapsul"), "kapsül görünmeli");
  await tel.click(".s-kapak .s-dugme.ana");
  await tel.waitForSelector(".s-ust-cubuk");
  adim("vatandaş modülü açtı: kapak → oyun ekranı");
  await tel.click("#geri");
  await tel.waitForSelector("#ana-ekran:not([hidden])");
  adim("kapsülden çıkış ana ekrana döndü");

  await tel.click("#eser-oner");
  await tel.fill("#katki-formu [name=ad]", "Uçtan Uca Çeşmesi");
  await tel.selectOption("#katki-formu [name=tur]", "cesme");
  await tel.fill("#katki-formu [name=tarihce]", "Test sırasında önerilen, mahalle arasında küçük bir çeşme.");
  await tel.fill("#katki-formu [name=kaynak]", "E2E testi");
  await tel.click("#katki-gonder");
  await tel.waitForSelector("#katki", { state: "hidden" });
  await studio.click(".sekme-d[data-sayfa=icerik]");
  await studio.waitForSelector("#oneriler-listesi >> text=Uçtan Uca Çeşmesi");
  adim("eser önerisi Studio'daki onay kuyruğuna düştü");
  await studio.click("#oneriler-listesi >> text=İncele ve onayla");
  await studio.click("#eser-formu [type=submit]");
  await studio.waitForSelector("#eser-durum.iyi");
  const yayinda = await (await fetch(`${ADRES}/api/eserler?ad=${encodeURIComponent("Uçtan Uca")}`)).json();
  assert.equal(yayinda.length, 1);
  adim("öneri onaylandı ve eser yayına girdi");

  assert.deepEqual(hatalar, [], "sayfa hatası olmamalı");
  console.log("\nUçtan uca senaryo başarılı.");
} catch (h) {
  console.error("✗", h.message, hatalar);
  process.exitCode = 1;
} finally {
  await tarayici.close();
  sunucu.kill();
}
