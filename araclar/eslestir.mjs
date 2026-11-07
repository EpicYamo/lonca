// Telefonu Lonca sunucusuyla eşleştirmek için 6 haneli, 5 dakikalık tek kullanımlık kod üretir.
//   Docker:  docker compose exec lonca node araclar/eslestir.mjs
//   Yerel:   node araclar/eslestir.mjs
// Telefon bu kodu POST /api/eslestir { kod, ad } ile kendine özel bir cihaz anahtarına çevirir.
// Kayıtlı cihazları görmek için:  node araclar/eslestir.mjs --liste    · silmek için:  --sil <id>
import { networkInterfaces } from "node:os";
import { existsSync } from "node:fs";

try { process.loadEnvFile(); } catch {}
const anahtar = process.env.LONCA_API_ANAHTARI;
const port = Number(process.env.PORT ?? 3000);
const taban = `http://127.0.0.1:${port}`;
if (!anahtar) {
  console.error("LONCA_API_ANAHTARI tanımlı değil: sunucu anahtar istemiyor, eşleştirmeye gerek yok.");
  process.exit(1);
}
const istek = async (yol, method = "GET") => {
  const y = await fetch(taban + yol, { method, headers: { "x-lonca-anahtar": anahtar } });
  const g = await y.json().catch(() => ({}));
  if (!y.ok) throw new Error(g.hata ?? `HTTP ${y.status}`);
  return g;
};

try {
  const [arg, deger] = process.argv.slice(2);
  if (arg === "--liste") {
    const l = await istek("/api/cihazlar");
    if (!l.length) console.log("Kayıtlı cihaz yok.");
    for (const c of l) console.log(`${c.id}  ${c.ad.padEnd(40)}  eklendi ${c.olusturma.slice(0, 10)}  son ${c.son ?? "-"}`);
  } else if (arg === "--sil") {
    const { silindi } = await istek(`/api/cihazlar/${encodeURIComponent(deger ?? "")}`, "DELETE");
    console.log(`Silindi: ${silindi.ad} (${silindi.id})`);
  } else {
    const { kod, gecerlilikSn } = await istek("/api/eslestirme-kodu", "POST");
    // Container içinde makinenin LAN adresi görünmez; compose LONCA_ADRES ile verebilir.
    const konteyner = existsSync("/.dockerenv");
    const adresler = process.env.LONCA_ADRES
      ? [process.env.LONCA_ADRES]
      : konteyner ? [] : Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => `${a.address}:${port}`);
    console.log(`\n  Eşleştirme kodu:  ${kod.slice(0, 3)} ${kod.slice(3)}   (${gecerlilikSn / 60} dakika geçerli, tek kullanımlık)\n`);
    if (adresler.length) console.log(`  Sunucu adresi:    ${adresler.join("  ·  ")}\n`);
    else if (konteyner) console.log("  Sunucu adresi:    Mac'te `ipconfig getifaddr en0` çıktısı, port 3000\n");
    console.log("  Telefonda Lonca → Bağlantı → kodu gir.\n");
  }
} catch (h) {
  console.error(`Sunucuya ulaşılamadı ya da istek reddedildi (${taban}): ${h.message}`);
  process.exit(1);
}
