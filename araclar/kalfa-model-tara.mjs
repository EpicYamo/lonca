// Kalfa model taraması (komut satırı). UstaGPT'deki metin modellerinin her birine GERÇEK bir kalfa isteği
// gönderir ve hangilerinin doğrulamadan geçen bir modül ürettiğini ölçer. Sonuçlar Studio'nun da okuduğu
// data/kalfa-model-durumu.json'a yazılır. Anahtarlar yalnızca .env'den okunur, hiçbir yere yazılmaz.
//
// Kullanım:
//   node araclar/kalfa-model-tara.mjs                       # tüm metin modelleri
//   node araclar/kalfa-model-tara.mjs deepseek-v4-flash …   # yalnızca verilenler
//   seçenekler: --paralel 4   --zaman-asimi-dk 5   --yalniz-denenmemis
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kalfaHazirla } from "../server/kalfa.js";
import { modelKatalogu, AYAR_DOSYASI } from "../server/kalfa-ayarlari.js";
import { modelTaramasiKur, PARALEL, MODEL_ZAMAN_ASIMI_MS, TARAMA_FIKRI } from "../server/model-tarama.js";
import { jsonDosya } from "../server/depo.js";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(path.join(KOK, ".env")); } catch {}

const argv = process.argv.slice(2);
const secenek = (ad, varsayilan) => {
  const i = argv.indexOf(ad);
  if (i < 0) return varsayilan;
  const v = Number(argv[i + 1]);
  argv.splice(i, 2);
  return Number.isFinite(v) && v > 0 ? v : varsayilan;
};
const paralel = secenek("--paralel", PARALEL);
const zamanAsimiMs = secenek("--zaman-asimi-dk", MODEL_ZAMAN_ASIMI_MS / 60_000) * 60_000;
const yalnizDenenmemis = argv.includes("--yalniz-denenmemis");
const istenen = argv.filter((a) => !a.startsWith("--"));

const ortam = { ...process.env, [AYAR_DOSYASI]: path.join(KOK, "data", "kalfa-ayarlari.json") };
const { eserler } = JSON.parse(await readFile(path.join(KOK, "data", "eserler.json"), "utf8"));
const kalfa = kalfaHazirla({ kok: KOK, eserler, ortam });
if (!kalfa.ustagpt) {
  console.error("Modül kalfası UstaGPT'ye bağlı değil (KALFA_SAHTE ya da başka bir KALFA_API_URL). Tarama yapılmadı.");
  process.exit(1);
}

const { modeller } = await modelKatalogu({ ortam }).liste();
const metinler = modeller.filter((m) => m.tur === "metin").map((m) => m.deger);
const bilinmeyen = istenen.filter((m) => !metinler.includes(m));
if (bilinmeyen.length) {
  console.error(`UstaGPT listesinde olmayan metin modelleri: ${bilinmeyen.join(", ")}`);
  process.exit(1);
}

const dosya = jsonDosya(path.join(KOK, "data", "kalfa-model-durumu.json"), { sonuclar: {} });
const onceki = (await dosya.oku()).sonuclar ?? {};
let hedef = istenen.length ? istenen : metinler;
if (yalnizDenenmemis) hedef = hedef.filter((m) => !onceki[m]);

const sn = (ms) => `${(ms / 1000).toFixed(1)} sn`;
console.log(`${hedef.length} model taranıyor (paralel ${paralel}, model başına en çok ${zamanAsimiMs / 60_000} dk). Fikir: "${TARAMA_FIKRI}"`);
let sayac = 0;
const tarama = modelTaramasiKur({
  kalfa, dosya, paralel, zamanAsimiMs,
  gunluk: (model, s) => {
    sayac++;
    const ek = s.durum === "calisiyor" ? `${s.deneme} deneme, ${s.satir} satır` : s.hata;
    console.log(`[${sayac}/${hedef.length}] ${s.durum === "calisiyor" ? "✓" : "✗"} ${model.padEnd(28)} ${sn(s.sure).padStart(9)}  ${ek}`);
  },
});
await tarama.baslat(hedef).bitis;

// Özet: bu taramada sınanan modeller, çalışanlar hızlıdan yavaşa.
const sonuclar = await tarama.sonuclar();
const calisan = hedef.filter((m) => sonuclar[m]?.durum === "calisiyor").sort((a, b) => sonuclar[a].sure - sonuclar[b].sure);
console.log(`\nÇalışan ${calisan.length}/${hedef.length}: ${calisan.map((m) => `${m} (${sn(sonuclar[m].sure)})`).join(", ") || "yok"}`);
console.log(`Sonuçlar: ${path.relative(KOK, dosya.yol)}`);
