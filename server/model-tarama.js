// Kalfa modellerinin sağlık taraması.
//
// UstaGPT'de çok sayıda model var; bazıları belirli anlarda hiç yanıt vermiyor (503, zaman aşımı) ya da
// yanıt verse de kalfanın tip denetiminden geçen bir modül yazamıyor. Tarama her metin modeline GERÇEK bir
// kalfa isteği gönderir (aynı sistem istemi, araçlar ve doğrulama) ve sonucu data/kalfa-model-durumu.json'a
// yazar (çalışma verisi, gitignore'da). Studio'nun model seçicisi bu sonuçları gösterir.
//
// Sonuç kaydı: { durum: "calisiyor" | "hata", sure (ms), deneme, tarih, satir?, hata? }

export const TARAMA_FIKRI = "Bursa çeşmelerini tanıtan, puanlı kısa bir bilgi yarışması";
export const MODEL_ZAMAN_ASIMI_MS = 5 * 60_000;
export const PARALEL = 4;

/** Hata nesnesinden Studio'da gösterilecek kısa açıklama (anahtar ya da uzun gövde içermez). */
export function hataOzeti(h) {
  const mesaj = String(h?.message ?? h ?? "bilinmeyen hata");
  if (h?.modelZamanAsimi) return `zaman aşımı (${Math.round(h.modelZamanAsimi / 60_000)} dk)`;
  if (h?.zamanAsimi || /zaman aşımı/i.test(mesaj)) return "zaman aşımı (sağlayıcı yanıt vermedi)";
  if (h?.durumKodu === 429) return "429 · istek kotası doldu";
  if (h?.durumKodu) return `${h.durumKodu} · ${mesaj.replace(/^Yapay zekâ sağlayıcısı hata verdi \(\d+\):\s*/, "")}`.slice(0, 160);
  if (Array.isArray(h?.ayrintilar) && h.ayrintilar.length) return `doğrulama: ${h.ayrintilar[0]}`.slice(0, 160);
  return mesaj.slice(0, 160);
}

/** Tek bir modeli gerçek bir kalfa isteğiyle dener. Hiçbir zaman fırlatmaz; sonuç kaydını döndürür. */
export async function modelDene(kalfa, model, { fikir = TARAMA_FIKRI, zamanAsimiMs = MODEL_ZAMAN_ASIMI_MS, simdi = () => new Date() } = {}) {
  const baslangic = Date.now();
  const iptal = new AbortController();
  const sayac = setTimeout(() => iptal.abort(Object.assign(new Error("model zaman aşımı"), { modelZamanAsimi: zamanAsimiMs })), zamanAsimiMs);
  try {
    const y = await kalfa.calistir([{ rol: "usta", metin: fikir }], undefined, { model, sinyal: iptal.signal });
    return { durum: "calisiyor", sure: Date.now() - baslangic, deneme: y.deneme ?? null, satir: String(y.kod ?? "").split("\n").length, tarih: simdi().toISOString() };
  } catch (h) {
    return { durum: "hata", sure: Date.now() - baslangic, hata: hataOzeti(h), tarih: simdi().toISOString() };
  } finally {
    clearTimeout(sayac);
  }
}

/** Çalışanlar önce (hızlıdan yavaşa), sonra denenmemişler, en sonda hata verenler. Sıra kararlıdır. */
export function sagligaGoreSirala(modeller, sonuclar = {}) {
  const sira = (m) => {
    const s = m.tur === "metin" ? sonuclar[m.deger] : null;
    return s?.durum === "calisiyor" ? 0 : s?.durum === "hata" ? 2 : 1;
  };
  return modeller
    .map((m, i) => ({ m, i }))
    .sort((a, b) => sira(a.m) - sira(b.m) ||
      (sira(a.m) === 0 ? sonuclar[a.m.deger].sure - sonuclar[b.m.deger].sure : 0) || a.i - b.i)
    .map(({ m }) => m);
}

/** Model listesine sağlık bilgisini ekler (yalnızca metin modelleri; görsel modeller kalfayla sınanmaz). */
export function saglikEkle(modeller, sonuclar = {}) {
  return sagligaGoreSirala(modeller, sonuclar).map((m) => {
    if (m.tur !== "metin") return m;
    const s = sonuclar[m.deger];
    return { ...m, saglik: s ? { ...s } : { durum: "denenmedi" } };
  });
}

/**
 * Arka planda çalışan tarama. Aynı anda tek tarama olur; her model bitince sonuç dosyaya yazılır
 * (önceki taramaların başka modellere ait sonuçları korunur).
 *   dosya: jsonDosya(..., { sonuclar: {} })
 */
export function modelTaramasiKur({ kalfa, dosya, paralel = PARALEL, zamanAsimiMs = MODEL_ZAMAN_ASIMI_MS, fikir = TARAMA_FIKRI, gunluk = null }) {
  let etkin = null; // { baslangic, modeller, suren: Set, biten, sonuc: Promise }
  let yazim = Promise.resolve();

  async function kaydet(model, sonuc) {
    // Okuma-yazma sırayla yapılır ki paralel biten modeller birbirinin sonucunu ezmesin.
    yazim = yazim.catch(() => {}).then(async () => {
      const kayit = await dosya.oku();
      const sonuclar = { ...(kayit?.sonuclar ?? {}), [model]: sonuc };
      await dosya.yaz({ guncelleme: sonuc.tarih, fikir, sonuclar });
    });
    return yazim;
  }

  async function calistir(modeller) {
    const kuyruk = [...modeller];
    const isci = async () => {
      while (kuyruk.length) {
        const model = kuyruk.shift();
        etkin.suren.add(model);
        const sonuc = await modelDene(kalfa, model, { fikir, zamanAsimiMs });
        etkin.suren.delete(model);
        etkin.biten++;
        await kaydet(model, sonuc);
        gunluk?.(model, sonuc);
      }
    };
    await Promise.all(Array.from({ length: Math.min(paralel, modeller.length) }, isci));
  }

  const ilerleme = () => etkin && {
    baslangic: etkin.baslangic, toplam: etkin.modeller.length, biten: etkin.biten, suren: [...etkin.suren],
  };

  return {
    /** { calisiyor, ilerleme, guncelleme, sonuclar } */
    async durum() {
      const kayit = await dosya.oku();
      return { calisiyor: !!etkin, ilerleme: ilerleme(), guncelleme: kayit?.guncelleme ?? null, sonuclar: kayit?.sonuclar ?? {} };
    },
    async sonuclar() { return (await dosya.oku())?.sonuclar ?? {}; },
    get calisiyor() { return !!etkin; },
    /** Taramayı başlatır ve hemen döner; bitişi beklemek için dönen nesnedeki `bitis` kullanılır. */
    baslat(modeller) {
      if (etkin) throw Object.assign(new Error("Bir model taraması zaten sürüyor"), { kod: 409 });
      if (!modeller.length) throw Object.assign(new Error("Taranacak model yok"), { kod: 400 });
      etkin = { baslangic: new Date().toISOString(), modeller: [...modeller], suren: new Set(), biten: 0 };
      const bitis = calistir(modeller).finally(() => { etkin = null; });
      bitis.catch(() => {});
      return { ilerleme: ilerleme(), bitis };
    },
  };
}
