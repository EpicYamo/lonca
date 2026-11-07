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
const sunucu = spawn(process.execPath, ["--input-type=module", "-e", baslatici], { env: { ...process.env, KALFA_SAHTE: "1", YONETICI_SIFRE: SIFRE, ILK_KULLANICILAR: "e2e-admin", ILK_SIFRE: "e2e-ilk-sifre", GOOGLE_HARITA_ANAHTARI: "" }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((coz, red) => { sunucu.stdout.on("data", (d) => String(d).includes("hazir") && coz()); sunucu.on("exit", red); });

const tarayici = await chromium.launch();
const hatalar = [];
const adim = (m) => console.log(`✓ ${m}`);
try {
  const studio = await (await tarayici.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  studio.on("pageerror", (e) => hatalar.push(`Studio: ${e.message}`));
  await studio.goto(`${ADRES}/studio/`);
  // Yönetici şifreli sunucuda Studio'nun tamamı giriş ister: kapıdan usta hesabı aç (kayıt olan herkes usta)
  await studio.waitForSelector("#hesap-pencere[open]");
  assert.ok(await studio.isVisible("#giris-kapisi"), "girişsiz Studio kapıda beklemeli");
  await studio.click("[data-hesap-kip=kayit]");
  await studio.fill("#hesap-kimlik", "e2e-usta");
  await studio.fill("#hesap-eposta", "e2e-usta@ornek.test");
  await studio.fill("#hesap-sifre", "e2e-usta-sifre");
  await studio.fill("#hesap-sifre2", "e2e-usta-sifre");
  await studio.click("#hesap-gonder");
  await studio.waitForSelector("#giris-kapisi", { state: "hidden" });
  await studio.waitForSelector("#atolye-kilit", { state: "hidden" });
  adim("usta hesabı açıldı, Studio açıldı");
  // İlk mesaj bir fikir: kalfa sohbet eder, kod yazmaz; yanıtın altında yeni öneri düğmeleri çıkar.
  await studio.fill("#istek", "Bursa hanları için süreli bir oyun");
  await studio.press("#istek", "Enter");
  await studio.waitForSelector("#oneriler:not([hidden]) >> text=Bursa hanları için süreli bir oyun yap");
  assert.equal(await studio.inputValue("#kod"), "", "kalfa istenmeden kod yazmamalı");
  adim("kalfa önce sohbet etti, öneri düğmeleri yenilendi");
  // Usta dalış kipini de görür
  assert.ok(await studio.isVisible(".kip button[data-kip=dalis]"), "usta Dalış kipini görmeli");
  await studio.click("#oneriler >> text=Bursa hanları için süreli bir oyun yap");
  await studio.waitForFunction(() => document.querySelector("#kod").value.includes("sahne.ayarla"), null, { timeout: 15000 });
  await studio.frameLocator("#cerceve").locator(".s-kapak").waitFor({ timeout: 10000 });
  adim("kalfa modülü yazdı, önizlemede kapak açıldı");
  await studio.click("#onaya-gonder");
  // Kalfanın kendi "iyi" durumu da aynı kutuda; gönderimin sonucunu metinden bekle
  await studio.waitForSelector("#durum.iyi >> text=onaya gönderildi");
  adim("modül onaya gönderildi");

  await studio.click(".sekme-d[data-sayfa=moduller]");
  // Usta listeyi görür ama yayınlayamaz; yeniden giriş de istenmez
  await studio.waitForSelector(".modul-ogesi .etiket.bekliyor");
  assert.ok(!(await studio.isVisible("#hesap-pencere[open]")), "usta Modüller'de yeniden giriş görmemeli");
  assert.equal(await studio.locator(".modul-ogesi >> text=Yayınla").count(), 0, "usta yayınlayamaz");
  adim("usta modülü listede görüyor, yayınlayamıyor");
  // Çıkış → kapı → hazır admin hesabıyla gir (ilk girişte yeni şifre zorunlu)
  await studio.click("#hesap-d");
  await studio.click("#hesap-kart button[value=cikis]");
  await studio.waitForSelector("#hesap-pencere[open]");
  assert.equal(await studio.locator("text=Yönetici şifresiyle gir").count(), 0, "yönetici şifresiyle giriş seçeneği olmamalı");
  await studio.fill("#hesap-kimlik", "e2e-admin");
  await studio.fill("#hesap-sifre", "e2e-ilk-sifre");
  await studio.click("#hesap-gonder");
  await studio.waitForSelector("#sifre-pencere[open]");
  await studio.fill("#sifre-yeni", "e2e-admin-yeni-sifre");
  await studio.fill("#sifre-tekrar", "e2e-admin-yeni-sifre");
  await studio.click("#sifre-gonder");
  await studio.waitForSelector("#giris-kapisi", { state: "hidden" });
  await studio.click(".sekme-d[data-sayfa=moduller]");
  await studio.click(".modul-ogesi >> text=Yayınla");
  await studio.waitForSelector(".etiket.onayli");
  adim("admin hesabıyla girildi, modül yayınlandı");

  const tel = await (await tarayici.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  tel.on("pageerror", (e) => hatalar.push(`Uygulama: ${e.message}`));
  await tel.goto(`${ADRES}/`);
  // Web sitesinde giriş ve tanışma zorunlu değil: doğrudan ana sayfa açılır.
  assert.ok(!(await tel.isVisible("#karsilama")), "web'de karşılama penceresi çıkmamalı");
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
  await tel.fill("#katki-formu [name=il]", "Bursa");
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

  await tel.click("#profil-cip");
  await tel.click("#profil-menu >> text=Profilim");
  await tel.waitForSelector("#profil-ekrani:not([hidden])");
  await tel.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
  await tel.fill("#hesap-kimlik", "e2e-gezgin");
  await tel.fill("#hesap-eposta", "e2e-gezgin@ornek.test");
  await tel.fill("#hesap-sifre", "e2e-gezgin-sifre");
  await tel.fill("#hesap-sifre2", "e2e-gezgin-sifre");
  await tel.click("#hesap-gonder");
  await tel.waitForSelector(".hesap-kart >> text=@e2e-gezgin");
  const tasinanPuan = await tel.evaluate(() => JSON.parse(localStorage.getItem("lonca.profil")).puan);
  assert.ok(tasinanPuan > 0, "cihazdaki profil puanı ilk kayıt sırasında hesaba taşınmalı");
  adim("App profilinden hesap açıldı, cihaz profili hesaba taşındı");

  await tel.locator(".hesap-kart").getByRole("button", { name: "Oturumu kapat" }).click();
  await tel.locator(".hesap-kart").getByRole("button", { name: "Giriş yap" }).click();
  await tel.fill("#hesap-kimlik", "e2e-gezgin@ornek.test");
  await tel.fill("#hesap-sifre", "e2e-gezgin-sifre");
  await tel.click("#hesap-gonder");
  await tel.waitForSelector(".hesap-kart >> text=@e2e-gezgin");
  adim("App hesabıyla e-postayla tekrar giriş yapıldı");

  assert.deepEqual(hatalar, [], "sayfa hatası olmamalı");
  console.log("\nUçtan uca senaryo başarılı.");
} catch (h) {
  console.error("✗", h.message, hatalar);
  process.exitCode = 1;
} finally {
  await tarayici.close();
  sunucu.kill();
}
