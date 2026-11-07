// API erişim anahtarı: sunucu ağa (örneğin Docker'da 0.0.0.0:3000) açıldığında /api uçlarını korur.
//
//  - LONCA_API_ANAHTARI boşsa hiçbir şey değişmez (geliştirme modu; açılışta uyarılır).
//  - Doluysa her /api isteği "x-lonca-anahtar" başlığında ya bu ana anahtarı ya da eşleştirmeyle verilmiş
//    bir cihaz anahtarını taşımalıdır. Tarayıcı bir kez /giris sayfasında ana anahtarı girer, kendine ait
//    cihaz anahtarını HttpOnly çerezde tutar.
//  - Eşleştirme: ana anahtarı bilen biri (Mac'te `npm run eslestir`) 6 haneli, 5 dakikalık bir kod alır;
//    telefon POST /api/eslestir { kod, ad } ile kendine özel, iptal edilebilir bir anahtar alır.
//  - Android uygulaması sunucuyu anahtarsız GET /api/merhaba ucuyla yoklar, anahtar istenip istenmediğini oradan öğrenir.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { jsonDosya } from "./depo.js";
import { hizSiniri } from "./guvenlik.js";

const BASLIK = "x-lonca-anahtar";
const CEREZ = "lonca_anahtar";
const KOD_OMRU = 5 * 60_000;
const ozet = (s) => createHash("sha256").update(String(s)).digest("hex");
const ACIK_UCLAR = new Set(["/api/merhaba", "/api/eslestir", "/api/hesap/kayit", "/api/hesap/giris"]);

function cerezOku(req, ad) {
  for (const parca of String(req.headers.cookie ?? "").split(";")) {
    const i = parca.indexOf("=");
    if (i > 0 && parca.slice(0, i).trim() === ad) return decodeURIComponent(parca.slice(i + 1).trim());
  }
  return null;
}
const kacis = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function erisimKur({ anahtar, veri, hesapOturumuGecerli = async () => false }) {
  const gerekli = typeof anahtar === "string" && anahtar.length > 0;
  const anaOzet = gerekli ? Buffer.from(ozet(anahtar), "hex") : null;
  const cihazDosyasi = jsonDosya(path.join(veri, "cihazlar.json"), []);
  const cihazlar = await cihazDosyasi.oku();
  const kodlar = new Map(); // kod -> { bitis, deneme }

  const anaMi = (deger) => {
    if (!gerekli || typeof deger !== "string" || !deger) return false;
    return timingSafeEqual(Buffer.from(ozet(deger), "hex"), anaOzet);
  };
  const cihazBul = (deger) => (typeof deger === "string" && deger ? cihazlar.find((c) => c.ozet === ozet(deger)) : undefined);

  /** "ana" | "cihaz" | null */
  async function kimlik(req) {
    if (!gerekli) return "ana";
    for (const deger of [req.headers[BASLIK], cerezOku(req, CEREZ)]) {
      if (anaMi(deger)) return "ana";
      const c = cihazBul(deger);
      if (c) {
        const simdi = new Date().toISOString().slice(0, 10);
        if (c.son !== simdi) { c.son = simdi; cihazDosyasi.yaz(cihazlar); }
        return "cihaz";
      }
    }
    if (await hesapOturumuGecerli(req)) return "hesap";
    return null;
  }
  const yetkiliMi = async (req) => (await kimlik(req)) !== null;

  function cihazEkle(ad) {
    const deger = `lca_${randomBytes(32).toString("base64url")}`;
    const c = { id: randomBytes(6).toString("hex"), ad: String(ad ?? "cihaz").slice(0, 60) || "cihaz", ozet: ozet(deger), olusturma: new Date().toISOString(), son: null };
    cihazlar.push(c);
    cihazDosyasi.yaz(cihazlar);
    return { cihaz: c, deger };
  }
  const disaVer = ({ ozet: _, ...c }) => c;

  const anaGerekli = async (req, rep) => {
    if (gerekli && (await kimlik(req)) !== "ana") return rep.code(401).send({ hata: "Bu işlem için ana API anahtarı gerekli", anahtarGerekli: true });
  };
  const eslestirmeSiniri = hizSiniri({ adet: 10, pencereMs: 10 * 60_000, mesaj: "Çok fazla eşleştirme denemesi; biraz sonra tekrar dene." });

  function kur(app) {
    // /giris formu düz HTML formuyla gönderilir.
    if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
      app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 4096 },
        (_, govde, bitti) => bitti(null, Object.fromEntries(new URLSearchParams(govde))));
    }
    // /api koruması. /api/ayarlar da korunur: anahtarsız gelen istemci 401 { anahtarGerekli } alır.
    app.addHook("onRequest", async (req, rep) => {
      if (!gerekli) return;
      const yol = req.url.split("?")[0];
      if (yol.startsWith("/api/") && !ACIK_UCLAR.has(yol.replace(/\/+$/, "")) && !(await yetkiliMi(req))) {
        return rep.code(401).send({ hata: "API anahtarı gerekli", anahtarGerekli: true, lonca: true });
      }
      // Tarayıcıda uygulama/Studio açılırken çerez yoksa giriş sayfasına yönlendir.
      if (req.method === "GET" && /^\/(app|studio)\/(index\.html)?$/.test(yol) && !(await yetkiliMi(req))) {
        return rep.redirect(`/giris?devam=${encodeURIComponent(yol)}`);
      }
    });

    app.get("/api/merhaba", async () => ({ lonca: true, anahtarGerekli: gerekli }));

    app.post("/api/eslestir", { preHandler: eslestirmeSiniri }, async (req, rep) => {
      if (!gerekli) return rep.code(400).send({ hata: "Bu sunucu anahtar istemiyor; eşleştirme gerekmez." });
      const kod = String(req.body?.kod ?? "").replace(/\D/g, "");
      const k = kodlar.get(kod);
      if (!k || k.bitis < Date.now()) {
        if (k) kodlar.delete(kod);
        return rep.code(401).send({ hata: "Kod yanlış ya da süresi dolmuş." });
      }
      kodlar.delete(kod); // tek kullanımlık
      const { cihaz, deger } = cihazEkle(req.body?.ad ?? "telefon");
      req.log.info(`Yeni cihaz eşleşti: ${cihaz.ad} (${cihaz.id})`);
      return { anahtar: deger, baslik: BASLIK, cihaz: disaVer(cihaz) };
    });

    app.post("/api/eslestirme-kodu", { preHandler: anaGerekli }, async () => {
      const simdi = Date.now();
      for (const [k, v] of kodlar) if (v.bitis < simdi) kodlar.delete(k);
      let kod;
      do kod = String(randomInt(0, 1_000_000)).padStart(6, "0"); while (kodlar.has(kod));
      kodlar.set(kod, { bitis: simdi + KOD_OMRU });
      return { kod, gecerlilikSn: KOD_OMRU / 1000 };
    });

    app.get("/api/cihazlar", { preHandler: anaGerekli }, async () => cihazlar.map(disaVer));
    app.delete("/api/cihazlar/:id", { preHandler: anaGerekli }, async (req, rep) => {
      const i = cihazlar.findIndex((c) => c.id === req.params.id);
      if (i < 0) return rep.code(404).send({ hata: "cihaz bulunamadı" });
      const [c] = cihazlar.splice(i, 1);
      await cihazDosyasi.yaz(cihazlar);
      return { silindi: disaVer(c) };
    });

    // ---------- Tarayıcı girişi ----------
    const sayfa = (devam, hata = "") => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lonca · Giriş</title><style>
