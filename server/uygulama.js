import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
import { kalfaHazirla } from "./kalfa.js";
import { AYAR_DOSYASI, etkinSecim, modelKatalogu } from "./kalfa-ayarlari.js";
import { dalisKalfasiKur } from "./dalis-kalfasi.js";
import { modelTaramasiKur, saglikEkle } from "./model-tarama.js";
import { jsonDosya } from "./depo.js";
import { yetkiKur, hizSiniri, oturumAraclari } from "./guvenlik.js";
import { hesaplarKur } from "./hesap.js";
import { googleGirisKur } from "./google-giris.js";
import { epostaKur } from "./eposta.js";
import { atolyeKur } from "./atolye.js";
import { erisimKur } from "./erisim.js";
import { modulGorunurlukDogrula, paylasimAnahtariGecerli, davetKoduUret, davetKoduCoz, eserDogrula, eserIstegiDogrula, kimlikUret, tamlikSuzgeci, tamlik, TEMEL_ALANLAR, TUM_ALANLAR, alanVar, kalfaAyarDogrula, kalfaTaramaDogrula, oneriEkiDogrula, hesapGirdisiDogrula, sifreDegisimiDogrula, sifreSifirlamaDogrula, epostaGecerli, ROLLER, atolyeTaslakDogrula, atolyeIstekDogrula, izinKarariDogrula, atolyeKimligiGecerli } from "./dogrulama.js";
import { eserAra, modulSurumu } from "../public/ortak/arama.js";
import { modulDogrulamasi } from "./dis-kaynak.js";

const MAKS_KOD = 150_000; 
const MAKS_FOTO = 6 * 1024 * 1024;
const RENKLER = ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"];
const IKONLAR = ["cami", "han", "hamam", "medrese", "cesme", "turbe", "genel"];
export const KATEGORILER = ["rehber", "oyun", "gezi", "ogren"];
// "ozel": ustanın yalnızca paylaşım bağlantısıyla açılan modülü; uygulamada listelenmez, onay kuyruğuna girmez.
export const MODUL_DURUMLARI = ["bekliyor", "onayli", "ozel", "kaldirildi", "arsiv", "reddedildi"];
const kimlikGecerli = (id) => typeof id === "string" && /^[a-z0-9-]{1,64}$/.test(id);

