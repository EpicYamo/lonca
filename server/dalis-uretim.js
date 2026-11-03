// Dalış karesi üretimi: gerçek fotoğraf hazırlama, yapay zekâ ile kare üretme/düzenleme, uydu karesi dikme.
// Hem komut satırı aracı (araclar/dalis-uret.mjs) hem dalış kalfası (server/dalis-kalfasi.js) bunu kullanır.
//
// OpenAI uyumlu bir uç nokta gerekir (.env):
//   DALIS_API_URL (yoksa USTAGPT_BASE_URL), DALIS_API_ANAHTARI (yoksa USTAGPT_API_KEY)
//   DALIS_MODELLER="sohbet:gemini-3.1-flash-image,nano-banana-2"  görsel üretim (sırayla denenir;
//     "sohbet:" önekliler /chat/completions ile, ötekiler /images/edits ile çağrılır)
// Dış araçlar: ffmpeg, python3 + Pillow.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function dalisAyarlari(ortam = process.env) {
  return {
    api: (ortam.DALIS_API_URL || ortam.USTAGPT_BASE_URL || "").replace(/\/$/, ""),
    anahtar: ortam.DALIS_API_ANAHTARI || ortam.USTAGPT_API_KEY || "",
    modeller: (ortam.DALIS_MODELLER || "sohbet:gemini-3.1-flash-image,nano-banana-2").split(",").map((s) => s.trim()).filter(Boolean),
    metinModelleri: (ortam.DALIS_METIN_MODELLERI || "gemini-3.5-flash,gpt-6.1-sol").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export const dunyaPx = (lat, lng, z) => {
  const n = 256 * 2 ** z, f = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2) * n];
};

const KARO = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const SON_ISLEM = "unsharp=5:5:0.55:5:5:0.0";

const PY_DIK = `
import sys, json
from PIL import Image
d = json.load(open(sys.argv[1]))
im = Image.new("RGB", (d["en"], d["boy"]), (12, 16, 26))
for k in d["karolar"]:
    try: im.paste(Image.open(k["yol"]).convert("RGB"), (k["x"], k["y"]))
    except Exception: pass
im.save(d["cikti"], quality=92)
`;
// Gerçek fotoğrafı tam genişlikte yerleştirir, boşlukları düz griyle bırakır (bulanık kopya yapıyı tekrar çizdiriyordu).
const PY_YER = `
import sys
from PIL import Image
src, out, W, H, yer = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
im = Image.open(src).convert("RGB")
h = round(im.height * W / im.width)
foto = im.resize((W, h), Image.LANCZOS)
zemin = Image.new("RGB", (W, H), (128, 128, 128))
y = round((H - h) * yer)
zemin.paste(foto, (0, y))
zemin.save(out)
print(y, h)
`;
// Yapay zekânın doldurduğu tuvale gerçek pikselleri yumuşak kenarla geri yapıştırır (hizalanmışsa).
const PY_YAPISTIR = `
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageStat
ai, src, out, W, H, y, h = sys.argv[1], sys.argv[2], sys.argv[3], *map(int, sys.argv[4:8])
taban = Image.open(ai).convert("RGB").resize((W, H), Image.LANCZOS)
foto = Image.open(src).convert("RGB").resize((W, h), Image.LANCZOS)
f = max(8, h // 6)
ust, alt = (f if y > 0 else -2 * f), (f if y + h < H else -2 * f)
maske = Image.new("L", (W, h), 0)
ImageDraw.Draw(maske).rectangle([-2 * f, ust, W + 2 * f, h - alt], fill=255)
maske = maske.filter(ImageFilter.GaussianBlur(f / 2.5))
kucuk = lambda im: im.convert("L").resize((96, max(8, round(96 * im.height / im.width))), Image.BILINEAR)
fark = sum(ImageStat.Stat(ImageChops.difference(kucuk(taban.crop((0, y, W, y + h))), kucuk(foto))).mean)
if fark <= float(sys.argv[8]):
    taban.paste(foto, (0, y), maske)
    print("yapistirildi", round(fark, 1))
else:
    print("yz", round(fark, 1))
taban.save(out, quality=95)
`;

/**
 * Bir eserin dalış karelerini üreten nesne.
 * kok: proje kökü; eser: çıktı klasörü adı (public/medya/dalis/<eser>); onek: her istemin başına eklenen tarz cümlesi.
 */
