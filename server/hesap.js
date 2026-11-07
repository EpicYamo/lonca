// Hesaplar: vatandaş / usta / editör. Kayıtlar data/kullanicilar.json'da (gitignore'da), şifreler scrypt özeti.
import { randomBytes } from "node:crypto";
import { jsonDosya } from "./depo.js";
import { sifreOzetle, sifreDogrula, sifreDogrulaYoksa } from "./guvenlik.js";
import { ROLLER, PROFIL_RENKLERI, kullaniciAdiDuzelt, epostaDuzelt, epostaGecerli } from "./dogrulama.js";

const MAKS_BASARIM_BOYUTU = 50_000;

export function hesaplarKur(dosyaYolu) {
  const dosya = jsonDosya(dosyaYolu, []);

  const kimlikleBul = async (kimlik) => (await dosya.oku()).find((h) => h.kimlik === kullaniciAdiDuzelt(kimlik)) ?? null;
  const idIle = async (id) => (await dosya.oku()).find((h) => h.id === id) ?? null;
  const epostaylaBul = async (eposta) => (await dosya.oku()).find((h) => h.eposta && h.eposta === epostaDuzelt(eposta)) ?? null;
  const yeniKayit = (alanlar) => {
    const zaman = new Date().toISOString();
    return {
      id: randomBytes(8).toString("hex"), profil: { ad: "Gezgin", renk: "kobalt", puan: 0 }, basarimlar: {},
      olusturma: zaman, guncelleme: zaman, ...alanlar,
    };
  };

  // Girdi biçimi dogrulama.js'de (hesapGirdisiDogrula) denetlenir; burada yalnızca iş kuralları var.
  async function kayitOl({ kimlik, eposta, sifre, rol = "vatandas" }) {
    if (!ROLLER.includes(rol)) return { hata: "geçersiz rol" };
    const liste = await dosya.oku();
    const k = kullaniciAdiDuzelt(kimlik);
    const e = epostaDuzelt(eposta);
    if (liste.some((h) => h.kimlik === k)) return { hata: "Bu kullanıcı adı alınmış; başka bir ad dene." };
    if (liste.some((h) => h.eposta === e)) return { hata: "Bu e-posta başka bir hesapta kayıtlı. Giriş yapmayı ya da Google ile devam etmeyi dene." };
    const hesap = yeniKayit({ kimlik: k, eposta: e, sifre: sifreOzetle(sifre), rol });
    liste.push(hesap);
    await dosya.yaz(liste);
    return { hesap };
  }

  // Kimlik kullanıcı adı ya da e-posta olabilir. Şifresiz (yalnızca Google'la açılmış) hesap şifreyle giremez.
  async function girisYap({ kimlik, sifre }) {
    const hesap = String(kimlik ?? "").includes("@") ? await epostaylaBul(kimlik) : await kimlikleBul(kimlik);
    const dogru = hesap?.sifre ? sifreDogrula(sifre, hesap.sifre) : sifreDogrulaYoksa(sifre);
    return dogru ? { hesap } : { hata: "Kullanıcı adı, e-posta ya da şifre yanlış." };
  }

  // E-postanın yerel kısmından boş bir kullanıcı adı türetir (ayse.yilmaz, ayse.yilmaz2 …).
  function kimlikTuret(eposta, liste) {
    const kok = (epostaDuzelt(eposta).split("@")[0].replace(/[^a-z0-9_.-]/g, "").slice(0, 28) || "gezgin").padEnd(3, "0");
    for (let i = 1; ; i++) {
      const aday = i === 1 ? kok : `${kok}${i}`;
      if (!liste.some((h) => h.kimlik === aday)) return aday;
    }
  }

  /**
   * Google ile giriş. Sıra: (1) bu Google hesabına bağlı hesap, (2) aynı e-postayla kayıtlı hesap (bağlanır),
   * (3) yeni usta hesabı. Google e-postayı doğrulamamışsa hiçbir hesaba bağlanmaz.
   * Hazır (ilk şifreli) hesap Google'a bağlanınca ortak ilk şifre geçersiz olur ve hesap yetkisini alır:
   * kimliği artık Google kanıtlıyor; şifre isterse sonra belirlenir.
   */
  async function googleIleGiris({ sub, eposta, epostaDogrulandi, ad }) {
    if (typeof sub !== "string" || !sub) return { hata: "Google hesabı okunamadı." };
    const liste = await dosya.oku();
    const bagli = liste.find((h) => h.google === sub);
    if (bagli) return { hesap: bagli };
    if (!epostaDogrulandi || !epostaGecerli(eposta)) return { hata: "Google hesabının e-postası doğrulanmamış." };
    const e = epostaDuzelt(eposta);
    const zaman = new Date().toISOString();
    const kayitli = liste.find((h) => h.eposta === e);
    if (kayitli) {
      kayitli.google = sub;
      if (kayitli.sifreDegismeli) { delete kayitli.sifreDegismeli; kayitli.sifre = null; }
      kayitli.guncelleme = zaman;
      await dosya.yaz(liste);
      return { hesap: kayitli, baglandi: true };
    }
    const hesap = yeniKayit({ kimlik: kimlikTuret(e, liste), eposta: e, sifre: null, google: sub, rol: "usta" });
    const temizAd = String(ad ?? "").trim().slice(0, 24);
    if (temizAd) hesap.profil.ad = temizAd;
    liste.push(hesap);
    await dosya.yaz(liste);
    return { hesap, yeni: true };
  }

  // Hazır hesaplar (ILK_KULLANICILAR + ILK_SIFRE): yalnızca eksik olanlar editör olarak açılır, var olana dokunulmaz.
  // İlk şifreyle açılan hesap, şifresini değiştirene kadar yetki almaz (sifreDegismeli).
  async function tohumla(kimlikler, ilkSifre) {
    if (!ilkSifre) return [];
    const liste = await dosya.oku();
    const zaman = new Date().toISOString();
    const eklenen = [];
    for (const k of kimlikler.map(kullaniciAdiDuzelt).filter(Boolean)) {
      if (liste.some((h) => h.kimlik === k)) continue;
      liste.push({
        id: randomBytes(8).toString("hex"), kimlik: k, sifre: sifreOzetle(ilkSifre), rol: "editor", sifreDegismeli: true,
        profil: { ad: k, renk: "kobalt", puan: 0 }, basarimlar: {},
        olusturma: zaman, guncelleme: zaman,
      });
      eklenen.push(k);
    }
    if (eklenen.length) await dosya.yaz(liste);
    return eklenen;
  }

  // İlk şifre değişiminde eski şifre istenmez (oturum zaten ilk şifreyle açıldı); sonrakilerde istenir.
  async function sifreDegistir(id, { eskiSifre, yeniSifre }) {
    const h = await idIle(id);
    if (!h) return { hata: "hesap bulunamadı", kod: 404 };
    if (h.sifre && !h.sifreDegismeli && !sifreDogrula(eskiSifre ?? "", h.sifre)) return { hata: "Mevcut şifre yanlış.", kod: 403 };
    if (h.sifre && sifreDogrula(yeniSifre, h.sifre)) return { hata: "Yeni şifre eskisiyle aynı olamaz.", kod: 400 };
    const yeni = await guncelle(id, (x) => { x.sifre = sifreOzetle(yeniSifre); delete x.sifreDegismeli; });
    return { hesap: yeni };
  }

  async function guncelle(id, degistirici) {
    const liste = await dosya.oku();
    const h = liste.find((x) => x.id === id);
    if (!h) return null;
    degistirici(h);
    h.guncelleme = new Date().toISOString();
    await dosya.yaz(liste);
    return h;
  }

  // E-posta ekleme/değiştirme: başka bir hesapta kayıtlıysa reddedilir. Google'a bağlı hesabın e-postası değişmez
  // (giriş zaten Google'ın kimliğiyle; e-posta yalnızca bağlama içindir).
  async function epostaAyarla(id, eposta) {
    const e = epostaDuzelt(eposta);
    if (!epostaGecerli(e)) return { hata: "Geçerli bir e-posta adresi yaz", kod: 400 };
    const liste = await dosya.oku();
    const h = liste.find((x) => x.id === id);
    if (!h) return { hata: "hesap bulunamadı", kod: 404 };
    if (h.eposta === e) return { hesap: h };
    if (h.google) return { hata: "Google'a bağlı hesabın e-postası değiştirilemez.", kod: 409 };
    if (liste.some((x) => x.id !== id && x.eposta === e)) return { hata: "Bu e-posta başka bir hesapta kayıtlı.", kod: 409 };
    return { hesap: await guncelle(id, (x) => { x.eposta = e; }) };
  }

  const profilGuncelle = (id, { ad, renk } = {}) => guncelle(id, (h) => {
    if (ad != null) h.profil.ad = String(ad).trim().slice(0, 24) || h.profil.ad;
    if (renk != null && PROFIL_RENKLERI.includes(renk)) h.profil.renk = renk;
  });

  const rolDegistir = (id, rol) => (ROLLER.includes(rol) ? guncelle(id, (h) => { h.rol = rol; }) : Promise.resolve(null));

  // Cihazdaki (localStorage) profili sunucudaki hesaba taşır; yalnızca hesapta henüz veri yoksa (üzerine yazmaz).
  const cihazdanTasi = (id, { profil, basarimlar } = {}) => guncelle(id, (h) => {
    if ((h.profil.puan ?? 0) !== 0 || Object.keys(h.basarimlar ?? {}).length !== 0) return;
    if (profil?.ad != null) h.profil.ad = String(profil.ad).trim().slice(0, 24) || h.profil.ad;
    if (profil?.renk != null && PROFIL_RENKLERI.includes(profil.renk)) h.profil.renk = profil.renk;
    if (Number.isFinite(profil?.puan)) h.profil.puan = Math.max(0, Math.min(Number(profil.puan), 100_000));
    if (basarimlar && typeof basarimlar === "object" && !Array.isArray(basarimlar) && JSON.stringify(basarimlar).length <= MAKS_BASARIM_BOYUTU) {
      h.basarimlar = basarimlar;
    }
  });

  const disaAcik = (h) => h && { id: h.id, kimlik: h.kimlik, rol: h.rol, profil: h.profil, basarimlar: h.basarimlar ?? {}, sifreDegismeli: !!h.sifreDegismeli,
    eposta: h.eposta ?? null, google: !!h.google, sifreVar: !!h.sifre };

  return { kimlikleBul, idIle, epostaylaBul, kayitOl, girisYap, googleIleGiris, epostaAyarla, tohumla, sifreDegistir, profilGuncelle, rolDegistir, cihazdanTasi, disaAcik };
}
