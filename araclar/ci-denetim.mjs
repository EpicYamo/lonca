// CI tutarlılık denetimi: veri dosyaları, modül sözleşmesi ve depoya girmemesi gereken dosyalar.
// Kullanım: npm run denetle   (hata bulursa çıkış kodu 1)
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eserDogrula } from "../server/dogrulama.js";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hatalar = [];
const hata = (m) => hatalar.push(m);
const oku = async (yol) => {
  try {
    return JSON.parse(await readFile(path.join(KOK, yol), "utf8"));
  } catch (e) {
    hata(`${yol}: geçerli JSON değil (${e.message})`);
    return null;
  }
};

// ---------- Depoda izlenen dosyalar ----------
const izlenen = execFileSync("git", ["ls-files", "-z"], { cwd: KOK, encoding: "utf8" }).split("\0").filter(Boolean);
const YASAK = [/(^|\/)\.env$/, /(^|\/)\.env\.(?!example$)[^/]+$/, /\.(keystore|jks|p12|pem|key)$/, /^mobil\/anahtar\//, /(^|\/)local\.properties$/, /^data\/cihazlar\.json$/, /^data\/kullanicilar\.json$/, /^data\/\.oturum-anahtari$/];
for (const d of izlenen) if (YASAK.some((r) => r.test(d))) hata(`${d}: gizli/yerel dosya depoya girmemeli`);

// Tüm izlenen JSON dosyaları ayrıştırılabilmeli.
for (const d of izlenen.filter((d) => d.endsWith(".json") || d.endsWith(".webmanifest"))) await oku(d);

// ---------- Eserler ----------
const eserDosyasi = await oku("data/eserler.json");
const eserler = eserDosyasi?.eserler ?? [];
if (!eserler.length) hata("data/eserler.json: eser listesi boş");
const kimlikler = new Set();
for (const e of eserler) {
  if (!e.id) hata(`eser kimliksiz: ${e.ad}`);
  else if (kimlikler.has(e.id)) hata(`eser kimliği tekrar ediyor: ${e.id}`);
  kimlikler.add(e.id);
  const { hatalar: h } = eserDogrula(e);
  for (const m of h) hata(`eser ${e.id}: ${m}`);
}

// ---------- İlişkiler ----------
const iliskiler = (await oku("data/eser-iliskileri.json"))?.iliskiler ?? [];
const iliskiKimlik = new Set();
for (const r of iliskiler) {
  if (iliskiKimlik.has(r.id)) hata(`ilişki kimliği tekrar ediyor: ${r.id}`);
  iliskiKimlik.add(r.id);
  for (const uc of [r.a, r.b]) if (!kimlikler.has(uc)) hata(`ilişki ${r.id}: bilinmeyen eser ${uc}`);
}

// ---------- Dalışlar ----------
const DURUMLAR = new Set(["bekliyor", "onayli", "kaldirildi", "arsiv", "reddedildi"]);
for (const ad of (await readdir(path.join(KOK, "data/dalislar"))).filter((a) => a.endsWith(".json"))) {
  if (!izlenen.includes(`data/dalislar/${ad}`)) continue;
  const d = await oku(`data/dalislar/${ad}`);
  if (!d) continue;
  if (!kimlikler.has(d.eser)) hata(`dalış ${ad}: bilinmeyen eser ${d.eser}`);
  if (!DURUMLAR.has(d.durum)) hata(`dalış ${ad}: geçersiz durum ${d.durum}`);
  if (!Array.isArray(d.kareler) || !d.kareler.length) hata(`dalış ${ad}: kare yok`);
}

// ---------- Modüller (sözleşme: yalnızca @lonca/sdk, en çok 2000 satır, sahne.ayarla) ----------
const moduller = (await oku("data/moduller/index.json")) ?? [];
for (const m of moduller) {
  if (!DURUMLAR.has(m.durum)) hata(`modül ${m.id}: geçersiz durum ${m.durum}`);
  const yol = path.join(KOK, "data/moduller", `${m.id}.js`);
  if (!existsSync(yol)) {
    hata(`modül ${m.id}: data/moduller/${m.id}.js yok`);
    continue;
  }
  const kod = await readFile(yol, "utf8");
  const satir = kod.split("\n").length;
  if (satir > 2000) hata(`modül ${m.id}: ${satir} satır (en çok 2000)`);
  for (const [, kaynak] of kod.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)) if (kaynak !== "@lonca/sdk") hata(`modül ${m.id}: izin verilmeyen import ${kaynak}`);
  if (!kod.includes("sahne.ayarla")) hata(`modül ${m.id}: sahne.ayarla çağrılmıyor`);
}

if (hatalar.length) {
  console.error(`✗ ${hatalar.length} sorun bulundu:\n  ${hatalar.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ Denetim temiz: ${eserler.length} eser, ${iliskiler.length} ilişki, ${moduller.length} modül, ${izlenen.length} izlenen dosya`);