export function dalisUretici({ kok, eser, onek = "", boyut = [1024, 1536], uyumEsigi = 14, gunluk = console.log, ortam = process.env }) {
  const ayar = dalisAyarlari(ortam);
  const [EN, BOY] = boyut;
  const ORAN = EN / BOY;
  const ORAN_ADI = Math.abs(ORAN - 2 / 3) < 0.01 ? "2:3" : Math.abs(ORAN - 3 / 2) < 0.01 ? "3:2" : Math.abs(ORAN - 9 / 16) < 0.01 ? "9:16" : "1:1";
  const CIKTI = join(kok, "public/medya/dalis", eser);
  mkdirSync(CIKTI, { recursive: true });
  const GECICI = join(tmpdir(), `dalis-${process.pid}-${Date.now()}`);
  mkdirSync(GECICI, { recursive: true });
  const ONEK = onek ? `${onek.trim()} ` : "";

  const yerel = (medya) => join(kok, "public", medya.replace(/^\//, ""));
  const kareYolu = (ad) => join(CIKTI, `${ad}.jpg`);

  function normallestir(girdi, cikti) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", girdi,
      "-vf", `scale=${EN}:${BOY}:force_original_aspect_ratio=increase:flags=lanczos,crop=${EN}:${BOY},${SON_ISLEM}`, "-q:v", "2", cikti]);
  }
  function kirp(ad, [x, y, g]) {
    const cikti = join(GECICI, `kirp-${ad}-${Math.round(x * 1000)}-${Math.round(y * 1000)}-${Math.round(g * 1000)}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", kareYolu(ad), "-vf", `crop=iw*${g}:ih*${g}:iw*${x}:ih*${y},scale=${EN}:${BOY}:flags=lanczos`, cikti]);
    return cikti;
  }
  const genislik = (yol) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", yol]).toString().trim());

  async function indir(url) {
    const g = await fetch(url, { headers: { Authorization: `Bearer ${ayar.anahtar}`, "User-Agent": "lonca-dalis/1" } });
    if (!g.ok) throw new Error(`görsel indirilemedi: ${g.status}`);
    return Buffer.from(await g.arrayBuffer());
  }
  async function sohbetIstegi(model, istem, refler) {
    const icerik = [{ type: "text", text: istem }];
    for (const r of refler) icerik.push({ type: "image_url", image_url: { url: `data:${r.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${readFileSync(r).toString("base64")}` } });
    const yanit = await fetch(`${ayar.api}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${ayar.anahtar}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: icerik }], modalities: ["image", "text"], image_config: { aspect_ratio: ORAN_ADI, image_size: "2K" } }),
      signal: AbortSignal.timeout(150_000),
    });
    const metin = await yanit.text();
    if (!yanit.ok) throw new Error(`${yanit.status} ${metin.slice(0, 160)}`);
    const url = JSON.parse(metin).choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error(`görsel yok: ${metin.replace(/[A-Za-z0-9+/=]{100,}/g, "…").slice(0, 160)}`);
    return url.startsWith("data:") ? Buffer.from(url.split(",", 2)[1], "base64") : indir(url);
  }
  async function gorselIstegi(model, istem, refler) {
    const form = new FormData();
    form.append("model", model); form.append("prompt", istem); form.append("n", "1");
    form.append("size", ORAN < 1 ? "1024x1536" : "1536x1024");
    for (const r of refler) {
      const ad = r.split("/").pop();
      form.append(refler.length > 1 ? "image[]" : "image", new Blob([readFileSync(r)], { type: ad.endsWith(".png") ? "image/png" : "image/jpeg" }), ad);
    }
    const yanit = await fetch(`${ayar.api}/images/${refler.length ? "edits" : "generations"}`, {
      method: "POST", headers: { Authorization: `Bearer ${ayar.anahtar}` }, body: form, signal: AbortSignal.timeout(150_000),
    });
    const metin = await yanit.text();
    if (!yanit.ok) throw new Error(`${yanit.status} ${metin.slice(0, 160)}`);
    const veri = JSON.parse(metin).data?.[0];
    if (veri?.b64_json) return Buffer.from(veri.b64_json, "base64");
    if (veri?.url) return indir(veri.url);
    throw new Error(`beklenmeyen yanıt: ${metin.slice(0, 160)}`);
  }
  async function yapayZeka(ad, istem, refler, tercih) {
    const modeller = tercih ? [tercih, ...ayar.modeller.filter((m) => m !== tercih)] : ayar.modeller;
    for (const model of modeller) {
      for (let deneme = 1; deneme <= 2; deneme++) {
        try {
          const t0 = Date.now();
          const bayt = model.startsWith("sohbet:") ? await sohbetIstegi(model.slice(7), istem, refler) : await gorselIstegi(model, istem, refler);
          const ham = join(GECICI, `${ad.replace(/\W/g, "_")}-${Date.now()}.ham`);
          writeFileSync(ham, bayt);
          gunluk(`    ${ad}: ${model}  ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
          return { ham, model };
        } catch (h) {
          gunluk(`    · ${ad}  ${model} (deneme ${deneme}): ${h.name === "TimeoutError" ? "zaman aşımı" : h.message}`);
          await new Promise((r) => setTimeout(r, 4000 * deneme)); // geçici ağ/sağlayıcı hatalarında kısa bekleme
        }
      }
    }
    throw new Error(`${ad}: hiçbir model üretemedi`);
  }

  /** Gerçek fotoğraf karesi. kare: { ad, kaynak, genislet?, netlestir?, yer?, genisletIstem? } → { model, yz } */
  async function gercekKare(kare) {
    let kaynak = yerel(kare.kaynak), model = null;
    if (kare.netlestir) try {
      const r = await yapayZeka(`${kare.ad}/net`, "Restore this exact photograph at high resolution: identical composition, framing, content and colours; recover fine architectural detail, remove JPEG artifacts and noise. Do not add, remove or move anything. Return only the image.", [kaynak], "sohbet:gemini-3.1-flash-image");
      const [w, h] = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", kaynak]).toString().trim().split(",").map(Number);
      const net = join(GECICI, `${kare.ad}-net.png`), nh = Math.round((EN * h) / w);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", r.ham, "-vf", `scale=${EN}:${nh}:force_original_aspect_ratio=increase:flags=lanczos,crop=${EN}:${nh}`, net]);
      kaynak = net; model = r.model;
    } catch (h) {
      gunluk(`    ${kare.ad}: netleştirilemedi, fotoğrafın kendisi kullanılıyor`);
    }
    if (!kare.genislet) { normallestir(kaynak, kareYolu(kare.ad)); return { model, yz: false }; }
    const tuval = join(GECICI, `${kare.ad}-tuval.png`);
    const yer = { ust: 0, orta: 0.5, alt: 1 }[kare.yer ?? "orta"] ?? 0.5;
    const [y, h] = execFileSync("python3", ["-c", PY_YER, kaynak, tuval, String(EN), String(BOY), String(yer)], { cwd: GECICI }).toString().trim().split(" ").map(Number);
    const istem = `${ONEK}This tall portrait canvas has a real photograph in one horizontal band (from y=${Math.round((y / BOY) * 100)}% to y=${Math.round(((y + h) / BOY) * 100)}% of the height); the flat grey areas are empty. Outpaint: fill ONLY the flat grey areas so the whole frame is one seamless, realistic photo: continue the sky, hills, buildings, ground, paving and foliage with correct perspective, lighting and colour. Keep the photograph band exactly as it is and match its colours, haze and sky gradient seamlessly at the borders; never repeat or duplicate the main building. ${kare.genisletIstem ?? ""}`;
    const r = await yapayZeka(kare.ad, istem, [tuval], "sohbet:gemini-3.1-flash-image");
    const ara = join(GECICI, `${kare.ad}-birlesik.jpg`);
    const [sonuc, fark] = execFileSync("python3", ["-c", PY_YAPISTIR, r.ham, kaynak, ara, String(EN), String(BOY), String(y), String(h), String(uyumEsigi)], { cwd: GECICI }).toString().trim().split(" ");
    gunluk(`    ${kare.ad}: gerçek band ${sonuc === "yapistirildi" ? "geri yapıştırıldı" : "hizalanmadı, YZ görüntüsü kullanıldı"} (fark ${fark})`);
    normallestir(ara, kareYolu(kare.ad));
    return { model: model ?? r.model, yz: sonuc !== "yapistirildi" };
  }

  /** Yapay zekâ karesi. kare: { ad, uret: { istem, ref: ["/medya/..." | { kare, kirp }], model? } } */
  async function uretilenKare(kare) {
    const refler = (kare.uret.ref ?? []).map((r) => (typeof r === "string" ? yerel(r) : kirp(r.kare, r.kirp)));
    const r = await yapayZeka(kare.ad, ONEK + kare.uret.istem, refler, kare.uret.model);
    normallestir(r.ham, kareYolu(kare.ad));
    return { model: r.model, yz: false };
  }

  /** Uydu karesi (Esri World Imagery). kare: { ad, uydu: { lat, lng, z } } */
  async function uyduKare(kare) {
    const { lat, lng, z } = kare.uydu;
    const [cx, cy] = dunyaPx(lat, lng, z);
    const x0 = cx - EN / 2, y0 = cy - BOY / 2, karolar = [];
    for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + BOY - 1) / 256); ty++)
      for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + EN - 1) / 256); tx++)
        karolar.push({ tx, ty, x: Math.round(tx * 256 - x0), y: Math.round(ty * 256 - y0), yol: join(GECICI, `karo-${z}-${tx}-${ty}.jpg`) });
    for (let i = 0; i < karolar.length; i += 8) {
      await Promise.all(karolar.slice(i, i + 8).map(async (k) => {
        const y = await fetch(`${KARO}/${z}/${k.ty}/${k.tx}`, { headers: { "User-Agent": "lonca-dalis/1" } });
        if (y.ok) writeFileSync(k.yol, Buffer.from(await y.arrayBuffer()));
      }));
    }
    const is = join(GECICI, `${kare.ad}-karolar.json`);
    writeFileSync(is, JSON.stringify({ en: EN, boy: BOY, cikti: kareYolu(kare.ad), karolar }));
    execFileSync("python3", ["-c", PY_DIK, is], { cwd: GECICI });
    gunluk(`    ${kare.ad}: uydu z${z}, ${karolar.length} karo`);
    return { model: null, yz: false };
  }

  /** Uydu karesi a'nın içinde uydu karesi b'nin kapladığı bölge [x, y, g]. */
  function uyduPortal(a, b) {
    const s = 2 ** (a.z - b.z);
    const [ax, ay] = dunyaPx(a.lat, a.lng, a.z), [bx, by] = dunyaPx(b.lat, b.lng, a.z);
    const r = (v) => Math.round(v * 10000) / 10000;
    return [r((bx - (EN * s) / 2 - (ax - EN / 2)) / EN), r((by - (BOY * s) / 2 - (ay - BOY / 2)) / BOY), r(s)];
  }

  return {
    EN, BOY, CIKTI, kareYolu, yerel, genislik, gercekKare, uretilenKare, uyduKare, uyduPortal,
    temizle: () => rmSync(GECICI, { recursive: true, force: true }),
  };
}

/** OpenAI uyumlu sohbet: metin (ve isteğe bağlı görseller) gönderir, yanıt metnini döndürür. Modeller sırayla denenir. */
export async function dalisSohbet({ sistem, metin, gorseller = [], ortam = process.env, maks = 4000, zamanAsimi = 120_000, modeller = null }) {
  const ayar = dalisAyarlari(ortam);
  if (!ayar.api || !ayar.anahtar) throw new Error("Dalış kalfası için DALIS_API_URL ve DALIS_API_ANAHTARI (.env) gerekli");
  const icerik = [{ type: "text", text: metin }, ...gorseller.map((yol) => ({
    type: "image_url", image_url: { url: `data:image/jpeg;base64,${readFileSync(yol).toString("base64")}` },
  }))];
  let son;
  for (const model of modeller ?? ayar.metinModelleri) {
    try {
      const y = await fetch(`${ayar.api}/chat/completions`, {
        method: "POST", headers: { Authorization: `Bearer ${ayar.anahtar}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maks, messages: [...(sistem ? [{ role: "system", content: sistem }] : []), { role: "user", content: icerik }] }),
        signal: AbortSignal.timeout(zamanAsimi),
      });
      const govde = await y.text();
      if (!y.ok) throw new Error(`${model}: ${y.status} ${govde.slice(0, 160)}`);
      const yanit = JSON.parse(govde).choices?.[0]?.message?.content;
      if (!yanit) throw new Error(`${model}: boş yanıt`);
      return { metin: yanit, model };
    } catch (h) { son = new Error(`${model}: ${h.name === "TimeoutError" ? "zaman aşımı" : h.message}`); }
  }
  throw son;
}