:root{color-scheme:light dark;--z:#fff;--y:#1d1d1f;--c:#d0d0d6;--v:#1f4fbf}
@media (prefers-color-scheme:dark){:root{--z:#141416;--y:#ececf0;--c:#3a3a40;--v:#7aa2ff}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--z);color:var(--y);font:16px/1.5 system-ui,sans-serif}
form{width:min(360px,calc(100vw - 32px));display:grid;gap:12px}
input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--c);background:transparent;color:inherit}
button{background:var(--v);border-color:var(--v);color:#fff;cursor:pointer}.h{color:#d33}</style></head>
<body><form method="post" action="/giris"><h1 style="margin:0;font-size:22px">Lonca sunucusu</h1>
<p style="margin:0">Bu sunucu ağa açık; devam etmek için <code>.env</code> dosyasındaki <code>LONCA_API_ANAHTARI</code> değerini gir.</p>
${hata ? `<p class="h">${kacis(hata)}</p>` : ""}<input type="password" name="anahtar" autocomplete="current-password" placeholder="API anahtarı" autofocus required>
<input type="hidden" name="devam" value="${kacis(devam)}"><button>Giriş</button></form></body></html>`;
    const guvenliDevam = (d) => (typeof d === "string" && /^\/[a-z0-9/_.-]*$/i.test(d) && !d.startsWith("//") ? d : "/app/");

    app.get("/giris", async (req, rep) => rep.type("text/html; charset=utf-8").header("cache-control", "no-store").send(sayfa(guvenliDevam(req.query?.devam))));
    app.post("/giris", { preHandler: eslestirmeSiniri }, async (req, rep) => {
      const devam = guvenliDevam(req.body?.devam);
      if (!gerekli) return rep.redirect(devam);
      if (!anaMi(req.body?.anahtar)) return rep.code(401).type("text/html; charset=utf-8").send(sayfa(devam, "Anahtar yanlış."));
      const { deger } = cihazEkle(`tarayıcı · ${String(req.headers["user-agent"] ?? "").slice(0, 40)}`);
      // Nginx arkasında HTTPS ise (X-Forwarded-Proto) çerez yalnızca şifreli bağlantıda gönderilir.
      const guvenli = req.protocol === "https" ? "; Secure" : "";
      rep.header("set-cookie", `${CEREZ}=${encodeURIComponent(deger)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${guvenli}`);
      return rep.redirect(devam);
    });
    app.get("/cikis", async (req, rep) => {
      const c = cihazBul(cerezOku(req, CEREZ));
      if (c) { cihazlar.splice(cihazlar.indexOf(c), 1); await cihazDosyasi.yaz(cihazlar); }
      rep.header("set-cookie", `${CEREZ}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      return rep.redirect("/giris");
    });
  }

  return { gerekli, kur, yetkiliMi, BASLIK };
}
