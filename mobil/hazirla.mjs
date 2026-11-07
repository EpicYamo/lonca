// Android uygulamasının web katmanını (mobil/www) hazırlar.
//
// Lonca uygulaması (public/app) olduğu gibi pakete girer; yanına:
//   - çalışması için gereken ortak dosyalar, SDK, Leaflet ve three.js,
//   - yayındaki dalışların görselleri ve eser fotoğrafları,
//   - sunucunun gerçek API yanıtlarından alınmış bir veri anlık görüntüsü (çevrimdışı kullanım için),
//   - telefonun aynı ağdaki Lonca sunucusunu bulması için aday adresler
// eklenir. Anlık görüntü, sunucu kodu `inject` ile çağrılarak üretilir; böylece veri biçimi değişse de
// uygulamanın gördüğü yanıt sunucununkiyle birebir aynı kalır.
//
// Kullanım: node mobil/hazirla.mjs [--sunucu http://192.168.1.20:3000 ...] [--port 3000] [--anahtar API_ANAHTARI]
// (anahtar verilmezse .env içindeki LONCA_API_ANAHTARI kullanılır)
import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WWW = path.join(KOK, "mobil", "www");
const arg = process.argv.slice(2);
const sunucular = [];
let port = 3000;
let anahtar = "";
for (let i = 0; i < arg.length; i++) {
  if (arg[i] === "--sunucu" && arg[i + 1]) sunucular.push(arg[++i].replace(/\/+$/, ""));
  else if (arg[i] === "--port" && arg[i + 1]) port = Number(arg[++i]) || 3000;
  else if (arg[i] === "--anahtar" && arg[i + 1]) anahtar = arg[++i];
}

try { process.loadEnvFile(path.join(KOK, ".env")); } catch {}
anahtar ||= process.env.LONCA_API_ANAHTARI ?? "";

const kopyala = (kaynak, hedef, filtre) => cp(path.join(KOK, kaynak), path.join(WWW, hedef), { recursive: true, filter: filtre });
async function boyut(d) {
  let t = 0;
  for (const g of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, g.name);
    t += g.isDirectory() ? await boyut(p) : (await stat(p)).size;
  }
  return t;
}

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

// ---------- Statik dosyalar (sunucudaki yollarla birebir) ----------
await kopyala("public/app", "app");
await kopyala("public/ortak", "ortak");
await kopyala("public/simgeler", "simgeler");
await kopyala("public/mobil", "mobil");
if (existsSync(path.join(KOK, "public/vendor-yerel"))) await kopyala("public/vendor-yerel", "vendor-yerel");
await mkdir(path.join(WWW, "sdk"), { recursive: true });
await cp(path.join(KOK, "sdk/lonca-sdk.js"), path.join(WWW, "sdk/lonca-sdk.js"));
await kopyala("node_modules/leaflet/dist", "vendor/leaflet");
const THREE = "node_modules/three";
for (const ad of ["three.module.js", "three.core.js"]) {
  if (existsSync(path.join(KOK, THREE, "build", ad))) await cp(path.join(KOK, THREE, "build", ad), path.join(WWW, "vendor/three/build", ad));
}
// examples/jsm: kütüphanelerden yalnızca Draco (GLTF sıkıştırma) gerekiyor.
await kopyala(`${THREE}/examples/jsm`, "vendor/three/examples/jsm", (k) => {
  const g = path.relative(path.join(KOK, THREE, "examples/jsm"), k).split(path.sep);
  return g[0] !== "libs" || g.length === 1 || g[1] === "draco";
});
// Çevrimdışı API, sunucunun doğrulama kurallarını aynen kullanır (bağımlılıksız, saf modül).
await cp(path.join(KOK, "server/dogrulama.js"), path.join(WWW, "mobil/dogrulama.js"));

// ---------- Veri anlık görüntüsü: sunucunun kendi yanıtları ----------
const { uygulamaKur } = await import(path.join(KOK, "server/uygulama.js"));
const { app } = await uygulamaKur({ kok: KOK, gunluk: false });
await app.ready();
const al = async (url, metin = false) => {
  const y = await app.inject({ method: "GET", url });
  if (y.statusCode !== 200) throw new Error(`${url} → ${y.statusCode}`);
  return metin ? y.body : y.json();
};
const ayarlar = await al("/api/ayarlar");
const eserler = await al("/api/eserler");
const iliskiler = await al("/api/eser-iliskileri");
const moduller = await al("/api/moduller");
const dalislar = await al("/api/dalislar");
await mkdir(path.join(WWW, "mobil/anlik/moduller"), { recursive: true });
for (const m of moduller) await writeFile(path.join(WWW, "mobil/anlik/moduller", `${m.id}.js`), await al(`/api/moduller/${encodeURIComponent(m.id)}/kod`, true));
await app.close();
const olusturma = new Date().toISOString();
await writeFile(path.join(WWW, "mobil/anlik/veri.json"), JSON.stringify({ olusturma, ayarlar, eserler, iliskiler, moduller, dalislar }));

// ---------- Medya: eser fotoğrafları + yayındaki dalışlar ----------
await kopyala("public/medya/eserler", "medya/eserler");
for (const d of dalislar) {
  const kaynak = path.join("public/medya/dalis", d.eser);
  if (existsSync(path.join(KOK, kaynak))) await kopyala(kaynak, path.join("medya/dalis", d.eser));
}

// ---------- Giriş sayfası ----------
// Capacitor kökteki index.html'i açar; /app/ ile aynı sayfa (bütün yollar mutlak olduğundan değişmeden çalışır).
const yapilandirma = { surum: olusturma, sunucular, port, anlik: olusturma, ...(anahtar ? { anahtar } : {}) };
let html = await readFile(path.join(KOK, "public/app/index.html"), "utf8");
const kopruEtiketi = '<script src="/mobil/kopru.js"></script>';
const satir = `<script>window.LONCA_MOBIL=${JSON.stringify(yapilandirma)};</script>`;
html = html.includes(kopruEtiketi) ? html.replace(kopruEtiketi, `${satir}\n  ${kopruEtiketi}`)
  : html.replace("</head>", `  ${satir}\n  ${kopruEtiketi}\n  <link rel="stylesheet" href="/mobil/mobil.css">\n</head>`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, "");
await writeFile(path.join(WWW, "index.html"), html);
await writeFile(path.join(WWW, "app/index.html"), html);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log(`mobil/www hazır: ${eserler.length} eser, ${moduller.length} modül, ${dalislar.length} dalış, toplam ${mb(await boyut(WWW))}`);
console.log(sunucular.length ? `Aranacak sunucular: ${sunucular.join(", ")}` : "Gömülü sunucu adresi yok: uygulama ağı tarayacak.");
