// Erişilebilirlik taraması: axe-core (WCAG 2.2 AA) + klavye yolu + büyük yazıda taşma + sesli okumanın görsel karşılığı.
// Vatandaş uygulamasının ana ekranı, ayar pencereleri, yayındaki dört modül ve dalış oynatıcısı (hareketli ve sade) taranır.
// Çalıştırma: npm run test:erisim   (ayrıntı için ERISIM_AYRINTI=1)
import { spawn } from "node:child_process";
import { mkdtemp, cp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.log("Playwright kurulu değil: npm i -D playwright && npx playwright install chromium"); process.exit(0); }

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AXE = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PORT = 3990 + Math.floor(Math.random() * 9);
const ADRES = `http://localhost:${PORT}`;
const AYRINTI = !!process.env.ERISIM_AYRINTI;

// Gerçek içerikle çalışır ama çalışırken oluşan dosyalar depoya yazılmasın diye veri geçici bir kopyadan okunur.
const veri = await mkdtemp(path.join(tmpdir(), "lonca-erisim-"));
await cp(path.join(KOK, "data"), veri, { recursive: true });
const baslatici = `import { uygulamaKur } from ${JSON.stringify(path.join(KOK, "server", "uygulama.js"))};
const { app } = await uygulamaKur({ kok: ${JSON.stringify(KOK)}, veri: ${JSON.stringify(veri)}, gunluk: false });
await app.listen({ port: ${PORT}, host: "127.0.0.1" }); console.log("hazir");`;
const sunucu = spawn(process.execPath, ["--input-type=module", "-e", baslatici], {
  env: { ...process.env, KALFA_SAHTE: "1", YONETICI_SIFRE: "", GOOGLE_HARITA_ANAHTARI: "" }, stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((coz, red) => { sunucu.stdout.on("data", (d) => String(d).includes("hazir") && coz()); sunucu.on("exit", red); });

// Bu Mac'te Playwright'ın kendi Chromium'u yok; o durumda sistemdeki Chrome kullanılır.
const tarayici = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));

const MODULLER = ["Bursa Pusulası", "Payitaht Atlası", "Sisli Vakıf Atlası", "Vakıf Dalışları"];
const bulgular = []; // { yer, tur, ayrinti }
const bulgu = (yer, tur, ayrinti) => bulgular.push({ yer, tur, ayrinti });
const adim = (m) => console.log(`✓ ${m}`);
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

// Sesli okumayı (speechSynthesis) taklit eder: söylenen her metin kaydedilir, Türkçe ses varmış gibi davranılır.
const SES_TAKLIDI = () => {
  window.__soylenen = [];
  const ses = { lang: "tr-TR", name: "Sahte Türkçe", default: true, localService: true, voiceURI: "sahte" };
  window.SpeechSynthesisUtterance = class { constructor(m) { this.text = m; } };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [ses], speak: (u) => window.__soylenen.push(String(u.text)), cancel() {}, pause() {}, resume() {},
    addEventListener() {}, removeEventListener() {}, speaking: false, pending: false,
  } });
};

async function sayfaAc({ olcek = "1", hareket = false, genislik = 390, sesli = false } = {}) {
  const baglam = await tarayici.newContext({
    viewport: { width: genislik, height: 844 }, hasTouch: true, locale: "tr-TR",
    geolocation: { latitude: 40.1836, longitude: 29.0625 }, permissions: ["geolocation"],
    reducedMotion: hareket ? "reduce" : "no-preference",
  });
  await baglam.addInitScript(([tercih]) => {
    // Modül çerçevesi (sandbox) de bu betiği çalıştırır; orada localStorage yoktur.
    try { localStorage.setItem("lonca.erisim", JSON.stringify(tercih)); } catch {}
  }, [{ yazi: olcek, hareket, ses: sesli }]);
  if (sesli) await baglam.addInitScript(SES_TAKLIDI);
  const sayfa = await baglam.newPage();
  sayfa.on("pageerror", (h) => bulgu("sayfa", "js-hatasi", h.message));
  await sayfa.goto(`${ADRES}/app/`);
  return sayfa;
}

async function tanismayiGec(sayfa) {
  await sayfa.waitForSelector("#tanisma:not([hidden])", { timeout: 5000 }).catch(() => {});
  if (await sayfa.isVisible("#tanisma")) { await sayfa.fill("#tanisma-ad", "Erişim"); await sayfa.click("#tanisma-formu button:not([type=button])"); }
  await sayfa.waitForSelector("#moduller .karo");
}

