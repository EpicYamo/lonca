// Hesaplar: vatandaş / usta / editör. Kayıtlar data/kullanicilar.json'da (gitignore'da), şifreler scrypt özeti.
import { randomBytes } from "node:crypto";
import { jsonDosya } from "./depo.js";
import { sifreOzetle, sifreDogrula, sifreDogrulaYoksa } from "./guvenlik.js";
import { ROLLER, PROFIL_RENKLERI, kullaniciAdiDuzelt } from "./dogrulama.js";

const MAKS_BASARIM_BOYUTU = 50_000;

export function hesaplarKur(dosyaYolu) {
  const dosya = jsonDosya(dosyaYolu, []);

  const kimlikleBul = async (kimlik) => (await dosya.oku()).find((h) => h.kimlik === kullaniciAdiDuzelt(kimlik)) ?? null;
  const idIle = async (id) => (await dosya.oku()).find((h) => h.id === id) ?? null;

  // Girdi biçimi dogrulama.js'de (hesapGirdisiDogrula) denetlenir; burada yalnızca iş kuralları var.
  async function kayitOl({ kimlik, sifre, rol = "vatandas" }) {
    if (!ROLLER.includes(rol)) return { hata: "geçersiz rol" };
    const liste = await dosya.oku();
    const k = kullaniciAdiDuzelt(kimlik);
    if (liste.some((h) => h.kimlik === k)) return { hata: "Bu kullanıcı adı alınmış; başka bir ad dene." };
    const zaman = new Date().toISOString();
    const hesap = {
      id: randomBytes(8).toString("hex"), kimlik: k, sifre: sifreOzetle(sifre), rol,
      profil: { ad: "Gezgin", renk: "kobalt", puan: 0 }, basarimlar: {},
      olusturma: zaman, guncelleme: zaman,
    };
    liste.push(hesap);
    await dosya.yaz(liste);
    return { hesap };
  }

  async function girisYap({ kimlik, sifre }) {
    const hesap = await kimlikleBul(kimlik);
    const dogru = hesap ? sifreDogrula(sifre, hesap.sifre) : sifreDogrulaYoksa(sifre);
    return dogru ? { hesap } : { hata: "Kullanıcı adı ya da şifre yanlış." };
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
    if (!h.sifreDegismeli && !sifreDogrula(eskiSifre ?? "", h.sifre)) return { hata: "Mevcut şifre yanlış.", kod: 403 };
    if (sifreDogrula(yeniSifre, h.sifre)) return { hata: "Yeni şifre eskisiyle aynı olamaz.", kod: 400 };
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

  const disaAcik = (h) => h && { id: h.id, kimlik: h.kimlik, rol: h.rol, profil: h.profil, basarimlar: h.basarimlar ?? {}, sifreDegismeli: !!h.sifreDegismeli };

  return { kimlikleBul, idIle, kayitOl, girisYap, tohumla, sifreDegistir, profilGuncelle, rolDegistir, cihazdanTasi, disaAcik };
}
