import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cikti = path.join(kok, "dist", "sunum-netlify");
const genel = path.join(kok, "public");

await fs.rm(cikti, { recursive: true, force: true });
await fs.mkdir(cikti, { recursive: true });

async function kopyala(kaynak, hedef = kaynak) {
  const from = path.join(genel, kaynak);
  const to = path.join(cikti, hedef);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.cp(from, to, { recursive: true });
}

// The presentation expects to live at the site root, while the Lonca server
// normally serves it under /sunum/.
await kopyala("sunum", "sunum");
await fs.copyFile(path.join(genel, "sunum", "index.html"), path.join(cikti, "index.html"));
await kopyala("vendor-yerel/gsap");
await kopyala("simgeler/lonca-192.png");

// Copy only the fonts and heritage photos referenced by the presentation.
const metinler = await Promise.all(
  ["index.html", "sunum.css", "sunum.js", "sahneler.js", "uc.js", "veri.js"].map((ad) =>
    fs.readFile(path.join(genel, "sunum", ad), "utf8"),
  ),
);
const kaynakMetni = metinler.join("\n");
const gerekenler = new Set();
for (const eslesme of kaynakMetni.matchAll(/\/(?:medya\/eserler|ortak\/fontlar)\/[\w.-]+\.(?:jpg|woff2)/g)) {
  gerekenler.add(eslesme[0].replace(/^\//, ""));
}
for (const [, kaynak] of kaynakMetni.matchAll(/\/(ortak\/[\w./-]+\.js)/g)) gerekenler.add(kaynak);

// The 3D photo wall builds its URLs from this list instead of literal paths.
const duvar = metinler.find((metin) => metin.includes("const FOTOLAR"))?.match(/const FOTOLAR\s*=\s*\[([\s\S]*?)\];/);
if (!duvar) throw new Error("Sunumun 3B fotoğraf listesi (FOTOLAR) bulunamadı.");
for (const [, ad] of duvar[1].matchAll(/["']([^"']+)["']/g)) {
  gerekenler.add(`medya/eserler/${ad}.jpg`);
}

for (const kaynak of gerekenler) await kopyala(kaynak);

// The dive slide uses frames assembled at runtime from this directory.
await kopyala("medya/dalis/bursa-ulucami");

// Three.js is a runtime dependency and is copied to the URL used by the import map.
const three = path.join(kok, "node_modules", "three", "build", "three.module.min.js");
const threeCikti = path.join(cikti, "vendor", "three", "build", "three.module.min.js");
await fs.mkdir(path.dirname(threeCikti), { recursive: true });
await fs.copyFile(three, threeCikti);

console.log(`Sunum statik sitesi hazır: ${path.relative(kok, cikti)}`);
console.log(`Sunum dosyalarının yanında ${gerekenler.size} font/fotoğraf varlığı kopyalandı.`);