async function axeTara(sayfa, yer, kapsam) {
  if (!(await sayfa.evaluate(() => !!window.axe))) await sayfa.addScriptTag({ content: AXE });
  // Açılış animasyonları bitmeden ölçülen renkler yanıltıcı olur (yarı saydam metin).
  await sayfa.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  const sonuc = await sayfa.evaluate(async (kapsam) => {
    const r = await window.axe.run(kapsam ? { include: [kapsam] } : document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations"],
    });
    return r.violations.map((v) => ({ id: v.id, etki: v.impact, yardim: v.help, dugumler: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) , sayi: v.nodes.length }));
  }, kapsam ?? null);
  for (const v of sonuc) bulgu(yer, `axe:${v.id}`, `${v.etki} · ${v.yardim} · ${v.sayi} öğe: ${v.dugumler.join(" | ")}`);
  return sonuc.length;
}

// Büyük yazıda yatay taşma: sayfa yana kayıyor mu, görünür bir öğe ekranın sağından taşıyor mu?
async function tasmaDenetle(sayfa, yer) {
  const sonuc = await sayfa.evaluate(() => {
    const en = document.documentElement.clientWidth;
    const sayfaKayar = document.documentElement.scrollWidth > en + 1;
    const tasanlar = [];
    for (const d of document.querySelectorAll("body *")) {
      if (d.closest("[hidden], .leaflet-container, svg, canvas, .gizli, [aria-hidden=true], .s-yatay, .one-cikan-seridi, .secki-seridi, .kategori-cipleri, .s-cipler, .s-dalis-noktalar")) continue;
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const s = getComputedStyle(d);
      if (s.visibility === "hidden" || s.position === "fixed" && r.right <= en + 1) continue;
      // Kendisi kaydırılabilir bir alanın içindeyse taşma değildir.
      let ata = d.parentElement, kayar = false;
      while (ata && ata !== document.body) { const o = getComputedStyle(ata).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") { kayar = true; break; } ata = ata.parentElement; }
      if (kayar) continue;
      if (r.right > en + 1 || r.left < -1) tasanlar.push(`${d.tagName.toLowerCase()}${d.id ? "#" + d.id : ""}${d.className && typeof d.className === "string" ? "." + d.className.trim().split(/\s+/).join(".") : ""} (${Math.round(r.left)}→${Math.round(r.right)} / ${en})`);
      // Metin kutusunun içinde kesilen yazı (overflow:hidden + tek satır).
      if ((s.overflow === "hidden" || s.overflowX === "hidden") && d.scrollWidth > d.clientWidth + 2 && s.textOverflow !== "ellipsis" && s.webkitLineClamp === "none" && d.textContent.trim() && !d.children.length)
        tasanlar.push(`${d.tagName.toLowerCase()}.${String(d.className).trim().split(/\s+/).join(".")} metni kesiliyor`);
    }
    return { sayfaKayar, tasanlar: [...new Set(tasanlar)].slice(0, 8) };
  });
  if (sonuc.sayfaKayar) bulgu(yer, "tasma:sayfa", "sayfa yatay kayıyor");
  for (const t of sonuc.tasanlar) bulgu(yer, "tasma:oge", t);
}

// Klavye: Tab ile gezilen her öğe görünür bir odak çerçevesi taşımalı ve ekranda olmalı.
async function klavyeDenetle(sayfa, yer, adimSayisi = 40) {
  const gorulen = new Set();
  for (let i = 0; i < adimSayisi; i++) {
    await sayfa.keyboard.press("Tab");
    const o = await sayfa.evaluate(() => {
      const d = document.activeElement;
      if (!d || d === document.body) return null;
      const s = getComputedStyle(d), r = d.getBoundingClientRect();
      const cerceve = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
      const ad = (d.getAttribute("aria-label") || d.innerText || d.value || d.title || "").trim().replace(/\s+/g, " ").slice(0, 40);
      const etiket = `${d.tagName.toLowerCase()}${d.id ? "#" + d.id : ""}${typeof d.className === "string" && d.className ? "." + d.className.trim().split(/\s+/)[0] : ""}`;
      const ekranda = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0;
      return { etiket, ad, cerceve, ekranda, kucuk: r.width < 24 || r.height < 24, en: Math.round(r.width), boy: Math.round(r.height) };
    });
    if (!o) continue;
    const anahtar = `${o.etiket}|${o.ad}`;
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    if (!o.cerceve) bulgu(yer, "klavye:odak-gorunmuyor", `${o.etiket} "${o.ad}"`);
    if (!o.ekranda) bulgu(yer, "klavye:ekran-disi", `${o.etiket} "${o.ad}"`);
    if (!o.ad) bulgu(yer, "klavye:adsiz", o.etiket);
    if (o.kucuk) bulgu(yer, "dokunma:kucuk-hedef", `${o.etiket} "${o.ad}" ${o.en}×${o.boy}`);
  }
  return gorulen.size;
}

// Sesli okunan her cümle ekranda da yazılı olmalı (işitme engelli kullanıcı için görsel karşılık).
async function sesGorselDenetle(sayfa, yer) {
  const eksik = await sayfa.evaluate(() => {
    const kucult = (s) => s.toLocaleLowerCase("tr").replace(/[\s.,:;!?·"“”'’()–—-]+/g, " ").trim();
    // innerText yalnızca görünen metni verir; dalış kartı gibi canlı bölgeler de dahildir.
    const ekran = kucult(document.body.innerText);
    const eksikler = [];
    for (const m of window.__soylenen ?? []) {
      for (const cumle of m.split(/(?<=[.!?])\s+/)) {
        const c = kucult(cumle);
        if (c.length < 4) continue;
        if (!ekran.includes(c)) eksikler.push(cumle.slice(0, 90));
      }
    }
    const okundu = (window.__soylenen ?? []).length;
    window.__soylenen = [];
    return { okundu, eksik: [...new Set(eksikler)].slice(0, 6) };
  });
  for (const e of eksik.eksik) bulgu(yer, "ses:gorsel-karsiligi-yok", `"${e}"`);
  if (AYRINTI) console.log(`   (${yer}: ${eksik.okundu} sesli okuma)`);
}

async function moduluAc(sayfa, ad) {
  await sayfa.locator("#moduller .karo", { hasText: ad }).first().click();
  await sayfa.waitForSelector("#modul-ekrani:not([hidden])");
  await sayfa.waitForFunction(() => document.querySelector("#sahne").childElementCount > 0 && document.querySelector("#acilis").hidden, null, { timeout: 15000 });
  await bekle(600);
}
async function anaEkranaDon(sayfa) {
  await sayfa.click("#geri");
  await sayfa.waitForSelector("#ana-ekran:not([hidden])");
}

try {
  // 1) Ana ekran ve pencereler (normal yazı, masaüstü genişliği de)
  for (const genislik of [390, 1280]) {
    const s = await sayfaAc({ genislik });
    await s.waitForSelector("#tanisma:not([hidden])");
    await axeTara(s, `tanışma (${genislik})`, "#tanisma");
    await tanismayiGec(s);
    await bekle(400);
    await axeTara(s, `ana ekran (${genislik})`);
    if (genislik === 390) {
      await s.click("#ust-bar [data-ayar]");
      await s.waitForSelector("#ayarlar:not([hidden])");
      await axeTara(s, "erişilebilirlik ayarları", "#ayarlar");
      await s.keyboard.press("Escape");
      await s.click("#eser-oner");
      await s.waitForSelector("#katki:not([hidden])");
      await axeTara(s, "eser öner formu", "#katki");
      await s.click("#katki-vazgec");
      await s.click("#secki .secki-karti");
      await s.waitForSelector("#eser-penceresi[open]");
      await axeTara(s, "eser penceresi", "#eser-penceresi");
      await s.keyboard.press("Escape");
      await s.click("#profil-cip");
      await s.waitForSelector("#profil-ekrani:not([hidden])");
      await axeTara(s, "profil");
      await s.click("#profil-geri");
    }
    await s.context().close();
  }
  adim("ana ekran, tanışma, ayarlar, öneri formu, eser penceresi ve profil tarandı");

  // 2) Klavye yolu: atlama bağlantısı, karolar, modülü klavyeyle açıp kapatma
  {
    const s = await sayfaAc({ genislik: 1280 });
    await tanismayiGec(s);
    await s.reload();
    await s.waitForSelector("#moduller .karo");
    await s.keyboard.press("Tab");
    const ilk = await s.evaluate(() => document.activeElement?.className);
    if (ilk !== "atla") bulgu("klavye", "klavye:atlama-baglantisi", `ilk Tab "İçeriğe geç"e gitmiyor (${ilk})`);
    await s.keyboard.press("Enter");
    const hedef = await s.evaluate(() => document.activeElement?.id);
    if (hedef !== "uygulamalar-baslik") bulgu("klavye", "klavye:atlama-baglantisi", `"İçeriğe geç" odağı taşımıyor (${hedef})`);
    await klavyeDenetle(s, "ana ekran klavye", 45);
    await s.locator("#moduller .karo", { hasText: "Vakıf Dalışları" }).focus();
    await s.keyboard.press("Enter");
    await s.waitForFunction(() => document.querySelector("#sahne").childElementCount > 0 && document.querySelector("#acilis").hidden, null, { timeout: 15000 });
    await bekle(500);
    const odakSahnede = await s.evaluate(() => !!document.activeElement?.closest("#modul-ekrani"));
    if (!odakSahnede) bulgu("klavye", "klavye:modul-odagi", "modül açılınca odak modül ekranına geçmiyor");
    await klavyeDenetle(s, "Vakıf Dalışları klavye", 25);
    await s.focus("#geri");
    await s.keyboard.press("Enter");
    await s.waitForSelector("#ana-ekran:not([hidden])");
    await s.context().close();
  }
  adim("klavye yolu denendi");

  // 3) Dört modül: normal yazıda axe + sesli okuma karşılığı, büyük yazıda (1.5×, 360 px) taşma
  for (const [olcek, genislik] of [["1", 390], ["1.5", 360]]) {
    const s = await sayfaAc({ olcek, genislik, sesli: olcek === "1" });
    await tanismayiGec(s);
    if (olcek !== "1") await tasmaDenetle(s, `ana ekran (yazı ${olcek}×)`);
    for (const ad of MODULLER) {
      await moduluAc(s, ad);
      const yer = `${ad}${olcek !== "1" ? ` (yazı ${olcek}×)` : ""}`;
      if (olcek === "1") { await axeTara(s, yer, "#modul-ekrani"); await sesGorselDenetle(s, yer); }
      else await tasmaDenetle(s, yer);
      // Kapaktaki ana düğmeyle ilk iç ekrana geç
      const ana = s.locator("#sahne .s-kapak .s-dugme.ana, #sahne .s-dugme.ana").first();
      if (await ana.count()) {
        await ana.click();
        await bekle(1500);
        if (olcek === "1") { await axeTara(s, `${yer} › iç ekran`, "#modul-ekrani"); await sesGorselDenetle(s, `${yer} › iç ekran`); }
        else await tasmaDenetle(s, `${yer} › iç ekran`);
        if (ad === "Vakıf Dalışları") {
          // Dalış oynatıcısında birkaç durak ilerle
          for (let i = 0; i < 4; i++) { await s.mouse.wheel(0, 900); await bekle(500); }
          if (olcek === "1") { await axeTara(s, "dalış oynatıcı (kaydırılmış)", "#modul-ekrani"); await sesGorselDenetle(s, "dalış oynatıcı"); }
          else await tasmaDenetle(s, "dalış oynatıcı (kaydırılmış)");
        }
      }
      await anaEkranaDon(s);
    }
    await s.context().close();
  }
  adim("dört modül tarandı (axe, sesli okuma karşılığı, 1.5× yazıda taşma)");

  // 4) Dalış oynatıcısı "hareketi azalt" ile (sade liste görünümü)
  {
    const s = await sayfaAc({ hareket: true });
    await tanismayiGec(s);
    await moduluAc(s, "Vakıf Dalışları");
    await s.locator("#sahne .s-dugme.ana").first().click();
    await s.waitForSelector(".s-dalis-duz, .s-dalis-liste", { timeout: 8000 }).catch(() => bulgu("dalış (sade)", "dalis:sade-yok", "hareketi azaltınca sade liste açılmadı"));
    await axeTara(s, "dalış oynatıcı (hareketi azalt)", "#modul-ekrani");
    await s.context().close();
  }
  adim("dalış oynatıcısının sade görünümü tarandı");
} catch (h) {
  console.error("✗ tarama yarıda kaldı:", h.message);
  process.exitCode = 1;
} finally {
  await tarayici.close();
  sunucu.kill();
}

// Rapor
const turler = new Map();
for (const b of bulgular) turler.set(b.tur, [...(turler.get(b.tur) ?? []), b]);
if (!bulgular.length) console.log("\nErişilebilirlik taraması temiz: bulgu yok.");
else {
  console.log(`\n${bulgular.length} bulgu:`);
  for (const [tur, liste] of turler) {
    console.log(`\n• ${tur} (${liste.length})`);
    for (const b of liste.slice(0, AYRINTI ? 99 : 5)) console.log(`   [${b.yer}] ${b.ayrinti}`);
    if (!AYRINTI && liste.length > 5) console.log(`   … ${liste.length - 5} tane daha (ERISIM_AYRINTI=1)`);
  }
  process.exitCode = 1;
}
