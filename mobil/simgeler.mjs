// Android simge ve açılış görsellerinin kaynaklarını Lonca logosundan üretir (mobil/kaynak),
// ardından @capacitor/assets bunlardan bütün Android yoğunluklarını oluşturur.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loncaLogo } from "../public/ortak/logo.js";

const DIZIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "kaynak");
const logo = (boyut) => Buffer.from(loncaLogo({ boyut }).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
async function yap(ad, kenar, logoBoyu, zemin) {
  const g = await sharp(logo(logoBoyu)).png().toBuffer();
  await sharp({ create: { width: kenar, height: kenar, channels: 4, background: zemin } })
    .composite([{ input: g, gravity: "center" }]).png().toFile(path.join(DIZIN, ad));
}
const BEYAZ = { r: 255, g: 255, b: 255, alpha: 1 }, SAYDAM = { r: 0, g: 0, b: 0, alpha: 0 }, GECE = { r: 17, g: 19, b: 24, alpha: 1 };
await yap("icon-only.png", 1024, 680, BEYAZ);
await yap("icon-foreground.png", 1024, 560, SAYDAM);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BEYAZ } }).png().toFile(path.join(DIZIN, "icon-background.png"));
await yap("splash.png", 2732, 520, BEYAZ);
await yap("splash-dark.png", 2732, 520, GECE);
console.log("mobil/kaynak: simge ve açılış görselleri hazır");
