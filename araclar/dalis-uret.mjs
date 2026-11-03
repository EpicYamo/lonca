#!/usr/bin/env node
// Dalış kareleri üretici — "içine girerek" kaydırma (scroll) sahneleri için anahtar kareler.
//
//   node araclar/dalis-uret.mjs araclar/dalis/bursa-ulucami.json            # eksik kareleri üret
//   node araclar/dalis-uret.mjs araclar/dalis/bursa-ulucami.json --kare k4   # yalnızca birini (yeniden) üret
//   node araclar/dalis-uret.mjs araclar/dalis/bursa-ulucami.json --hepsi     # hepsini yeniden üret
//
// Kareler dikey (varsayılan 1024×1536, 2:3) üretilir: uygulama telefonda açılır ve dikey ekranda yatay bir
// karenin ancak üçte biri görünür, bu da görüntüyü iki kat büyütüp bulanıklaştırır.
//
// Kare türleri (spec.kareler[]):
//   { ad, kaynak: "/medya/eserler/x.jpg" }                 gerçek fotoğraf, 2:3'e kırpılır
//   { ad, kaynak, genislet: true, netlestir?: true }       gerçek fotoğraf tam genişlikte ortaya konur, üst/alt
//        boşluğu yapay zekâ doldurur, sonra GERÇEK pikseller yumuşak kenarla geri yapıştırılır.
//        netlestir: kaynak küçükse önce yapay zekâ ile netleştirilir (etiketi buna göre değişir).
//   { ad, uret: { istem, ref: [ "/medya/..." | { kare, kirp:[x,y,g] } ] } }
//        yapay zekâ ile üretilir. İlk ref bir önceki karenin kırpımıysa o kırpım, önceki karenin PORTAL'ı olur:
//        yeni kare o bölgenin "yakından" hâli olduğundan zincir dikiş yerinden kopmaz.
//   { ad, uydu: { lat, lng, z } }                        gerçek uydu görüntüsü (Esri World Imagery), z yakınlaştırma
//        düzeyinde karonlardan dikilir. Ardışık uydu kareleri arasındaki portal Mercator ile TAM hesaplanır:
//        uzaydan binaya kesintisiz iniş. Uydu karelerinin merkez/z bilgisi kunye.json'a yazılır (modül, eserlerin
//        uydu karesindeki yerini bununla hesaplar).
//   { ad, ayni: "k3" }                                    başka bir karenin görüntüsünü yeniden kullanır (merkez-kol gezisi)
//   Her karede isteğe bağlı portal: [x,y,g] — elle ölçülmüş portal (iki gerçek fotoğraf arasında gerekir).
//
// Çıktı: public/medya/dalis/<eser>/<ad>.jpg ve kunye.json (kare sırası, tür etiketi, portal, model).
//
// OpenAI uyumlu bir uç nokta kullanır (.env):
//   DALIS_API_URL (yoksa USTAGPT_BASE_URL), DALIS_API_ANAHTARI (yoksa USTAGPT_API_KEY),
//   DALIS_MODELLER="sohbet:gemini-3.1-flash-image,nano-banana-2"  (sırayla denenir)
//     "sohbet:" önekli modeller /chat/completions (görsel çıktılı) ile, diğerleri /images/edits ile çağrılır.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { dalisUretici, dalisAyarlari } from "../server/dalis-uretim.js";

const KOK = resolve(dirname(new URL(import.meta.url).pathname), "..");
try { process.loadEnvFile(join(KOK, ".env")); } catch {}

const argv = process.argv.slice(2);
const specYolu = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--kare");
if (!specYolu) { console.error("Kullanım: node araclar/dalis-uret.mjs <spec.json> [--kare ad] [--hepsi]"); process.exit(1); }
const tekKare = argv.includes("--kare") ? argv[argv.indexOf("--kare") + 1] : null;
const hepsi = argv.includes("--hepsi");

const spec = JSON.parse(readFileSync(specYolu, "utf8"));
const { api: API, anahtar: ANAHTAR } = dalisAyarlari();
const u = dalisUretici({ kok: KOK, eser: spec.eser, onek: spec.onek, boyut: spec.boyut, uyumEsigi: spec.uyumEsigi ?? 14 });
const CIKTI = u.CIKTI, kareYolu = u.kareYolu, uyduPortal = u.uyduPortal;

if (!API || !ANAHTAR) { console.error("DALIS_API_URL / DALIS_API_ANAHTARI (.env) gerekli."); process.exit(1); }

const eskiKunye = existsSync(join(CIKTI, "kunye.json")) ? JSON.parse(readFileSync(join(CIKTI, "kunye.json"), "utf8")) : [];
const kunye = [];
try {
  for (const [i, kare] of spec.kareler.entries()) {
    const istendi = kare.ayni ? false : tekKare ? kare.ad === tekKare : (hepsi || !existsSync(kareYolu(kare.ad)));
    const eski = eskiKunye.find((k) => k.ad === kare.ad);
    let model = eski?.model ?? null;
    if (istendi) {
      console.log(`  → ${kare.ad}`);
      if (kare.uydu) await u.uyduKare(kare);
      else if (!kare.ayni) {
        const r = kare.kaynak ? await u.gercekKare(kare) : await u.uretilenKare(kare);
        model = r.model; kare._yz = r.yz;
      }
    }
    const yz = istendi ? kare._yz : eski?.tur === "yeniden-cizim";
    const tur = kare.uydu ? "uydu" : kare.ayni ? (kunye.find((k) => k.ad === kare.ayni)?.tur ?? "canlandirma")
      : kare.kaynak ? (yz ? "yeniden-cizim" : kare.netlestir ? "netlestirilmis" : kare.genislet ? "genisletilmis" : "gercek") : "canlandirma";
    kunye.push({ ad: kare.ad, gorsel: kare.ayni ?? kare.ad, tur, kaynak: kare.kaynak ?? null, portal: kare.portal ?? null, cikis: kare.cikis ?? null, uydu: kare.uydu ?? null, model });
    if (i > 0 && kare.uydu && spec.kareler[i - 1].uydu && !kunye[i - 1].portal && !kunye[i - 1].cikis) {
      // İnişte (z büyüyor) önceki karenin portalı; çıkışta (z küçülüyor) önceki karenin "cikis"ı.
      if (kare.uydu.z > spec.kareler[i - 1].uydu.z) kunye[i - 1].portal = uyduPortal(spec.kareler[i - 1].uydu, kare.uydu);
      else kunye[i - 1].cikis = uyduPortal(kare.uydu, spec.kareler[i - 1].uydu);
    }
    // Bu kare bir önceki karenin kırpımından üretildiyse, o kırpım önceki karenin portalıdır.
    const ilk = kare.uret?.ref?.[0];
    if (i > 0 && ilk && typeof ilk === "object" && ilk.kare === spec.kareler[i - 1].ad && !kunye[i - 1].portal) kunye[i - 1].portal = ilk.kirp;
  }
  writeFileSync(join(CIKTI, "kunye.json"), JSON.stringify(kunye, null, 1) + "\n");
  console.log(`Bitti → public/medya/dalis/${spec.eser}/`);
  for (const k of kunye) console.log(`  ${k.ad.padEnd(6)} ${k.gorsel.padEnd(6)} ${k.tur.padEnd(15)} portal=${JSON.stringify(k.portal)} cikis=${JSON.stringify(k.cikis)}`);
} finally {
  u.temizle();
}
