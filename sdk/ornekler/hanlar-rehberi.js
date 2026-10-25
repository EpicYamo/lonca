import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";


const BASARIMLAR = [
  { id: "ilk-han", ad: "Kervan Yolunda", aciklama: "İlk hanını incele." },
  { id: "uc-han", ad: "Tüccar", aciklama: "3 farklı han incele." },
  { id: "hepsi", ad: "Hanlar Ağası", aciklama: "Bütün hanları incele." },
  { id: "gezgin", ad: "Yol Bilen", aciklama: "Bir hanı haritada ya da gerçek 3B'de bul." },
];

const KAVRAMLAR = [
  { id: "avlu", metin: "Avlu", alt: "Odaların çevrelediği açık orta alan; hem ışık hem ortak yaşam yeri." },
  { id: "revak", metin: "Revak", alt: "Avluya bakan, kemerli ve üstü örtülü geçitler." },
  { id: "mescit", metin: "Avlu mescidi", alt: "Bazı hanlarda avlunun ortasında yükselen küçük ibadet yeri." },
];

export default async function basla() {
  const hanlar = await eserler.liste({ il: "Bursa", tur: "han" });
  await basarim.tanimla(BASARIMLAR);
  const incelenen = new Set((await depo.oku("incelenen")) ?? []);
  let rozetler = await basarim.liste();

  /** @type {{ ad: string, han?: any, uc?: boolean }[]} */
  let yigin = [{ ad: "kapak" }];
  const simdiki = () => yigin[yigin.length - 1];
  const git = (ekranAdi, ek = {}) => yigin.push({ ad: ekranAdi, ...ek });
  const geri = () => { if (yigin.length > 1) yigin.pop(); };

  await sahne.ayarla({ baslik: "Bursa Hanları", tema: { zemin: "parsomen", renk: "altin" } });
  const ciz = () => sahne.ciz(arayuz());
  await ciz();

  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "dokun") {
      if (olay.id === "geri") geri();
      else if (olay.id === "kesfet") git("liste");
      else if (olay.id === "koleksiyon") { rozetler = await basarim.liste(); git("koleksiyon"); }
      else if (olay.id === "han" && olay.eser) await hanAc(olay.eser);
      else if (olay.id === "uc" && simdiki().han) await ucGezisi(simdiki().han);
      else if (olay.id === "konum") await basarim.kazan("gezgin");
      else if (olay.id === "hata" && simdiki().han) await ekran.duzeltme(simdiki().han);
    }
    await ciz();
  }

  async function hanAc(han) {
    git("han", { han, uc: await ekran.ucVarMi(han) });
    if (!incelenen.has(han.id)) {
      incelenen.add(han.id);
      await depo.yaz("incelenen", [...incelenen]);
      await profil.puanEkle(10, "Yeni han");
    }
    await basarim.kazan("ilk-han");
    if (incelenen.size >= 3) await basarim.kazan("uc-han");
    if (hanlar.every((h) => incelenen.has(h.id))) { await basarim.kazan("hepsi"); await sahne.efekt("konfeti"); }
  }

  async function ucGezisi(han) {
    const r = await ekran.uc({
      eser: han, baslik: han.ad,
      duraklar: [
        { odak: "genel", metin: "Hanın bugünkü hâli ve çevresi. Parmağınla çevir, iki parmakla yaklaş." },
        { odak: "yakin", metin: "Yakından: dış duvarlar ve giriş cephesi." },
        { odak: "ust", metin: "Kuşbakışı: odaların avlu çevresine dizilişi buradan görülür." },
      ],
    });
    if (r.acildi) await basarim.kazan("gezgin");
  }

  function arayuz() {
    const e = simdiki();
    if (e.ad === "liste") return listeEkrani();
    if (e.ad === "han") return hanEkrani(e.han);
    if (e.ad === "koleksiyon") return koleksiyonEkrani();
    return kapakEkrani();
  }

  function kapakEkrani() {
    const kapakHani = hanlar.find((h) => h.fotograflar.length) ?? hanlar[0];
    return {
      tip: "kapak", ust: "Bursa · İpek Yolu", baslik: "Hanlar Şehri",
      alt: `Kervanların konakladığı ${hanlar.length} handa gezinti. İncelediğin her han koleksiyonuna eklenir.`,
      eser: kapakHani, renk: "altin",
      cocuklar: [
        { tip: "dugme", id: "kesfet", metin: "Keşfe başla", ikon: "pusula" },
        { tip: "dugme", id: "koleksiyon", metin: `Koleksiyonum (${incelenen.size}/${hanlar.length})`, ikon: "kupa", tur: "ikincil" },
      ],
    };
  }

  function listeEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Hanlar", alt: `${incelenen.size}/${hanlar.length} incelendi`, geri: "geri" },
        { tip: "ilerleme", deger: incelenen.size, toplam: hanlar.length, etiket: "Koleksiyon" },
        { tip: "izgara", sutun: 2, cocuklar: hanlar.map((h) => ({ tip: "eser", eser: h, id: "han", boyut: "kucuk" })) },
      ],
    };
  }

  function hanEkrani(han) {
    const paragraflar = han.tarihce.tr.split(/\n+/).filter(Boolean);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: han.ad, alt: han.ilce ?? "Bursa", geri: "geri" },
        { tip: "fotograflar", eser: han },
        { tip: "cipler", ogeler: [han.yuzyil ? `${han.yuzyil}. yüzyıl` : "Yapım tarihi belirsiz", incelenen.has(han.id) ? "Koleksiyonda" : "Yeni"] },
        ...paragraflar.slice(0, 4).map((p) => ({ tip: "metin", metin: p })),
        simdiki().uc ? { tip: "dugme", id: "uc", metin: "Gerçek 3B gez", ikon: "kup" } : { tip: "bosluk" },
        han.konum ? { tip: "harita", id: "konum", eserler: [han], secili: han.id } : { tip: "bosluk" },
        { tip: "baslik", metin: "Hanları tanı", boyut: 3 },
        { tip: "liste", ogeler: KAVRAMLAR.map((k) => ({ ...k, ikon: "bilgi" })) },
        { tip: "metin", metin: han.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", tur: "hayalet", ikon: "bilgi" },
      ],
    };
  }

  function koleksiyonEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Koleksiyonum", geri: "geri" },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: incelenen.size, etiket: "han", ikon: "kup" },
          { tip: "istatistik", deger: hanlar.length - incelenen.size, etiket: "kalan", ikon: "pusula" },
          { tip: "istatistik", deger: Math.round((incelenen.size / Math.max(1, hanlar.length)) * 100) + "%", etiket: "tamam", ikon: "yildiz" },
        ] },
        { tip: "baslik", metin: "Başarımlar", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
      ],
    };
  }
}