function mesafe(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 */
export async function uygulamaKur({ kok, veri = path.join(kok, "data"), ortam = process.env, gunluk = true, googleFetch, epostaGonderici, disFetch }) {
  const MODUL_DIZINI = path.join(veri, "moduller");
  const YUKLENEN = path.join(veri, "yuklenen");
  const eserDosyasi = jsonDosya(path.join(veri, "eserler.json"), { eserler: [] });
  const iliskiDosyasi = jsonDosya(path.join(veri, "eser-iliskileri.json"), { iliskiler: [] });
  const modulDosyasi = jsonDosya(path.join(MODUL_DIZINI, "index.json"), []);
  const oneriDosyasi = jsonDosya(path.join(veri, "eser-oneriler.json"), []);
  const gecmisDosyasi = jsonDosya(path.join(veri, "eser-gecmisi.json"), []);
  const ANLIK_DIZINI = path.join(veri, "gecmis");

  // Studio'da seçilen kalfa modelleri (çalışma verisi); kalfalar ayarı her istekte buradan okur.
  const kalfaAyarDosyasi = jsonDosya(path.join(veri, "kalfa-ayarlari.json"), {});
  ortam = { ...ortam, [AYAR_DOSYASI]: kalfaAyarDosyasi.yol };
  const modelKatalogum = modelKatalogu({ ortam });
  const eserVerisi = await eserDosyasi.oku();
  const eserler = eserVerisi.eserler;
  const iliskiVerisi = await iliskiDosyasi.oku();
  const iliskiler = Array.isArray(iliskiVerisi.iliskiler) ? iliskiVerisi.iliskiler : [];
  const eserleriKaydet = () => eserDosyasi.yaz({ ...eserVerisi, eserler });

  // Admin kalfası izinle bilgi bankasına doğrulanmamış (Vikipedi kaynaklı) kayıt ekleyebilir; ekleme geçmişe de yazılır.
  async function kalfaEserEkle(veri) {
    const r = eserUygula({ tur: "yeni" }, veri);
    if (r.hatalar) return { hatalar: r.hatalar };
    await eserleriKaydet();
    await gecmiseYaz({ islem: "ekle", eserId: r.eser.id, ad: r.eser.ad, neden: "Kalfa, admin izniyle (Vikipedi)", once: null, sonra: kopya(r.eser) });
    return { eser: r.eser };
  }
  const kalfa = kalfaHazirla({ kok, eserler, iliskiler, ortam, eserEkle: kalfaEserEkle, ...(disFetch && { disFetch }) });
  // Kalfa modellerinin sağlık taraması (çalışma verisi; Studio'daki "Modelleri test et").
  const modelTaramasi = modelTaramasiKur({ kalfa, dosya: jsonDosya(path.join(veri, "kalfa-model-durumu.json"), { sonuclar: {} }) });
  const DALIS_DIZINI = path.join(veri, "dalislar");
  const dalisKalfasi = dalisKalfasiKur({ kok, eserler, iliskiler, dalisDizini: DALIS_DIZINI, ortam });
  const yetki = yetkiKur(ortam.YONETICI_SIFRE);
  const { yoneticiMi } = yetki;
  const kalfaSiniri = hizSiniri({ adet: Number(ortam.KALFA_SINIR ?? 30), pencereMs: 10 * 60_000, mesaj: "Kalfa şu an çok meşgul; birkaç dakika sonra tekrar dene." });
  const oneriSiniri = hizSiniri({ adet: 20, pencereMs: 10 * 60_000 });
  const hesapSiniri = hizSiniri({ adet: Number(ortam.HESAP_SINIR ?? 20), pencereMs: 10 * 60_000, mesaj: "Çok fazla hesap isteği; biraz sonra tekrar dene." });

  // ---------- Hesaplar ve roller (vatandaş / usta / editör) ----------
  // Oturum anahtarı .env'deki OTURUM_ANAHTARI'ndan, yoksa ilk açılışta üretilip data/.oturum-anahtari'na yazılır (gitignore'da).
  const OTURUM_DOSYASI = path.join(veri, ".oturum-anahtari");
  async function oturumAnahtariGetir() {
    if (ortam.OTURUM_ANAHTARI) return ortam.OTURUM_ANAHTARI;
    if (existsSync(OTURUM_DOSYASI)) return (await readFile(OTURUM_DOSYASI, "utf8")).trim();
    const yeni = randomBytes(32).toString("hex");
    await mkdir(veri, { recursive: true });
    await writeFile(OTURUM_DOSYASI, yeni, { mode: 0o600 });
    return yeni;
  }
  const oturum = oturumAraclari(await oturumAnahtariGetir());
  const hesaplar = hesaplarKur(path.join(veri, "kullanicilar.json"));
  // Ekibin hazır editör hesapları: ILK_SIFRE doluysa eksik olanlar açılır; ilk girişte şifre değiştirilmeden yetki yok.
  await hesaplar.tohumla(String(ortam.ILK_KULLANICILAR ?? "arda,ibrahim,sevilay").split(","), ortam.ILK_SIFRE);
  // Jeton yalnızca hesabı gösterir; rol her istekte kayıttan okunur (rolü düşürülen ya da silinen hesap yetkisini hemen kaybeder).
  async function oturumSahibi(req) {
    const baslik = req.headers.authorization ?? "";
    const yuk = baslik.startsWith("Bearer ") ? oturum.jetonCoz(baslik.slice(7)) : null;
    return yuk ? hesaplar.idIle(yuk.id) : null;
  }
  // Şifresini henüz değiştirmemiş hesap giriş yapmış sayılır ama hiçbir yetki almaz.
  const yetkiliHesap = async (req) => { const h = await oturumSahibi(req); return h && !h.sifreDegismeli ? h : null; };
  const editorMi = async (req) => yoneticiMi(req) || (await yetkiliHesap(req))?.rol === "editor";
  const ustaMi = async (req) => yoneticiMi(req) || ["usta", "editor"].includes((await yetkiliHesap(req))?.rol);
  // Onay, yayın, içerik düzenleme, model ayarları: yönetici şifresi ya da editör (admin) hesabı.
  // Girişsiz istek 401 alır; giriş yapmış usta 403 (yetki yok, yeniden giriş sorulmaz).
  const editorGerekli = async (req, rep) => {
    if (await editorMi(req)) return;
    if (await ustaMi(req)) return rep.code(403).send({ hata: "Bu bölüm yalnızca admin içindir" });
    return rep.code(401).send({ hata: "Bu işlem için editör hesabı ya da yönetici şifresi gerekli" });
  };
  // Atölye (kalfa + modül gönderme), kendi modüllerini görme ve eserleri salt okunur görme: usta ya da editör hesabı.
  // Onay kuyruğu, değişiklik geçmişi ve dalış yönetimi yalnızca admin'e açıktır (editorGerekli).
  const ustaGerekli = async (req, rep) => { if (!(await ustaMi(req))) return rep.code(401).send({ hata: "Atölyeyi kullanmak için usta ya da editör hesabıyla giriş yapmalısın" }); };
  const googleAnahtari = ortam.GOOGLE_HARITA_ANAHTARI || "";
  const google = googleGirisKur({ ortam, fetch: googleFetch });
  const eposta = epostaKur({ ortam, gonderici: epostaGonderici });
  // Atölye oturumları (kalfa sohbeti + modül taslağı) kullanıcı başına saklanır; hesapsız yönetici "yonetici" altında.
  const atolye = atolyeKur(path.join(veri, "atolye"));
  const atolyeSahibi = async (req) => (await oturumSahibi(req))?.id ?? "yonetici";

  const app = Fastify({ logger: gunluk ? { level: "info" } : false, bodyLimit: 1024 * 1024, trustProxy: true });
  const erisim = await erisimKur({ anahtar: ortam.LONCA_API_ANAHTARI, veri, hesapOturumuGecerli: async (req) => !!(await oturumSahibi(req)) });
  erisim.kur(app);

  // ---------- Statik ----------
  // Kod ve sayfa dosyaları her açılışta ETag ile yeniden doğrulanır (değişmediyse 304). "max-age=0" yetmez: Cloudflare
  // onu kendi tarayıcı önbellek süresiyle (4 saat) değiştiriyor ve yayından sonra tarayıcı eski Studio/uygulama kodunu
  // çalıştırıyordu; "no-cache" ise olduğu gibi geçiyor. Görseller ve diğer dosyalar varsayılan önbellekte kalır.
  const kodDosyasi = /\.(html|js|mjs|css|json|webmanifest)$/i;
  const yenidenDogrula = (rep, yol) => { if (kodDosyasi.test(yol)) rep.header("cache-control", "no-cache"); };
  app.register(fastifyStatic, { root: path.join(kok, "public"), prefix: "/", setHeaders: yenidenDogrula });
  app.register(fastifyStatic, { root: path.join(kok, "sdk"), prefix: "/sdk/", decorateReply: false, setHeaders: yenidenDogrula });
  // Uygulamanın ve web sitesinin tek haritası (MapLibre GL, public/app/harita.js): yalnızca derlenmiş betik ve stil.
  app.register(fastifyStatic, { root: path.join(kok, "node_modules", "maplibre-gl", "dist"), prefix: "/vendor/maplibre/", decorateReply: false, allowedPath: (p) => ["/maplibre-gl.js", "/maplibre-gl.css"].includes(p) });
  app.register(fastifyStatic, { root: path.join(kok, "node_modules", "three"), prefix: "/vendor/three/", decorateReply: false, allowedPath: (p) => p.startsWith("/build/") || p.startsWith("/examples/jsm/") });
  // Web sitesi kökte (public/web/), Android uygulamasından ayrı. Uygulama sayfası (public/app/) /app/ adresinde kalır:
  // modüller orada çalışır (sitenin "Modülü aç" bağlantısı /app/?modul=<id>&gomulu=1), Studio önizlemesi (/app/?onizleme)
  // ve paylaşım bağlantıları (/m/<anahtar> → /app/?modul=) de oradadır. Eski kök paylaşım adresleri (/?modul=, /?eser=)
  // önceki 301 yönlendirmeleri tarayıcıda önbellekte kalmış olabileceğinden yönlendirilmez, uygulama doğrudan açılır.
  const uygulamaSayfasi = (rep) => rep.sendFile("index.html", path.join(kok, "public", "app"));
  const webSitesi = (rep) => rep.sendFile("index.html", path.join(kok, "public", "web"));
  app.get("/", (req, rep) => (req.query?.modul != null || req.query?.eser != null ? uygulamaSayfasi(rep) : webSitesi(rep)));
  app.get("/app", (req, rep) => { const i = req.url.indexOf("?"); return rep.redirect(`/app/${i < 0 ? "" : req.url.slice(i)}`, 302); });
  app.get("/app/", (_, rep) => uygulamaSayfasi(rep));
  app.get("/app/index.html", (_, rep) => uygulamaSayfasi(rep));
  app.get("/web", (_, rep) => rep.redirect("/", 302));
  app.get("/web/", (_, rep) => rep.redirect("/", 302));
  app.get("/studio", (_, rep) => rep.redirect("/studio/"));

  app.get("/api/ayarlar", async () => ({
    harita: googleAnahtari ? { saglayici: "google", anahtar: googleAnahtari } : { saglayici: "osm" },
    uc: { google: !!googleAnahtari, anahtar: googleAnahtari || undefined },
    yonetim: { sifreli: yetki.sifreli },
    hesap: { gerekli: yetki.sifreli, google: google.etkin, sifreSifirlama: eposta.etkin },
  }));

  // ---------- Hesaplar ----------
  const jetonVer = (h) => ({ jeton: oturum.jetonUret({ id: h.id }), hesap: hesaplar.disaAcik(h) });
  app.post("/api/hesap/kayit", { preHandler: hesapSiniri }, async (req, rep) => {
    const hatalar = hesapGirdisiDogrula(req.body, { kayit: true });
    if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
    // Kayıt olan herkes usta olur (rol seçilmez). Admin (editör) hesapları yalnızca ILK_KULLANICILAR'dan ya da rol değişimiyle gelir.
    const { kimlik, eposta: adres, sifre } = req.body;
    // E-posta gönderimi açıksa hesap doğrulama bağlantısına tıklanana kadar giriş yapamaz; kapalıysa hemen açılır.
    const kok = eposta.etkin ? genelAdres(req) : null;
    if (eposta.etkin && !kok) return rep.code(503).send({ hata: "Sunucunun genel adresi ayarlı değil (LONCA_GENEL_ADRES)." });
    const r = await hesaplar.kayitOl({ kimlik, eposta: adres, sifre, rol: "usta", dogrulama: eposta.etkin });
    if (r.hata) return rep.code(409).send({ hata: r.hata });
    if (!r.jeton) return rep.code(201).send(jetonVer(r.hesap));
    dogrulamaPostasi(req, r.hesap, `${kok}${donusSec(req.body.donus)}#eposta-dogrula=${r.jeton}`);
    return rep.code(201).send({ dogrulamaGerekli: true, eposta: r.hesap.eposta, mesaj: `${r.hesap.eposta} adresine bir doğrulama bağlantısı gönderdik. Bağlantıyı açınca hesabın açılır.` });
  });
  app.post("/api/hesap/giris", { preHandler: hesapSiniri }, async (req, rep) => {
    const hatalar = hesapGirdisiDogrula(req.body);
    if (hatalar.length) return rep.code(401).send({ hata: "Kullanıcı adı, e-posta ya da şifre yanlış." });
    const r = await hesaplar.girisYap(req.body);
    if (r.dogrulamaGerekli) return rep.code(403).send({ hata: r.hata, dogrulamaGerekli: true, eposta: r.eposta });
    if (r.hata) return rep.code(401).send({ hata: r.hata });
    return jetonVer(r.hesap);
  });
  app.get("/api/hesap/ben", async (req, rep) => {
    const h = await oturumSahibi(req);
    return h ? hesaplar.disaAcik(h) : rep.code(401).send({ hata: "Giriş yapılmamış" });
  });
  app.put("/api/hesap/profil", async (req, rep) => {
    const h = await oturumSahibi(req);
    if (!h) return rep.code(401).send({ hata: "Giriş yapılmamış" });
    if (req.body?.eposta != null) {
      const r = await hesaplar.epostaAyarla(h.id, req.body.eposta);
      if (r.hata) return rep.code(r.kod).send({ hata: r.hata });
      // Yeni e-postaya doğrulama bağlantısı (Google bağlama için doğrulanmış e-posta gerekir).
      const kok = eposta.etkin && r.degisti ? genelAdres(req) : null;
      if (kok) {
        const d = await hesaplar.dogrulamaHazirla({ id: h.id });
        if (d) dogrulamaPostasi(req, d.hesap, `${kok}${donusSec(req.body.donus)}#eposta-dogrula=${d.jeton}`);
      }
    }
    return hesaplar.disaAcik(await hesaplar.profilGuncelle(h.id, req.body ?? {}));
  });

  // ---------- Şifremi unuttum (server/eposta.js) ----------
  // İstek her zaman aynı yanıtı verir (e-postanın kayıtlı olup olmadığı anlaşılmasın). Bağlantı
  // <genel adres><donus>#sifre-sifirla=<jeton> sayfasını açar; uygulama/Studio orada yeni şifreyi sorar.
  // Genel adres isteğin Host başlığından alınmaz (uydurulmuş Host ile jeton başka bir siteye gönderilmesin):
  // LONCA_GENEL_ADRES, yoksa https://LONCA_ALAN_ADI; ikisi de yoksa yalnızca localhost'tan gelen istekte o adres.
  const SIFIRLAMA_DONUSLERI = new Set(["/", "/app/", "/studio/"]);
  const genelAdres = (req) => {
    const sabit = String(ortam.LONCA_GENEL_ADRES ?? "").trim().replace(/\/+$/, "");
    if (sabit) return sabit;
    if (ortam.LONCA_ALAN_ADI) return `https://${String(ortam.LONCA_ALAN_ADI).trim()}`;
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.host) ? `${req.protocol}://${req.host}` : null;
  };
  const donusSec = (d) => (SIFIRLAMA_DONUSLERI.has(d) ? d : "/");
  // Gönderim beklenmez: yanıt süresinden hesabın durumu anlaşılmasın; hata günlüğe yazılır.
  const postaGonder = (req, ileti) => eposta.gonder(ileti).catch((h) => req.log.error({ err: h.message }, "e-posta gönderilemedi"));
  const dogrulamaPostasi = (req, h, baglanti) => postaGonder(req, {
    kime: h.eposta,
    konu: "Lonca e-posta doğrulama",
    metin: `Merhaba ${h.kimlik},\n\nLonca hesabının e-postasını doğrulamak için bu bağlantıyı aç (24 saat geçerli):\n${baglanti}\n\nBu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.\n`,
    html: `<p>Merhaba ${htmlKacis(h.kimlik)},</p><p>Lonca hesabının e-postasını doğrulamak için aşağıdaki bağlantıyı aç (24 saat geçerli):</p><p><a href="${htmlKacis(baglanti)}">E-postamı doğrula</a></p><p>Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.</p>`,
  });

  // ---------- E-posta doğrulama ----------
  app.post("/api/hesap/eposta-dogrula", { preHandler: hesapSiniri }, async (req, rep) => {
    const r = await hesaplar.epostaDogrula(req.body?.jeton);
    if (r.hata) return rep.code(400).send({ hata: r.hata });
    return jetonVer(r.hesap);
  });
  app.post("/api/hesap/eposta-dogrula/yeniden", { preHandler: hesapSiniri }, async (req, rep) => {
    const adres = req.body?.eposta;
    if (!epostaGecerli(adres)) return rep.code(400).send({ hata: "Geçerli bir e-posta adresi yaz" });
    if (!eposta.etkin) return rep.code(503).send({ hata: "Bu sunucuda e-posta gönderimi kapalı." });
    const kok = genelAdres(req);
    if (!kok) return rep.code(503).send({ hata: "Sunucunun genel adresi ayarlı değil (LONCA_GENEL_ADRES)." });
    const d = await hesaplar.dogrulamaHazirla({ eposta: adres });
    if (d) dogrulamaPostasi(req, d.hesap, `${kok}${donusSec(req.body.donus)}#eposta-dogrula=${d.jeton}`);
    return { tamam: true, mesaj: "Bu e-posta doğrulanmamış bir hesaptaysa yeni doğrulama bağlantısını gönderdik." };
  });

  app.post("/api/hesap/sifre-sifirla/iste", { preHandler: hesapSiniri }, async (req, rep) => {
    const adres = req.body?.eposta;
    if (!epostaGecerli(adres)) return rep.code(400).send({ hata: "Geçerli bir e-posta adresi yaz" });
    if (!eposta.etkin) return rep.code(503).send({ hata: "Bu sunucuda e-posta gönderimi kapalı. Google ile devam edebilir ya da bir admin'den yardım isteyebilirsin." });
    const donus = donusSec(req.body?.donus);
    const kok = genelAdres(req);
    if (!kok) return rep.code(503).send({ hata: "Sunucunun genel adresi ayarlı değil (LONCA_GENEL_ADRES)." });
    const hazir = await hesaplar.sifirlamaHazirla(adres);
    if (hazir) {
      const baglanti = `${kok}${donus}#sifre-sifirla=${hazir.jeton}`;
      const ad = hazir.hesap.kimlik;
      postaGonder(req, {
        kime: hazir.hesap.eposta,
        konu: "Lonca şifre sıfırlama",
        metin: `Merhaba ${ad},\n\nLonca hesabının şifresini sıfırlamak için bu bağlantıyı aç (1 saat geçerli):\n${baglanti}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.\n`,
        html: `<p>Merhaba ${htmlKacis(ad)},</p><p>Lonca hesabının şifresini sıfırlamak için aşağıdaki bağlantıyı aç (1 saat geçerli):</p><p><a href="${htmlKacis(baglanti)}">Şifremi sıfırla</a></p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>`,
      });
    }
    return { tamam: true, mesaj: "Bu e-posta bir hesapta kayıtlıysa sıfırlama bağlantısını gönderdik. Gelen kutunu (ve istenmeyen klasörünü) kontrol et." };
  });
  app.post("/api/hesap/sifre-sifirla", { preHandler: hesapSiniri }, async (req, rep) => {
    const hatalar = sifreSifirlamaDogrula(req.body);
    if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
    const r = await hesaplar.sifirlamaUygula(req.body.jeton, req.body.yeniSifre);
    if (r.hata) return rep.code(400).send({ hata: r.hata });
    return jetonVer(r.hesap);
  });

  // ---------- Google ile giriş (server/google-giris.js) ----------
  // baslat → Google → donus → tek kullanımlık kod → takas (jeton). Jeton adres çubuğuna hiç girmez; tarayıcıya/uygulamaya
  // yalnızca 5 dakikalık, tek kullanımlık bir kod gider. "durum" (state) imzalıdır ve tarayıcıdaki çerezle eşleşmelidir.
  const GOOGLE_DONUSLERI = new Set(["/", "/app/", "/studio/"]);
  const UYGULAMA_SEMASI = "com.kozmos.lonca";
  const DURUM_CEREZI = "lonca_google_durum";
  const googleKodlari = new Map();
  const googleSiniri = hizSiniri({ adet: Number(ortam.HESAP_SINIR ?? 20), pencereMs: 10 * 60_000, mesaj: "Çok fazla giriş denemesi; biraz sonra tekrar dene." });
  const cerezOku = (req, ad) => {
    for (const parca of String(req.headers.cookie ?? "").split(";")) {
      const i = parca.indexOf("=");
      if (i > 0 && parca.slice(0, i).trim() === ad) return parca.slice(i + 1).trim();
    }
    return null;
  };
  const htmlKacis = (x) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // Uygulamaya dönüş: Custom Tab'da açılan sayfa uygulamanın kendi adresine (com.kozmos.lonca://google) geçer.
  const uygulamayaDon = (rep, sorgu) => {
    const hedef = `${UYGULAMA_SEMASI}://google?${new URLSearchParams(sorgu)}`;
    return rep.type("text/html; charset=utf-8").header("cache-control", "no-store").send(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${htmlKacis(hedef)}"><title>Lonca</title>
<style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;text-align:center;padding:16px}a{display:inline-block;margin-top:12px;padding:12px 20px;border-radius:12px;background:#1f4e9c;color:#fff;text-decoration:none}</style></head>
<body><div><p>${sorgu.hata ? htmlKacis(sorgu.hata) : "Giriş tamamlandı."}</p><a href="${htmlKacis(hedef)}">Lonca uygulamasına dön</a></div></body></html>`);
  };

  app.get("/api/hesap/google/baslat", { preHandler: googleSiniri }, async (req, rep) => {
    if (!google.etkin) return rep.code(404).send({ hata: "Google ile giriş bu sunucuda açık değil." });
    const istemci = req.query?.istemci === "uygulama" ? "uygulama" : "web";
    const donus = GOOGLE_DONUSLERI.has(req.query?.donus) ? req.query.donus : "/";
    const nonce = randomBytes(16).toString("hex");
    const durum = oturum.jetonUret({ id: "google-durum", n: nonce, d: donus, i: istemci }, 10 * 60_000);
    const guvenli = req.protocol === "https" ? "; Secure" : "";
    rep.header("set-cookie", `${DURUM_CEREZI}=${nonce}; Path=/api/hesap/google; HttpOnly; SameSite=Lax; Max-Age=600${guvenli}`);
    return rep.header("cache-control", "no-store").redirect(google.yetkiAdresi({ durum, donus: google.donusAdresi(req) }));
  });

  app.get("/api/hesap/google/donus", { preHandler: googleSiniri }, async (req, rep) => {
    const q = req.query ?? {};
    const durum = oturum.jetonCoz(typeof q.state === "string" ? q.state : "");
    const gecerli = durum?.id === "google-durum" && typeof durum.n === "string" && cerezOku(req, DURUM_CEREZI) === durum.n;
    rep.header("set-cookie", `${DURUM_CEREZI}=; Path=/api/hesap/google; HttpOnly; SameSite=Lax; Max-Age=0`);
    rep.header("cache-control", "no-store");
    const istemci = durum?.i === "uygulama" ? "uygulama" : "web";
    const donus = GOOGLE_DONUSLERI.has(durum?.d) ? durum.d : "/";
    const bitir = (sorgu) => (istemci === "uygulama" ? uygulamayaDon(rep, sorgu) : rep.redirect(`${donus}#${new URLSearchParams({ [sorgu.kod ? "google-kod" : "google-hata"]: sorgu.kod ?? sorgu.hata })}`));
    if (!google.etkin) return bitir({ hata: "Google ile giriş bu sunucuda açık değil." });
    if (!gecerli) return bitir({ hata: "Giriş oturumu zaman aşımına uğradı; yeniden dene." });
    if (typeof q.error === "string" || typeof q.code !== "string") return bitir({ hata: q.error === "access_denied" ? "Google girişi iptal edildi." : "Google girişi tamamlanamadı." });
    const kimlik = await google.kodTakas({ kod: q.code, donus: google.donusAdresi(req) });
    if (kimlik.hata) return bitir({ hata: kimlik.hata });
    const r = await hesaplar.googleIleGiris(kimlik, { dogrulamaZorunlu: eposta.etkin });
    if (r.hata) return bitir({ hata: r.hata });
    const simdi = Date.now();
    for (const [k, v] of googleKodlari) if (v.bitis < simdi) googleKodlari.delete(k);
    const kod = randomBytes(24).toString("base64url");
    googleKodlari.set(kod, { id: r.hesap.id, bitis: simdi + 5 * 60_000 });
    return bitir({ kod });
  });

  app.post("/api/hesap/google/takas", { preHandler: hesapSiniri }, async (req, rep) => {
    const kod = req.body?.kod;
    const kayit = typeof kod === "string" ? googleKodlari.get(kod) : null;
    if (kayit) googleKodlari.delete(kod);
    const h = kayit && kayit.bitis > Date.now() ? await hesaplar.idIle(kayit.id) : null;
    return h ? jetonVer(h) : rep.code(401).send({ hata: "Giriş kodu geçersiz ya da süresi doldu; yeniden dene." });
  });
  app.put("/api/hesap/sifre", { preHandler: hesapSiniri }, async (req, rep) => {
    const h = await oturumSahibi(req);
    if (!h) return rep.code(401).send({ hata: "Giriş yapılmamış" });
    const hatalar = sifreDegisimiDogrula(req.body);
    if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
    const r = await hesaplar.sifreDegistir(h.id, req.body);
    if (r.hata) return rep.code(r.kod).send({ hata: r.hata });
    return hesaplar.disaAcik(r.hesap);
  });
  app.post("/api/hesap/tasi", async (req, rep) => {
    const h = await oturumSahibi(req);
    if (!h) return rep.code(401).send({ hata: "Giriş yapılmamış" });
    return hesaplar.disaAcik(await hesaplar.cihazdanTasi(h.id, req.body ?? {}));
  });
  app.put("/api/hesap/:id/rol", { preHandler: editorGerekli }, async (req, rep) => {
    const { rol } = req.body ?? {};
    if (!ROLLER.includes(rol)) return rep.code(400).send({ hata: `rol: ${ROLLER.join(" | ")}` });
    const h = await hesaplar.rolDegistir(req.params.id, rol);
    return h ? hesaplar.disaAcik(h) : rep.code(404).send({ hata: "hesap bulunamadı" });
  });

  // ---------- Eserler ----------
  app.get("/api/eserler", async (req) => {
    const { il, ilce, tur, ad, yuzyil } = req.query;
    const kucuk = (x) => String(x ?? "").toLocaleLowerCase("tr");
    const tamlikUygun = tamlikSuzgeci(req.query);
    return eserler.filter((e) => (!il || e.il === il) && (!ilce || e.ilce === ilce) && (!tur || e.tur === tur)
      && (!ad || kucuk(e.ad).includes(kucuk(ad))) && (!yuzyil || e.yuzyil === Number(yuzyil)) && tamlikUygun(e));
  });

  // ---------- Eserler arası tarihsel bağlar ----------
  app.get("/api/eser-iliskileri", async (req) => {
    const eserId = req.query.eser ? String(req.query.eser) : null;
    if (!eserId) return iliskiler;
    return iliskiler
      .filter((i) => i.a === eserId || i.b === eserId)
      .map((i) => ({ ...i, diger: eserler.find((e) => e.id === (i.a === eserId ? i.b : i.a)) ?? null }));
  });

  app.get("/api/eserler-tamlik", async () => {
    const ozet = { toplam: eserler.length, tam: 0, alanlar: {}, tekEksik: {} };
    for (const a of TUM_ALANLAR) ozet.alanlar[a] = { var: 0, yok: 0 };
    for (const e of eserler) {
      const t = tamlik(e);
      if (t.tam) ozet.tam++;
      if (t.eksikler.length === 1) ozet.tekEksik[t.eksikler[0]] = (ozet.tekEksik[t.eksikler[0]] ?? 0) + 1;
      for (const a of TUM_ALANLAR) ozet.alanlar[a][alanVar(e, a) ? "var" : "yok"]++;
    }
    return { ...ozet, temelAlanlar: TEMEL_ALANLAR };
  });

  app.get("/api/eserler/yakin", async (req, rep) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return rep.code(400).send({ hata: "lat ve lng gerekli" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const { tur } = req.query;
    return eserler
      .filter((e) => e.konum && (!tur || e.tur === tur))
      .map((e) => ({ ...e, mesafe_m: mesafe({ lat, lng }, e.konum) }))
      .sort((a, b) => a.mesafe_m - b.mesafe_m)
      .slice(0, limit);
  });

  // Uygulamadaki genel arama: ad, İngilizce ad, il, ilçe, tür. Eserin yalnızca özeti döner.
  app.get("/api/ara", async (req, rep) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) return [];
    if (q.length > 80) return rep.code(400).send({ hata: "arama en fazla 80 harf" });
    return eserAra(eserler, q, { limit: req.query.limit });
  });

  app.get("/api/eserler/:id", async (req, rep) => eserler.find((x) => x.id === req.params.id) ?? rep.code(404).send({ hata: "eser bulunamadı" }));

  function yeniKimlik(metin) {
    const temel = kimlikUret(metin);
    let id = temel, n = 2;
    while (eserler.some((e) => e.id === id)) id = `${temel}-${n++}`;
    return id;
  }
  function eserUygula(oneri, veri) {
    const zaman = new Date().toISOString();
    if (oneri.tur === "yeni") {
      const { hatalar, eser } = eserDogrula(veri);
      if (hatalar.length) return { hatalar };
      const kayit = { id: yeniKimlik(`${eser.il ?? "Bursa"} ${eser.ad}`), il: "Bursa", ilce: null, ad_en: null, yuzyil: null, konum: null, adres: null,
        fotograflar: [], sergi: null, ...eser, guncelleme: zaman };
      eserler.push(kayit);
      return { eser: kayit };
    }
    const i = eserler.findIndex((e) => e.id === oneri.eserId);
    if (i < 0) return { hatalar: ["düzenlenecek eser bulunamadı"] };
    const { hatalar, eser } = eserDogrula(veri, { kismi: true });
    if (hatalar.length) return { hatalar };
    eserler[i] = { ...eserler[i], ...eser, guncelleme: zaman };
    return { eser: eserler[i] };
  }

  const GECMIS_SINIRI = 300;
  async function gecmiseYaz(kayit) {
    const gecmis = await gecmisDosyasi.oku();
    const yeni = { id: `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`, zaman: new Date().toISOString(), ...kayit };
    gecmis.unshift(yeni);
    for (const eski of gecmis.splice(GECMIS_SINIRI)) if (eski.anlik) await rm(path.join(ANLIK_DIZINI, `${eski.anlik}.json`), { force: true });
    await gecmisDosyasi.yaz(gecmis);
    return yeni;
  }
  const kopya = (x) => (x == null ? null : structuredClone(x));
  async function anlikKaydet() {
    const ad = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
    await mkdir(ANLIK_DIZINI, { recursive: true });
    await writeFile(path.join(ANLIK_DIZINI, `${ad}.json`), JSON.stringify(eserler));
    return ad;
  }

  app.post("/api/eserler", { preHandler: editorGerekli }, async (req, rep) => {
    const r = eserUygula({ tur: "yeni" }, req.body);
    if (r.hatalar) return rep.code(400).send({ hata: "Eser doğrulamadan geçmedi", ayrintilar: r.hatalar });
    await eserleriKaydet();
    await gecmiseYaz({ islem: "ekle", eserId: r.eser.id, ad: r.eser.ad, once: null, sonra: kopya(r.eser) });
    return rep.code(201).send(r.eser);
  });
  app.put("/api/eserler/:id", { preHandler: editorGerekli }, async (req, rep) => {
    const once = kopya(eserler.find((e) => e.id === req.params.id));
    const r = eserUygula({ tur: "duzenle", eserId: req.params.id }, req.body);
    if (r.hatalar) return rep.code(r.hatalar[0].includes("bulunamadı") ? 404 : 400).send({ hata: "Eser doğrulamadan geçmedi", ayrintilar: r.hatalar });
    await eserleriKaydet();
    let neden = null; 
    try { neden = typeof req.headers["x-degisiklik"] === "string" ? decodeURIComponent(req.headers["x-degisiklik"]).slice(0, 80) : null; } catch {}
    await gecmiseYaz({ islem: "duzenle", eserId: r.eser.id, ad: r.eser.ad, neden, once, sonra: kopya(r.eser) });
    return r.eser;
  });
  app.delete("/api/eserler/:id", { preHandler: editorGerekli }, async (req, rep) => {
    const i = eserler.findIndex((e) => e.id === req.params.id);
    if (i < 0) return rep.code(404).send({ hata: "eser bulunamadı" });
    const [silinen] = eserler.splice(i, 1);
    await eserleriKaydet();
    const g = await gecmiseYaz({ islem: "sil", eserId: silinen.id, ad: silinen.ad, once: kopya(silinen), sonra: null });
    return { silindi: silinen.id, gecmis: g.id };
  });

  app.get("/api/eser-gecmisi", { preHandler: editorGerekli }, async (req) => {
    const { eser } = req.query;
    const gecmis = await gecmisDosyasi.oku();
    return gecmis.filter((g) => !eser || g.eserId === eser).slice(0, 100).map((g) => ({
      id: g.id, zaman: g.zaman, islem: g.islem, eserId: g.eserId, ad: g.ad, neden: g.neden ?? null, geriAlinan: g.geriAlinan ?? null,
      ozet: g.ozet ?? degisenAlanlar(g.once, g.sonra),
      geriAlindi: gecmis.some((x) => x.geriAlinan === g.id),
    }));
  });
  function degisenAlanlar(once, sonra) {
    if (!once || !sonra) return [];
    return [...new Set([...Object.keys(once), ...Object.keys(sonra)])]
      .filter((k) => k !== "guncelleme" && JSON.stringify(once[k] ?? null) !== JSON.stringify(sonra[k] ?? null));
  }
  app.post("/api/eser-gecmisi/:id/geri-al", { preHandler: editorGerekli }, async (req, rep) => {
    const gecmis = await gecmisDosyasi.oku();
    const g = gecmis.find((x) => x.id === req.params.id);
    if (!g) return rep.code(404).send({ hata: "geçmiş kaydı bulunamadı" });
    if (g.islem === "ice-aktar") {
      let onceki;
      try { onceki = JSON.parse(await readFile(path.join(ANLIK_DIZINI, `${g.anlik}.json`), "utf8")); }
      catch { return rep.code(410).send({ hata: "bu içe aktarmanın önceki hâli artık saklanmıyor" }); }
      const anlik = await anlikKaydet();
      eserler.splice(0, eserler.length, ...onceki);
      await eserleriKaydet();
      const yeni = await gecmiseYaz({ islem: "ice-aktar", ad: `Geri alındı: ${g.ad}`, anlik, geriAlinan: g.id, ozet: [`${onceki.length} eser geri yüklendi`] });
      return { geriAlindi: g.id, gecmis: yeni.id };
    }
    const simdiki = kopya(eserler.find((e) => e.id === g.eserId));
    const i = eserler.findIndex((e) => e.id === g.eserId);
    if (g.once == null) { if (i >= 0) eserler.splice(i, 1); }
    else if (i >= 0) eserler[i] = kopya(g.once);
    else eserler.push(kopya(g.once));
    await eserleriKaydet();
    const yeni = await gecmiseYaz({ islem: "geri-al", eserId: g.eserId, ad: g.ad, once: simdiki, sonra: kopya(g.once), geriAlinan: g.id });
    return { geriAlindi: g.id, gecmis: yeni.id, eser: g.once ? eserler.find((e) => e.id === g.eserId) : null };
  });

  app.get("/api/eserler-disa-aktar", { preHandler: editorGerekli }, async (_, rep) => {
    const tarih = new Date().toISOString().slice(0, 10);
    rep.header("content-disposition", `attachment; filename="lonca-eserler-${tarih}.json"`);
    return { ...eserVerisi, disaAktarma: new Date().toISOString(), eserler };
  });
  app.post("/api/eserler-ice-aktar", { preHandler: editorGerekli, bodyLimit: 25 * 1024 * 1024 }, async (req, rep) => {
    const { kip = "birlestir" } = req.body ?? {};
    const gelen = Array.isArray(req.body?.eserler) ? req.body.eserler : null;
    if (!["birlestir", "degistir"].includes(kip)) return rep.code(400).send({ hata: "kip: birlestir | degistir" });
    if (!gelen || !gelen.length) return rep.code(400).send({ hata: "eserler listesi gerekli (dışa aktarılan dosyanın biçimi)" });
    if (gelen.length > 5000) return rep.code(413).send({ hata: "en fazla 5000 eser içe aktarılabilir" });
    const hatalar = [], temiz = [], gorulen = new Set();
    gelen.forEach((ham, sira) => {
      const { hatalar: h, eser } = eserDogrula(ham);
      const id = typeof ham?.id === "string" && /^[a-z0-9-]{1,80}$/.test(ham.id) ? ham.id : null;
      if (id && gorulen.has(id)) h.push(`aynı id iki kez geçiyor: ${id}`);
      if (h.length) hatalar.push({ sira: sira + 1, ad: typeof ham?.ad === "string" ? ham.ad.slice(0, 80) : "?", hatalar: h });
      else { if (id) gorulen.add(id); temiz.push({ id, eser }); }
    });
    if (hatalar.length) return rep.code(400).send({ hata: `${hatalar.length} kayıt doğrulamadan geçmedi; hiçbir şey değişmedi`, ayrintilar: hatalar.slice(0, 20).map((x) => `${x.sira}. ${x.ad}: ${x.hatalar.join("; ")}`) });

    const anlik = await anlikKaydet();
    const onceSayi = eserler.length, zaman = new Date().toISOString();
    let eklenen = 0, guncellenen = 0;
    const sonuc = kip === "degistir" ? [] : eserler.slice();
    for (const { id, eser } of temiz) {
      const i = id ? sonuc.findIndex((e) => e.id === id) : -1;
      const temel = { il: "Bursa", ilce: null, ad_en: null, yuzyil: null, konum: null, adres: null, fotograflar: [], sergi: null };
      if (i >= 0) { sonuc[i] = { ...temel, ...sonuc[i], ...eser, id, guncelleme: zaman }; guncellenen++; }
      else {
        let yeniId = id ?? kimlikUret(`${eser.il ?? "Bursa"} ${eser.ad}`), n = 2;
        const taban = yeniId;
        while (sonuc.some((e) => e.id === yeniId)) yeniId = `${taban}-${n++}`;
        sonuc.push({ id: yeniId, ...temel, ...eser, guncelleme: zaman }); eklenen++;
      }
    }
    const silinen = kip === "degistir" ? onceSayi - guncellenen : 0;
    eserler.splice(0, eserler.length, ...sonuc);
    await eserleriKaydet();
    const ozet = [`${eklenen} eklendi`, `${guncellenen} güncellendi`, ...(silinen ? [`${silinen} silindi`] : [])];
    const g = await gecmiseYaz({ islem: "ice-aktar", ad: `İçe aktarma (${kip === "degistir" ? "tamamen değiştir" : "birleştir"})`, anlik, ozet });
    return { eklenen, guncellenen, silinen, toplam: eserler.length, gecmis: g.id };
  });

  app.post("/api/eser-oneriler", { preHandler: oneriSiniri }, async (req, rep) => {
    const { tur, eserId, veri: oneriVerisi, not } = req.body ?? {};
    if (!["yeni", "duzenle", "not", "istek"].includes(tur)) return rep.code(400).send({ hata: "tur: yeni | duzenle | not | istek" });
    // "istek": usta kalfayla konuşurken bilgi bankasında olmayan bir eserin eklenmesini ister (yalnızca ad, il, not;
    // tarihî bilgi taşımaz). Admin Studio'daki öneriler listesinde görür; eseri admin (ya da admin kalfası) ekler.
    if (tur === "istek") {
      if (!(await ustaMi(req))) return rep.code(401).send({ hata: "Eser isteği için Studio'ya giriş yapmalısın" });
      const ist = eserIstegiDogrula(req.body?.istek);
      if (ist.hatalar.length) return rep.code(400).send({ hata: ist.hatalar[0], ayrintilar: ist.hatalar });
      const oneriler = await oneriDosyasi.oku();
      if (oneriler.filter((o) => o.durum === "bekliyor").length >= 500) return rep.code(503).send({ hata: "Onay kuyruğu dolu" });
      const oneren = (await yetkiliHesap(req))?.kimlik ?? null;
      const ayni = oneriler.find((o) => o.tur === "istek" && o.durum === "bekliyor" && o.istek?.ad.toLocaleLowerCase("tr") === ist.istek.ad.toLocaleLowerCase("tr"));
      if (ayni) return rep.code(200).send({ id: ayni.id, durum: ayni.durum, zatenVar: true });
      const kayit = { id: randomBytes(6).toString("hex"), tur, eserId: null, veri: null, istek: ist.istek, not: ist.istek.not, kaynak: null, oneren, durum: "bekliyor", tarih: new Date().toISOString() };
      oneriler.push(kayit);
      await oneriDosyasi.yaz(oneriler);
      return rep.code(201).send({ id: kayit.id, durum: kayit.durum });
    }
    if (tur !== "yeni" && !eserler.some((e) => e.id === eserId)) return rep.code(404).send({ hata: "eser bulunamadı" });
    let temiz = null;
    if (tur !== "not") {
      const { hatalar, eser } = eserDogrula(oneriVerisi, { kismi: tur === "duzenle" });
      if (hatalar.length) return rep.code(400).send({ hata: "Öneri doğrulamadan geçmedi", ayrintilar: hatalar });
      temiz = eser;
    }
    const ek = oneriEkiDogrula(tur, req.body ?? {}, temiz);
    if (ek.hatalar.length) return rep.code(400).send({ hata: "Öneri doğrulamadan geçmedi", ayrintilar: ek.hatalar });
    const notMetni = typeof not === "string" ? not.trim().slice(0, 1500) : "";
    if (tur === "not" && notMetni.length < 5) return rep.code(400).send({ hata: "Düzeltme notu en az 5 karakter olmalı" });
    const oneriler = await oneriDosyasi.oku();
    if (oneriler.filter((o) => o.durum === "bekliyor").length >= 500) return rep.code(503).send({ hata: "Onay kuyruğu dolu" });
    const kayit = { id: randomBytes(6).toString("hex"), tur, eserId: tur === "yeni" ? null : eserId, veri: temiz, not: notMetni || null,
      kaynak: ek.kaynak, oneren: ek.oneren, durum: "bekliyor", tarih: new Date().toISOString() };
    oneriler.push(kayit);
    await oneriDosyasi.yaz(oneriler);
    return rep.code(201).send({ id: kayit.id, durum: kayit.durum });
  });

  app.get("/api/eser-oneriler", { preHandler: editorGerekli }, async (req) => {
    const liste = await oneriDosyasi.oku();
    const durum = req.query.durum ?? "bekliyor";
    return liste.filter((o) => durum === "hepsi" || o.durum === durum).reverse()
      .map((o) => ({ ...o, eser: o.eserId ? eserler.find((e) => e.id === o.eserId) ?? null : null }));
  });

  app.post("/api/eser-oneriler/:id/karar", { preHandler: editorGerekli }, async (req, rep) => {
    const { karar, veri: duzeltilmis } = req.body ?? {};
    if (!["onayla", "reddet"].includes(karar)) return rep.code(400).send({ hata: "karar: onayla | reddet" });
    const oneriler = await oneriDosyasi.oku();
    const o = oneriler.find((x) => x.id === req.params.id);
    if (!o) return rep.code(404).send({ hata: "öneri bulunamadı" });
    if (o.durum !== "bekliyor") return rep.code(409).send({ hata: "bu öneri zaten karara bağlandı" });
    let eser = null;
    const onceki = kopya(eserler.find((e) => e.id === o.eserId));
    if (karar === "onayla" && o.tur !== "not" && o.tur !== "istek") {
      const r = eserUygula(o, duzeltilmis ?? o.veri); 
      if (r.hatalar) return rep.code(400).send({ hata: "Eser doğrulamadan geçmedi", ayrintilar: r.hatalar });
      eser = r.eser;
      await eserleriKaydet();
      await gecmiseYaz({ islem: o.tur === "yeni" ? "ekle" : "duzenle", eserId: eser.id, ad: eser.ad, neden: "Topluluk önerisi onaylandı",
        once: o.tur === "yeni" ? null : onceki, sonra: kopya(eser) });
    }
    o.durum = karar === "onayla" ? "onaylandi" : "reddedildi";
    o.karar_tarihi = new Date().toISOString();
    if (eser) o.eserId = eser.id;
    await oneriDosyasi.yaz(oneriler);
    return { oneri: o, eser };
  });

  app.post("/api/medya", { preHandler: oneriSiniri, bodyLimit: Math.ceil(MAKS_FOTO * 1.4) }, async (req, rep) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(req.body?.dosya ?? "");
    if (!m) return rep.code(400).send({ hata: "dosya: data:image/jpeg|png|webp;base64,… olmalı" });
    const tampon = Buffer.from(m[2], "base64");
    if (tampon.length > MAKS_FOTO) return rep.code(413).send({ hata: "fotoğraf en fazla 6 MB olabilir" });
    const sihir = tampon.subarray(0, 12);
    const uzanti = sihir[0] === 0xff && sihir[1] === 0xd8 ? "jpg"
      : sihir.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
      : sihir.subarray(0, 4).toString() === "RIFF" && sihir.subarray(8, 12).toString() === "WEBP" ? "webp" : null;
    if (!uzanti) return rep.code(400).send({ hata: "dosya içeriği bir fotoğraf değil" });
    await mkdir(YUKLENEN, { recursive: true });
    const ad = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${uzanti}`;
    await writeFile(path.join(YUKLENEN, ad), tampon);
    return rep.code(201).send({ yol: `/medya/yuklenen/${ad}` });
  });
  app.get("/medya/yuklenen/:ad", async (req, rep) => {
    const { ad } = req.params;
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(ad)) return rep.code(404).send();
    const yol = `/medya/yuklenen/${ad}`;
    const yayinda = eserler.some((e) => e.fotograflar?.includes(yol));
    // Yayında olmayan (onay bekleyen öneriye ait) fotoğrafı yalnızca admin görür.
    if (!yayinda && !(await editorMi(req))) return rep.code(404).send({ hata: "bulunamadı" });
    const dosya = path.join(YUKLENEN, ad);
    if (!existsSync(dosya)) return rep.code(404).send();
    const tur = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[ad.split(".").pop()];
    return rep.type(tur).header("cache-control", yayinda ? "public, max-age=86400" : "no-store").send(await readFile(dosya));
  });

  const fotografli = () => eserler.filter((e) => e.fotograflar?.length);
  const sabitSayi = (metin) => [...String(metin)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ozetEser = (e) => ({ id: e.id, ad: e.ad, tur: e.tur, ilce: e.ilce, yuzyil: e.yuzyil, foto: e.fotograflar[0] });
  const ilginçCumleler = (metin) => {
    const cumleler = String(metin).split(/(?<=[.!?])\s+/).filter(Boolean);
    const anlatan = cumleler.filter((c) => !/(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/i.test(c));
    const metin2 = (anlatan.length ? anlatan : cumleler).slice(0, 2).join(" ");
    return metin2.length <= 280 ? metin2 : `${metin2.slice(0, 280).replace(/\s+\S*$/, "")}…`;
  };
  app.get("/api/vitrin", async () => {
    const havuz = fotografli();
    const gun = Math.floor(Date.now() / 86_400_000);
    const tam = havuz.filter((e) => e.yuzyil && e.tarihce?.tr);
    const gununEseri = tam.length ? tam[gun % tam.length] : havuz[0] ?? null;
    const secki = [];
    for (let i = 0; i < havuz.length && secki.length < 10; i++) {
      const e = havuz[(gun * 7 + i * 13) % havuz.length];
      if (e !== gununEseri && !secki.includes(e)) secki.push(e);
    }
    const moduller = (await modulDosyasi.oku()).filter((m) => m.durum === "onayli");
    // Vitrindeki kartlar aynı fotoğrafı tekrarlamasın: aynı kapak eserini seçen ikinci modül eserin sıradaki
    // fotoğrafını, o da yoksa havuzdan kullanılmamış bir eserin fotoğrafını alır.
    const kullanilan = new Set();
    const bosFoto = (e) => e?.fotograflar?.find((f) => !kullanilan.has(f));
    const kapaklar = Object.fromEntries(moduller.map((m) => {
      const secilen = m.kapakEser && eserler.find((e) => e.id === m.kapakEser && e.fotograflar?.length);
      const uygun = havuz.filter((e) => !m.ikon || m.ikon === "genel" || e.tur === m.ikon);
      const liste = uygun.length ? uygun : havuz;
      const bas = sabitSayi(m.id) % Math.max(1, liste.length);
      const aday = bosFoto(secilen) ? secilen : [...liste.slice(bas), ...liste.slice(0, bas)].find(bosFoto) ?? secilen ?? liste[bas];
      const foto = bosFoto(aday) ?? aday?.fotograflar?.[0];
      if (foto) kullanilan.add(foto);
      return [m.id, aday && foto ? { foto, eser: aday.ad } : null];
    }));
    return {
      sayilar: { eser: eserler.length, fotografli: havuz.length, konumlu: eserler.filter((e) => e.konum).length, ilce: new Set(eserler.map((e) => e.ilce).filter(Boolean)).size },
      gununEseri: gununEseri && { ...ozetEser(gununEseri), ozet: ilginçCumleler(gununEseri.tarihce.tr), fotoSayisi: gununEseri.fotograflar.length },
      secki: secki.map(ozetEser),
      kapaklar,
      iller: [...new Set(eserler.map((e) => e.il).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    };
  });

  const yayindakiler = async () => (await modulDosyasi.oku()).filter((m) => m.durum === "onayli");
  app.get("/api/moduller", async (req, rep) => {
    if (req.query.durum === "hepsi") {
      if (!(await ustaMi(req))) return rep.code(401).send({ hata: "Bu liste için Studio'ya giriş yapmalısın" });
      // Onay kuyruğu dahil bütün liste yalnızca admin'e; usta yalnızca kendi modüllerini görür.
      if (await editorMi(req)) return modulDosyasi.oku();
      const sahip = (await yetkiliHesap(req))?.id;
      return (await modulDosyasi.oku()).filter((m) => m.sahip && m.sahip === sahip);
    }
    const liste = await yayindakiler();
    const etiket = `"${modulSurumu(liste)}"`;
    rep.header("etag", etiket).header("cache-control", "no-cache");
    if (req.headers["if-none-match"] === etiket) return rep.code(304).send();
    return liste;
  });
  // Uygulama bunu birkaç saniyede bir yoklar; sürüm değişince listeyi yeniden çeker (yeni onaylanan modül anında görünür).
  // SSE yerine yoklama: Android köprüsü yalnızca fetch'i canlı sunucuya yönlendirebiliyor.
  app.get("/api/moduller/surum", async (_, rep) => {
    const liste = await yayindakiler();
    rep.header("cache-control", "no-store");
    return { surum: modulSurumu(liste), sayi: liste.length };
  });

  app.get("/api/moduller/:id/kod", async (req, rep) => {
    const { id } = req.params;
    const m = (await modulDosyasi.oku()).find((x) => x.id === id);
    if (!m || !kimlikGecerli(id)) return rep.code(404).send({ hata: "modül bulunamadı" });
    // Yayında olmayan modülün kodunu admin ya da modülün sahibi olan usta okur.
    if (m.durum !== "onayli" && !(await editorMi(req)) && !(m.sahip && m.sahip === (await yetkiliHesap(req))?.id))
      return rep.code(403).send({ hata: "modül yayında değil" });
    const kod = await readFile(path.join(MODUL_DIZINI, `${id}.js`), "utf8");
    return rep.type("text/javascript; charset=utf-8").header("cache-control", "no-store").send(kod);
  });

  app.post("/api/moduller", { preHandler: [ustaGerekli, oneriSiniri] }, async (req, rep) => {
    const { id, ad, aciklama = "", izinler = [], kod, renk, ikon, kategori } = req.body ?? {};
    if (!kimlikGecerli(id)) return rep.code(400).send({ hata: "id: küçük harf, rakam ve tire (en fazla 64)" });
    if (typeof ad !== "string" || !ad.trim()) return rep.code(400).send({ hata: "ad gerekli" });
    if (typeof kod !== "string" || kod.length > MAKS_KOD) return rep.code(400).send({ hata: `kod gerekli (en fazla ${MAKS_KOD} karakter)` });
    const hatalar = kalfa.dogrula(kod);
    if (hatalar.length) return rep.code(400).send({ hata: "Modül doğrulamadan geçmedi", ayrintilar: hatalar });
    const gorunurlukHatasi = modulGorunurlukDogrula(req.body.gorunurluk);
    if (gorunurlukHatasi) return rep.code(400).send({ hata: gorunurlukHatasi });
    const ozel = req.body.gorunurluk === "ozel";

    const liste = await modulDosyasi.oku();
    const onceki = liste.find((m) => m.id === id);
    const editor = await editorMi(req);
    if (onceki && onceki.durum === "onayli" && !editor) return rep.code(409).send({ hata: "Bu kimlikle yayında bir modül var; başka bir id seç" });
    // Bir ustanın taslağını başka bir usta ezemez; editör ve yönetici ezebilir.
    const sahip = (await oturumSahibi(req))?.id ?? null;
    if (onceki?.sahip && sahip !== onceki.sahip && !editor) return rep.code(409).send({ hata: "Bu kimlikte başka bir ustanın taslağı var; başka bir id seç" });
    // Yayındaki bir modülü editör (ya da yönetici) düzenlerse yayında kalır: kaydeden kişi zaten onay yetkilisi,
    // uygulamadan kaybolup yeniden onay beklemesin. Yeni modüller ve usta gönderimleri her zaman onay bekler.
    const canliKalsin = !ozel && editor && onceki?.durum === "onayli";
    const simdi = new Date().toISOString();
    const kayit = {
      id, ad: ad.trim().slice(0, 60), aciklama: String(aciklama).slice(0, 200),
      izinler: Array.isArray(izinler) ? izinler.filter((x) => x === "konum") : [],
      renk: RENKLER.includes(renk) ? renk : undefined,
      ikon: IKONLAR.includes(ikon) ? ikon : undefined,
      kategori: KATEGORILER.includes(kategori) ? kategori : undefined,
      kapakEser: typeof req.body?.kapakEser === "string" && eserler.some((e) => e.id === req.body.kapakEser) ? req.body.kapakEser : onceki?.kapakEser,
      sahip: sahip ?? onceki?.sahip ?? undefined,
      // Özel modülün bağlantısı tahmin edilemez bir anahtar taşır; herkese açık modülün bağlantısı kimliğidir.
      paylasim: ozel ? onceki?.paylasim ?? randomBytes(12).toString("base64url") : onceki?.paylasim,
      // Elle yazılabilen kısa davet kodu (ABCD-EFGH): uygulamada ve webde "Davet kodu" alanına girilir.
      davetKodu: ozel ? onceki?.davetKodu ?? yeniDavetKodu(liste) : onceki?.davetKodu,
      durum: ozel ? "ozel" : canliKalsin ? "onayli" : "bekliyor", olusturma: onceki?.olusturma ?? simdi, guncelleme: simdi,
      ...(canliKalsin ? { yayin: simdi } : {}),
    };
    const kaynak = kaynakBul(kod, onceki);
    kayit.kaynak = { ...kaynak, ozet: kodOzeti(kod) };
    // Doğrulama işareti: modül yalnızca bilgi bankasının doğrulanmış (Vakıf Katılım) kayıtlarına dayanıyorsa ✓;
    // dış kaynaklı içerik (Vikipedi) varsa uygulama kartta "Kaynak doğrulanmamış: Vikipedi" yazar.
    kayit.dogrulama = modulDogrulamasi({ kod, eserler, disKaynaklar: kaynak.disKaynaklar ?? [] });
    const i = liste.findIndex((m) => m.id === id);
    if (i >= 0) liste[i] = kayit; else liste.push(kayit);
    await mkdir(MODUL_DIZINI, { recursive: true });
    const eskiYol = path.join(MODUL_DIZINI, `${id}.js`);
    if (onceki && existsSync(eskiYol)) {
      const yedekler = path.join(MODUL_DIZINI, "eski");
      await mkdir(yedekler, { recursive: true });
      await writeFile(path.join(yedekler, `${id}-${new Date().toISOString().replace(/[:.]/g, "-")}.js`), await readFile(eskiYol));
      const benimkiler = (await readdir(yedekler)).filter((f) => f.startsWith(`${id}-`) && /^\d{4}-/.test(f.slice(id.length + 1))).sort();
      for (const f of benimkiler.slice(0, -10)) await rm(path.join(yedekler, f), { force: true });
    }
    await writeFile(eskiYol, kod);
    await modulDosyasi.yaz(liste);
    return rep.code(201).send(kayit);
  });

  async function durumDegistir(id, durum) {
    const liste = await modulDosyasi.oku();
    const m = liste.find((x) => x.id === id);
    if (!m) return null;
    m.durum = durum;
    if (durum === "ozel") { m.paylasim ??= randomBytes(12).toString("base64url"); m.davetKodu ??= yeniDavetKodu(liste); }
    m.guncelleme = new Date().toISOString();
    if (durum === "onayli") m.yayin = m.guncelleme;
    await modulDosyasi.yaz(liste);
    return m;
  }
  // Usta kendi modülünü yönetebilir: onaydan (ya da yayından) geri çekip özel taslağa döndürür ve silebilir.
  // Başka bir durum (yayınlama, reddetme, arşiv) yalnızca admin'in işidir. Sonuç: null = izinli, değilse { kod, hata }.
  // Yanıt nesnesi (reply) döndürülmez: thenable olduğu için await onu undefined'a çözer ve işlem sürerdi.
  async function sahipDenetle(req, id) {
    if (await editorMi(req)) return null;
    const m = (await modulDosyasi.oku()).find((x) => x.id === id);
    if (!m) return { kod: 404, hata: "modül bulunamadı" };
    const ben = (await yetkiliHesap(req))?.id;
    if (!m.sahip || m.sahip !== ben) return { kod: 403, hata: "Yalnızca kendi modülünü yönetebilirsin" };
    return null;
  }
  app.post("/api/moduller/:id/durum", { preHandler: ustaGerekli }, async (req, rep) => {
    const { durum } = req.body ?? {};
    if (!MODUL_DURUMLARI.includes(durum)) return rep.code(400).send({ hata: `durum: ${MODUL_DURUMLARI.join(" | ")}` });
    if (!(await editorMi(req))) {
      if (durum !== "ozel") return rep.code(403).send({ hata: "Usta modülünü yalnızca geri çekip özel taslağa döndürebilir; yayın ve onay admin'in işidir" });
      const red = await sahipDenetle(req, req.params.id);
      if (red) return rep.code(red.kod).send({ hata: red.hata });
    }
    return (await durumDegistir(req.params.id, durum)) ?? rep.code(404).send({ hata: "modül bulunamadı" });
  });
  app.post("/api/moduller/:id/onayla", { preHandler: editorGerekli }, async (req, rep) =>
    (await durumDegistir(req.params.id, "onayli")) ?? rep.code(404).send({ hata: "modül bulunamadı" }));

  app.delete("/api/moduller/:id", { preHandler: ustaGerekli }, async (req, rep) => {
    const { id } = req.params;
    if (!kimlikGecerli(id)) return rep.code(404).send({ hata: "modül bulunamadı" });
    const red = await sahipDenetle(req, id);
    if (red) return rep.code(red.kod).send({ hata: red.hata });
    const liste = await modulDosyasi.oku();
    const i = liste.findIndex((m) => m.id === id);
    if (i < 0) return rep.code(404).send({ hata: "modül bulunamadı" });
    liste.splice(i, 1);
    await modulDosyasi.yaz(liste);
    await rm(path.join(MODUL_DIZINI, `${id}.js`), { force: true });
    return { silindi: id };
  });

  // ---------- Paylaşım bağlantısı ----------
  // /m/<anahtar>: özel modülde paylaşım anahtarı, yayındaki modülde kimlik. Tarayıcı web uygulamasında açar;
  // Android'de uygulama yüklüyse aynı bağlantı (App Links) uygulamayı açar.
  async function paylasilanModul(anahtar) {
    if (!paylasimAnahtariGecerli(anahtar)) return null;
    const liste = await modulDosyasi.oku();
    const davet = davetKoduCoz(anahtar);
    return liste.find((m) => m.durum === "ozel" && m.paylasim === anahtar)
      ?? (davet && liste.find((m) => m.durum === "ozel" && m.davetKodu === davet))
      ?? liste.find((m) => m.durum === "onayli" && m.id === anahtar) ?? null;
  }
  const yeniDavetKodu = (liste) => { let k; do k = davetKoduUret(); while (liste.some((m) => m.davetKodu === k)); return k; };
  const paylasimOzeti = (m) => ({ id: m.id, ad: m.ad, aciklama: m.aciklama, izinler: m.izinler, renk: m.renk, ikon: m.ikon, kategori: m.kategori, durum: m.durum, dogrulama: m.dogrulama });
  // Davet kodu kısa olduğundan tahmin denemelerine karşı IP başına sınır.
  const paylasimSiniri = hizSiniri({ adet: Number(ortam.PAYLASIM_SINIR ?? 120), pencereMs: 10 * 60_000, mesaj: "Çok fazla deneme; biraz sonra tekrar dene." });
  app.get("/api/paylasim/:anahtar", { preHandler: paylasimSiniri }, async (req, rep) => {
    const m = await paylasilanModul(req.params.anahtar);
    rep.header("cache-control", "no-store");
    return m ? paylasimOzeti(m) : rep.code(404).send({ hata: "Bu bağlantıda bir modül yok ya da artık paylaşılmıyor." });
  });
  app.get("/api/paylasim/:anahtar/kod", { preHandler: paylasimSiniri }, async (req, rep) => {
    const m = await paylasilanModul(req.params.anahtar);
    if (!m) return rep.code(404).send({ hata: "Bu bağlantıda bir modül yok ya da artık paylaşılmıyor." });
    const kod = await readFile(path.join(MODUL_DIZINI, `${m.id}.js`), "utf8");
    return rep.type("text/javascript; charset=utf-8").header("cache-control", "no-store").send(kod);
  });
  app.get("/m/:anahtar", async (req, rep) => {
    const { anahtar } = req.params;
    return paylasimAnahtariGecerli(anahtar) ? rep.redirect(`/app/?modul=${encodeURIComponent(anahtar)}&gomulu=1`) : rep.redirect("/");
  });
  // Android App Links doğrulaması: ANDROID_IMZA_SHA256 (APK imza sertifikasının SHA-256 parmak izleri, virgülle) doluysa yayımlanır.
  const imzalar = String(ortam.ANDROID_IMZA_SHA256 ?? "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x));
  app.get("/.well-known/assetlinks.json", async (_, rep) => {
    if (!imzalar.length) return rep.code(404).send({ hata: "ANDROID_IMZA_SHA256 tanımlı değil" });
    return [{ relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "com.kozmos.lonca", sha256_cert_fingerprints: imzalar } }];
  });

  // ---------- Dalışlar (uydudan içine kaydırmalı geziler) ----------
  // Tanımlar data/dalislar/<eser>.json; görüntüler public/medya/dalis/<eser>/. Uygulama yalnızca onaylıları görür;
  // Studio önizlemesi (?onizleme=1) onay bekleyenleri de görür ki editör yayından önce inceleyebilsin.
  const DALIS_DURUMLARI = ["bekliyor", "onayli", "kaldirildi"];
  async function dalislariOku() {
    if (!existsSync(DALIS_DIZINI)) return [];
    const dosyalar = (await readdir(DALIS_DIZINI)).filter((d) => d.endsWith(".json"));
    const liste = [];
    for (const d of dosyalar) { try { liste.push(JSON.parse(await readFile(path.join(DALIS_DIZINI, d), "utf8"))); } catch {} }
    return liste.sort((a, b) => String(a.olusturma).localeCompare(String(b.olusturma)));
  }
  app.get("/api/dalislar", async (req) => {
    const onizleme = req.query.onizleme === "1";
    const liste = (await dalislariOku()).filter((d) => d.durum === "onayli" || (onizleme && d.durum === "bekliyor"));
    // ?ozet=1: kareler olmadan yalnızca hangi eserin dalışı olduğu (eser sayfasındaki "Dalışı var" rozeti için).
    return req.query.ozet === "1" ? liste.map((d) => ({ eser: d.eser, ozet: d.ozet ?? null, durum: d.durum })) : liste;
  });
  app.get("/api/dalislar-yonetim", { preHandler: editorGerekli }, async () =>
    (await dalislariOku()).map(({ kareler, ...d }) => ({ ...d, kareSayisi: kareler?.length ?? 0, kartlar: (kareler ?? []).flatMap((k) => (k.k ?? []).map((b) => ({ ...b, kare: k.b ?? "" }))) })));
  app.post("/api/dalislar/:eser/durum", { preHandler: editorGerekli }, async (req, rep) => {
    const { eser } = req.params, { durum } = req.body ?? {};
    if (!kimlikGecerli(eser) || !DALIS_DURUMLARI.includes(durum)) return rep.code(400).send({ hata: `durum: ${DALIS_DURUMLARI.join(" | ")}` });
    const yol = path.join(DALIS_DIZINI, `${eser}.json`);
    if (!existsSync(yol)) return rep.code(404).send({ hata: "dalış bulunamadı" });
    const tanim = JSON.parse(await readFile(yol, "utf8"));
    Object.assign(tanim, { durum, guncelleme: new Date().toISOString() });
    await writeFile(yol, JSON.stringify(tanim, null, 1) + "\n");
    return { eser, durum };
  });
  app.delete("/api/dalislar/:eser", { preHandler: editorGerekli }, async (req, rep) => {
    const { eser } = req.params;
    if (!kimlikGecerli(eser)) return rep.code(400).send({ hata: "geçersiz kimlik" });
    const yol = path.join(DALIS_DIZINI, `${eser}.json`);
    if (!existsSync(yol)) return rep.code(404).send({ hata: "dalış bulunamadı" });
    const tanim = JSON.parse(await readFile(yol, "utf8"));
    if (tanim.kaynak !== "kalfa") return rep.code(409).send({ hata: "Elle hazırlanmış dalışlar silinmez; kaldırabilirsin" });
    await rm(yol, { force: true });
    await rm(path.join(kok, "public", "medya", "dalis", eser), { recursive: true, force: true });
    return { silindi: eser };
  });

  // Dalış kalfası: bir eser için geziyi baştan sona hazırlar (dakikalar sürer; Studio ilerlemeyi yoklar).
  app.get("/api/dalis-kalfasi", async () => ({ hazir: dalisKalfasi.hazir(), etkin: dalisKalfasi.etkin()?.id ?? null }));
  // Dalış önerileri: Studio'daki öneri düğmeleri her mesajdan sonra buradan yenilenir. Yalnızca bilgi bankasındaki
  // eser adlarıyla kurulur (fotoğrafı ve konumu olan, dalışı henüz olmayan eserler önce); ?haric= az önce istenenleri atlar.
  app.get("/api/dalis-kalfasi/oneriler", { preHandler: ustaGerekli }, async (req) => {
    const haric = new Set(String(req.query.haric ?? "").split(",").filter(kimlikGecerli).slice(0, 20));
    const dalisli = new Set((await dalislariOku()).filter((d) => d.durum !== "kaldirildi").map((d) => d.eser));
    const adaylar = eserler.filter((e) => e.konum && e.fotograflar?.length && !haric.has(e.id));
    const karistir = (dizi) => dizi.map((e) => [Math.random(), e]).sort((a, b) => a[0] - b[0]).map(([, e]) => e);
    const sirali = [...karistir(adaylar.filter((e) => !dalisli.has(e.id))), ...karistir(adaylar.filter((e) => dalisli.has(e.id)))];
    const secilen = [], turler = new Set();
    for (const e of sirali) { if (secilen.length < 3 && !turler.has(e.tur)) { secilen.push(e); turler.add(e.tur); } }
    for (const e of sirali) { if (secilen.length < 3 && !secilen.includes(e)) secilen.push(e); }
    const kaliplar = [
      (e) => `${e.ad} için uydudan içine inen bir dalış`,
      (e) => `${e.ad} için tarihçesini öne çıkaran kısa bir dalış`,
      (e) => `${e.ad} için ayrıntılarını gezdiren bir dalış`,
    ];
    return { oneriler: secilen.map((e, i) => ({ eser: e.id, metin: kaliplar[i % kaliplar.length](e) })) };
  });
  // Usta da dalış hazırlatabilir; dalış "bekliyor" olarak kaydedilir, yayın admin onayıyla olur. Usta mevcut bir dalışın
  // (yayındaki ya da onay bekleyen) üzerine yazamaz.
  app.post("/api/dalis-kalfasi", { preHandler: [ustaGerekli, kalfaSiniri] }, async (req, rep) => {
    const { istek, eser, uzerineYaz, oturum } = req.body ?? {};
    const admin = await editorMi(req);
    if (uzerineYaz && !admin) return rep.code(403).send({ hata: "Mevcut bir dalışın üzerine yalnızca admin yazabilir" });
    if (eser != null && !kimlikGecerli(eser)) return rep.code(400).send({ hata: "geçersiz eser kimliği" });
    if (istek != null && (typeof istek !== "string" || istek.length > 1000)) return rep.code(400).send({ hata: "istek en fazla 1000 harf" });
    if (!eser && !String(istek ?? "").trim()) return rep.code(400).send({ hata: "Kalfaya ne istediğini yaz" });
    if (oturum != null && !atolyeKimligiGecerli(oturum)) return rep.code(400).send({ hata: "geçersiz oturum kimliği" });
    const sahip = oturum != null ? await atolyeSahibi(req) : null;
    if (oturum != null) {
      try { await atolye.getir(sahip, oturum); } catch (h) { return rep.code(h.kod ?? 500).send({ hata: h.message }); }
    }
    try {
      const is = dalisKalfasi.baslat({ istek: istek ?? "", eserId: eser ?? null, uzerineYaz: !!uzerineYaz, korunanlar: admin ? ["onayli"] : ["onayli", "bekliyor"] });
      // Studio sayfası yenilense de dalışın ilerlemesi sohbetten yeniden izlenebilsin.
      if (oturum != null) await atolye.dalisEkle(sahip, oturum, { istek: istek || eser, is: is.id }).catch((h) => req.log.warn(h, "dalış oturuma yazılamadı"));
      return { is: is.id };
    } catch (h) {
      return rep.code(h.kod ?? 500).send({ hata: h.message });
    }
  });
  app.get("/api/dalis-kalfasi/:id", async (req, rep) => {
    const is = dalisKalfasi.is(req.params.id);
    if (!is) return rep.code(404).send({ hata: "iş bulunamadı" });
    const { id, istek, eser, ad, durum, adim, toplamAdim, gunluk, hata, sonuc } = is;
    return { id, istek, eser, ad, durum, adim, toplamAdim, gunluk, hata, sonuc };
  });

  // Kalfanın ürettiği kodlar: sha256 özeti → { model, tarih }. POST /api/moduller gelen kodu burada bulursa
  // kayda kaynak: { tur: "kalfa", … } yazar; böylece "bu modülü kalfa yazdı" bilgisi istemcinin beyanına değil
  // sunucunun kendi kaydına dayanır. Studio'da elle değiştirilen kod "elle" sayılır.
  const kalfaUretimleri = new Map();
  const kodOzeti = (kod) => createHash("sha256").update(String(kod).replace(/\r\n/g, "\n")).digest("hex");
  function kalfaUretiminiKaydet(sonuc) {
    kalfaUretimleri.set(kodOzeti(sonuc.kod), { model: sonuc.model ?? kalfa.model, sahte: sonuc.model === "sahte", tarih: new Date().toISOString(),
      ...(sonuc.disKaynaklar?.length && { disKaynaklar: sonuc.disKaynaklar }) });
    while (kalfaUretimleri.size > 200) kalfaUretimleri.delete(kalfaUretimleri.keys().next().value);
  }
  function kaynakBul(kod, onceki) {
    const uretim = kalfaUretimleri.get(kodOzeti(kod));
    if (uretim) return { tur: "kalfa", model: uretim.model, ...(uretim.sahte && { sahte: true }), uretim: uretim.tarih, ...(uretim.disKaynaklar && { disKaynaklar: uretim.disKaynaklar }) };
    // Aynı kod yeniden gönderildiyse (ör. sunucu yeniden başladıktan sonra) önceki kaynak korunur.
    if (onceki?.kaynak?.ozet === kodOzeti(kod)) return onceki.kaynak;
    return { tur: "elle" };
  }

  app.get("/api/kalfa", async () => ({ model: kalfa.model, sahte: kalfa.sahte }));

  // Kalfa modelleri: UstaGPT'nin model listesi (sunucu çağırır, anahtar tarayıcıya gitmez) ve şu anki seçim.
  const secimGoster = () => etkinSecim(ortam);
  app.get("/api/kalfa/modeller", { preHandler: editorGerekli }, async (req, rep) => {
    try {
      const { modeller, zaman } = await modelKatalogum.liste({ yenile: req.query?.yenile === "1" });
      const tarama = await modelTaramasi.durum();
      return {
        modeller: saglikEkle(modeller, tarama.sonuclar), guncelleme: new Date(zaman).toISOString(), secili: secimGoster(),
        tarama: { calisiyor: tarama.calisiyor, ilerleme: tarama.ilerleme, guncelleme: tarama.guncelleme },
      };
    } catch (h) {
      return rep.code(h.kod ?? 502).send({ hata: h.message, secili: secimGoster() });
    }
  });
  // Model taraması: her metin modeline gerçek bir kalfa isteği gönderir (dakikalar sürer; Studio GET ile izler).
  app.get("/api/kalfa/modeller/tara", { preHandler: editorGerekli }, async () => modelTaramasi.durum());
  app.post("/api/kalfa/modeller/tara", { preHandler: editorGerekli }, async (req, rep) => {
    const bicim = kalfaTaramaDogrula(req.body);
    if (bicim.hatalar.length) return rep.code(400).send({ hata: bicim.hatalar[0], ayrintilar: bicim.hatalar });
    if (!kalfa.ustagpt) return rep.code(409).send({ hata: "Modül kalfası UstaGPT'ye bağlı değil (sahte mod ya da başka bir uç nokta); tarama yalnızca UstaGPT modelleri için yapılır" });
    if (modelTaramasi.calisiyor) return rep.code(409).send({ hata: "Bir model taraması zaten sürüyor", ...(await modelTaramasi.durum()) });
    let modeller;
    try { ({ modeller } = await modelKatalogum.liste()); }
    catch (h) { return rep.code(h.kod ?? 502).send({ hata: h.message }); }
    const { hatalar, liste } = kalfaTaramaDogrula(req.body, modeller);
    if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
    const hedef = liste ?? modeller.filter((m) => m.tur === "metin").map((m) => m.deger);
    const { ilerleme } = modelTaramasi.baslat(hedef);
    req.log.info({ adet: hedef.length }, "kalfa model taraması başladı");
    return rep.code(202).send({ calisiyor: true, ilerleme });
  });
  app.put("/api/kalfa/ayarlar", { preHandler: editorGerekli }, async (req, rep) => {
    const bicim = kalfaAyarDogrula(req.body);
    if (bicim.hatalar.length) return rep.code(400).send({ hata: bicim.hatalar[0], ayrintilar: bicim.hatalar });
    let modeller;
    try { ({ modeller } = await modelKatalogum.liste()); }
    catch (h) { return rep.code(h.kod ?? 502).send({ hata: h.message }); }
    const { hatalar, ayar } = kalfaAyarDogrula(req.body, modeller);
    if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
    const kayitli = { ...(await kalfaAyarDosyasi.oku()) };
    for (const [k, v] of Object.entries(ayar)) { if (v === null) delete kayitli[k]; else kayitli[k] = v; }
    await kalfaAyarDosyasi.yaz(kayitli);
    req.log.info({ ayar }, "kalfa model seçimi güncellendi");
    return { secili: secimGoster() };
  });
  // ---------- Atölye oturumları (Studio: kalfa sohbeti + modül taslağı, kullanıcı başına) ----------
  const atolyeHatasi = (rep, h) => rep.code(h.kod ?? 500).send({ hata: h.message });
  const oturumKimligi = (req, rep) => {
    if (atolyeKimligiGecerli(req.params.id)) return true;
    rep.code(400).send({ hata: "geçersiz oturum kimliği" });
    return false;
  };
  app.get("/api/atolye/oturumlar", { preHandler: ustaGerekli }, async (req) => ({ oturumlar: await atolye.liste(await atolyeSahibi(req)) }));
  app.post("/api/atolye/oturumlar", { preHandler: ustaGerekli }, async (req, rep) => {
    let taslak = null;
    if (req.body?.taslak != null) {
      const d = atolyeTaslakDogrula(req.body.taslak);
      if (d.hatalar.length) return rep.code(400).send({ hata: d.hatalar[0], ayrintilar: d.hatalar });
      taslak = d.taslak;
    }
    return rep.code(201).send(await atolye.olustur(await atolyeSahibi(req), { taslak }));
  });
  app.get("/api/atolye/oturumlar/:id", { preHandler: ustaGerekli }, async (req, rep) => {
    if (!oturumKimligi(req, rep)) return rep;
    try { return await atolye.getir(await atolyeSahibi(req), req.params.id); } catch (h) { return atolyeHatasi(rep, h); }
  });
  app.put("/api/atolye/oturumlar/:id/taslak", { preHandler: ustaGerekli }, async (req, rep) => {
    if (!oturumKimligi(req, rep)) return rep;
    const d = atolyeTaslakDogrula(req.body);
    if (d.hatalar.length) return rep.code(400).send({ hata: d.hatalar[0], ayrintilar: d.hatalar });
    try { return await atolye.taslakYaz(await atolyeSahibi(req), req.params.id, d.taslak); } catch (h) { return atolyeHatasi(rep, h); }
  });
  app.delete("/api/atolye/oturumlar/:id", { preHandler: ustaGerekli }, async (req, rep) => {
    if (!oturumKimligi(req, rep)) return rep;
    try { return await atolye.sil(await atolyeSahibi(req), req.params.id); } catch (h) { return atolyeHatasi(rep, h); }
  });

  // Kalfa. "oturum" verilirse sohbet sunucudaki oturumdan kurulur ve yanıt (istemci beklemeyi bıraksa da) oturuma yazılır;
  // verilmezse eski biçim: sohbet istekle gelir, hiçbir şey saklanmaz.
  // Boş sohbetteki örnek fikirler: her açılışta bilgi bankasındaki eserlerden yeniden kurulur (yapay zekâ çağrısı yok).
  app.get("/api/kalfa/oneriler", { preHandler: ustaGerekli }, async (req) => ({ oneriler: kalfa.baslangicOnerileri(req.query.dil === "en" ? "en" : "tr") }));
  app.post("/api/kalfa", { preHandler: [ustaGerekli, kalfaSiniri] }, async (req, rep) => {
    if (req.body?.oturum != null) {
      const { oturum, istek, kod, dil, izin } = req.body;
      if (!atolyeKimligiGecerli(oturum)) return rep.code(400).send({ hata: "geçersiz oturum kimliği" });
      const hatalar = [...atolyeIstekDogrula({ istek, kod, dil }), ...izinKarariDogrula(izin)];
      if (hatalar.length) return rep.code(400).send({ hata: hatalar[0], ayrintilar: hatalar });
      // Dış kaynak (Vikipedi) ve bilgi bankasına ekleme yalnızca admin'in kalfasında; izin kartını da yalnızca admin yanıtlar.
      const admin = await editorMi(req);
      if (izin && !admin) return rep.code(403).send({ hata: "İzin kartlarını yalnızca admin yanıtlayabilir" });
      const sahip = await atolyeSahibi(req);
      let sohbet, kalfaDurumu;
      try { ({ sohbet, kalfaDurumu } = await atolye.kalfaBaslat(sahip, oturum, { istek: istek.trim(), kod: kod ?? null, izin: izin ?? null })); }
      catch (h) { return atolyeHatasi(rep, h); }
      try {
        const sonuc = await kalfa.calistir(sohbet, kod || undefined, { dil: dil ?? "tr", admin, izinDurumu: admin ? kalfaDurumu : null });
        if (sonuc.kod) kalfaUretiminiKaydet(sonuc);
        await atolye.kalfaBitir(sahip, oturum, { sonuc });
        const { kalfaDurumu: _durum, ...yanit } = sonuc;
        return { ...yanit, istek: sohbet.at(-1).metin };
      } catch (h) {
        req.log.error(h);
        await atolye.kalfaBitir(sahip, oturum, { hata: h.message, ayrintilar: h.ayrintilar ?? [], kalfaDurumu: h.kalfaDurumu }).catch(() => {});
        return rep.code(502).send({ hata: h.message, ayrintilar: h.ayrintilar ?? [] });
      }
    }
    const { sohbet, kod, dil } = req.body ?? {};
    if (dil != null && dil !== "tr" && dil !== "en") return rep.code(400).send({ hata: "dil: tr | en" });
    const gecerli = Array.isArray(sohbet) && sohbet.length > 0 && sohbet.length <= 30 &&
      sohbet.every((m) => (m?.rol === "usta" || m?.rol === "kalfa") && typeof m.metin === "string" && m.metin.length <= 4000) &&
      sohbet.at(-1).rol === "usta";
    if (!gecerli) return rep.code(400).send({ hata: "sohbet: en fazla 30 mesaj, son mesaj ustadan" });
    if (kod != null && (typeof kod !== "string" || kod.length > MAKS_KOD)) return rep.code(400).send({ hata: "kod çok uzun" });
    try {
      const sonuc = await kalfa.calistir(sohbet, kod || undefined, { dil: dil ?? "tr" });
      if (sonuc.kod) kalfaUretiminiKaydet(sonuc);
      return sonuc;
    } catch (h) {
      req.log.error(h);
      return rep.code(502).send({ hata: h.message, ayrintilar: h.ayrintilar ?? [] });
    }
  });

  app.addHook("onSend", async (req, rep, govde) => {
    rep.header("x-content-type-options", "nosniff");
    rep.header("referrer-policy", "strict-origin-when-cross-origin");
    if (req.url.startsWith("/studio")) rep.header("x-robots-tag", "noindex");
    return govde;
  });

  return { app, kalfa, dalisKalfasi, modelTaramasi, yetki, erisim, eserler };
}
