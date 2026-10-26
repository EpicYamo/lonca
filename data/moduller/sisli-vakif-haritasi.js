import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

/*
  Sisli Vakıf Haritası
  ------------------------------------------------------------------
  Harita sisle kaplıdır. Gezilen her eser çevresindeki 650 metreyi
  açar; yeni eserler yeni bölgeleri görünür kılar. Eserler arasındaki
  çizgiler uydurma değildir: sunucudaki küratörlü eser-iliskileri
  verisinden gelir (külliye, bani, mimar, vakıf, hanedan, metin,
  tarihî komşuluk).
*/

const IL = "Bursa";
const KAYIT = "sisli-vakif-haritasi-v3";
const BASLANGIC = "bursa-ulucami";
const GORUS_METRE = 650;
const BOLGE_ESIGI = 700;
const BASLANGIC_MUHUR = 3;
const YENI_ESER_PUANI = 12;

const BAG_ADI = {
  kulliye: "Aynı külliye",
  bani: "Aynı bani",
  mimar: "Aynı mimar",
  vakif: "Vakıf bağı",
  aile: "Hanedan / aile",
  metin: "Metinde anılıyor",
  komsu: "Tarihî komşuluk",
  tipoloji: "Mimari gelenek",
};

const TUR_ADI = {
  cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam",
  cesme: "Çeşme", turbe: "Türbe", kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü",
  tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane",
  sivil: "Sivil yapı", diger: "Yapı",
};

const BASARIMLAR = [
  { id: "ilk-sis", ad: "Sis Kalktı", aciklama: "İlk eseri haritada aç." },
  { id: "uc-bolge", ad: "Kartograf", aciklama: "Üç ayrı bölgede bir eser keşfet." },
  { id: "tam-bolge", ad: "Bölge Ustası", aciklama: "Bir bölgedeki bütün eserleri gez." },
  { id: "ag-kasifi", ad: "Bağ Kâşifi", aciklama: "Üç eserin tarihsel bağ ağını incele." },
  { id: "muhur-ustasi", ad: "Mühürdar", aciklama: "On mühür topla." },
  { id: "tum-harita", ad: "Haritanın Sahibi", aciklama: "Konumu bilinen bütün eserleri keşfet." },
];

const bagTuruAdi = (tur) => BAG_ADI[tur] ?? "Tarihsel bağ";
const turAdi = (tur) => TUR_ADI[tur] ?? "Yapı";
const kisalt = (metin, n) => {
  const m = metin == null ? "" : String(metin);
  return m.length > n ? `${m.slice(0, n - 1)}…` : m;
};

function mesafe(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function ortalama(liste) {
  const t = liste.reduce((acc, e) => ({ lat: acc.lat + e.konum.lat, lng: acc.lng + e.konum.lng }), { lat: 0, lng: 0 });
  return { lat: t.lat / liste.length, lng: t.lng / liste.length };
}

function bolgeleriKur(yerli) {
  const kumeler = [];
  for (const eser of yerli) {
    let enIyi = null;
    let enKisa = Infinity;
    for (const k of kumeler) {
      const d = mesafe(eser.konum, k.merkez);
      if (d < enKisa) { enKisa = d; enIyi = k; }
    }
    if (enIyi && enKisa <= BOLGE_ESIGI) {
      enIyi.eserler.push(eser);
      enIyi.merkez = ortalama(enIyi.eserler);
    } else {
      kumeler.push({ eserler: [eser], merkez: { lat: eser.konum.lat, lng: eser.konum.lng } });
    }
  }
  const bolgeler = kumeler.map((k) => {
    let capa = k.eserler[0];
    for (const eser of k.eserler) {
      if (mesafe(eser.konum, k.merkez) < mesafe(capa.konum, k.merkez)) capa = eser;
    }
    const sayac = {};
    for (const eser of k.eserler) if (eser.ilce) sayac[eser.ilce] = (sayac[eser.ilce] ?? 0) + 1;
    const ilce = Object.entries(sayac).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      id: "",
      ad: `${capa.ad} çevresi`,
      capa,
      ilce,
      merkez: k.merkez,
      eserler: k.eserler.slice().sort((a, b) => (a.yuzyil ?? 99) - (b.yuzyil ?? 99) || a.ad.localeCompare(b.ad, "tr")),
    };
  });
  bolgeler.sort((a, b) => b.eserler.length - a.eserler.length || a.capa.ad.localeCompare(b.capa.ad, "tr"));
  bolgeler.forEach((b, i) => { b.id = `b${i + 1}`; });
  return bolgeler;
}

export default async function basla() {
  const tum = await eserler.liste({ il: IL });
  const yerli = tum.filter((e) => e.konum && Number.isFinite(Number(e.konum.lat)) && Number.isFinite(Number(e.konum.lng)));
  const bolgeler = bolgeleriKur(yerli);
  const iliskiler = await eserler.iliskiler();
  const iliskiHaritasi = new Map();
  for (const i of iliskiler) {
    if (!iliskiHaritasi.has(i.a)) iliskiHaritasi.set(i.a, []);
    if (!iliskiHaritasi.has(i.b)) iliskiHaritasi.set(i.b, []);
    iliskiHaritasi.get(i.a).push(i);
    iliskiHaritasi.get(i.b).push(i);
  }

  await basarim.tanimla(BASARIMLAR);

  const kayit = (await depo.oku(KAYIT)) ?? {};
  const gecerliGezilen = Array.isArray(kayit.gezilen) ? kayit.gezilen.filter((id) => yerli.some((e) => e.id === id)) : [];
  const durum = {
    yigin: [{ ad: "kapak" }],
    gezilen: new Set(gecerliGezilen),
    agGezilen: new Set(Array.isArray(kayit.agGezilen) ? kayit.agGezilen : []),
    muhur: Number.isFinite(Number(kayit.muhur)) ? Number(kayit.muhur) : BASLANGIC_MUHUR,
    secili: null,
    rozetler: await basarim.liste(),
  };
  if (!durum.gezilen.size && bul(BASLANGIC)) durum.gezilen.add(BASLANGIC);

  await sahne.ayarla({ baslik: "Sisli Vakıf Haritası", tema: { zemin: "gece", renk: "firuze", yazi: "serif" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    await olayIsle(olay);
    await ciz();
  }

  function bul(id) {
    return tum.find((e) => e.id === id) ?? null;
  }

  function simdiki() {
    return durum.yigin[durum.yigin.length - 1];
  }

  function git(sayfa) {
    durum.yigin.push(sayfa);
  }

  function geri() {
    if (durum.yigin.length > 1) durum.yigin.pop();
  }

  function ciz() {
    return sahne.ciz(arayuz());
  }

  async function kaydet() {
    await depo.yaz(KAYIT, {
      gezilen: [...durum.gezilen],
      agGezilen: [...durum.agGezilen],
      muhur: durum.muhur,
    });
  }

  function gorunenler() {
    const gezilen = [...durum.gezilen].map(bul).filter(Boolean);
    if (!gezilen.length) return yerli.filter((e) => e.id === BASLANGIC);
    return yerli.filter((e) => gezilen.some((g) => mesafe(e.konum, g.konum) <= GORUS_METRE));
  }

  function gorunenIdler() {
    return new Set(gorunenler().map((e) => e.id));
  }

  function acikAlanlar() {
    return [...durum.gezilen].map(bul).filter(Boolean).map((e) => ({ lat: e.konum.lat, lng: e.konum.lng, yaricap: GORUS_METRE }));
  }

  function gorunenBaglar() {
    const idler = gorunenIdler();
    return iliskiler
      .filter((i) => idler.has(i.a) && idler.has(i.b))
      .map((i) => ({ a: i.a, b: i.b, tur: i.tur, etiket: i.baslik }));
  }

  function esereBaglar(id) {
    return (iliskiHaritasi.get(id) ?? [])
      .map((i) => ({ ...i, diger: bul(i.a === id ? i.b : i.a), yon: i.a === id ? "a" : "b" }))
      .filter((i) => i.diger);
  }

  async function basarimKontrol() {
    if (durum.gezilen.size >= 2) await basarim.kazan("ilk-sis");
    const acikBolgeler = bolgeler.filter((b) => b.eserler.some((e) => durum.gezilen.has(e.id))).length;
    if (acikBolgeler >= 3) await basarim.kazan("uc-bolge");
    if (bolgeler.some((b) => b.eserler.every((e) => durum.gezilen.has(e.id)))) await basarim.kazan("tam-bolge");
    if (durum.agGezilen.size >= 3) await basarim.kazan("ag-kasifi");
    if (durum.muhur >= 10) await basarim.kazan("muhur-ustasi");
    if (yerli.length && yerli.every((e) => durum.gezilen.has(e.id))) await basarim.kazan("tum-harita");
    durum.rozetler = await basarim.liste();
  }

  async function eserAc(eser) {
    if (!eser || !bul(eser.id)) return;
    const yerinde = yerli.some((e) => e.id === eser.id);
    const yeni = yerinde && !durum.gezilen.has(eser.id);
    if (yeni) {
      durum.gezilen.add(eser.id);
      durum.muhur += 1;
      await profil.puanEkle(YENI_ESER_PUANI, `${eser.ad} keşfedildi`);
      await sahne.bildir(`${eser.ad} sisin içinden çıktı. +1 mühür`);
    }
    if (esereBaglar(eser.id).length) durum.agGezilen.add(eser.id);
    durum.secili = eser.id;
    await kaydet();
    await basarimKontrol();
    if (simdiki().ad !== "eser" || simdiki().id !== eser.id) git({ ad: "eser", id: eser.id });
  }

  async function sisArala() {
    if (durum.muhur < 1) {
      await sahne.bildir("Mühür yok. Yeni eserler gezerek mühür kazan.");
      return;
    }
    const gorunen = gorunenIdler();
    const adaylar = yerli.filter((e) => !gorunen.has(e.id));
    if (!adaylar.length) {
      await sahne.bildir("Haritanın tamamı açıldı.");
      return;
    }
    const gezilen = [...durum.gezilen].map(bul).filter(Boolean);
    const secilen = adaylar
      .map((e) => ({ e, d: gezilen.length ? Math.min(...gezilen.map((g) => mesafe(e.konum, g.konum))) : 0 }))
      .sort((a, b) => a.d - b.d)[0].e;
    durum.muhur -= 1;
    durum.gezilen.add(secilen.id);
    durum.secili = secilen.id;
    await profil.puanEkle(5, "Sis aralandı");
    await sahne.bildir(`${secilen.ad} sisin içinden belirdi. Gezmek için dokun.`);
    await kaydet();
    await basarimKontrol();
  }

  async function olayIsle(olay) {
    if (olay.eser) {
      await eserAc(olay.eser);
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;
    if (id === "geri") { geri(); return; }
    if (id === "basla" || id === "harita") {
      durum.yigin = [{ ad: "harita" }];
      return;
    }
    if (id === "nasil") { git({ ad: "nasil" }); return; }
    if (id === "bolgeler") { git({ ad: "bolgeler" }); return; }
    if (id === "baglar") { git({ ad: "baglar" }); return; }
    if (id === "arala") { await sisArala(); return; }
    if (id === "haritada") {
      durum.yigin = [{ ad: "harita" }];
      return;
    }
    if (id === "hata") {
      const eser = durum.secili ? bul(durum.secili) : null;
      if (eser) await ekran.duzeltme(eser);
      return;
    }
    if (id.startsWith("eser:")) {
      const eser = bul(id.slice(5));
      if (eser) await eserAc(eser);
      return;
    }
    if (id.startsWith("bolge:")) { git({ ad: "bolge", id: id.slice(6) }); return; }
    if (id.startsWith("bag:")) { git({ ad: "bag", id: id.slice(4) }); return; }
  }

  function arayuz() {
    const sayfa = simdiki();
    if (sayfa.ad === "kapak") return kapakEkrani();
    if (sayfa.ad === "harita") return haritaEkrani();
    if (sayfa.ad === "bolgeler") return bolgelerEkrani();
    if (sayfa.ad === "bolge") return bolgeEkrani(sayfa.id);
    if (sayfa.ad === "baglar") return baglarEkrani();
    if (sayfa.ad === "eser") return eserEkrani(sayfa.id);
    if (sayfa.ad === "bag") return bagEkrani(sayfa.id);
    if (sayfa.ad === "nasil") return nasilEkrani();
    return kapakEkrani();
  }

  function kapakEkrani() {
    const kapakEser = bul(BASLANGIC) ?? yerli[0] ?? null;
    return {
      tip: "kapak",
      ust: "Bursa · Vakıf Eserleri",
      baslik: "Sisli Vakıf Haritası",
      alt: "Haritayı adım adım aç; eserler arasındaki külliye, bani, mimar ve vakıf bağlarını keşfet.",
      eser: kapakEser,
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Haritaya gir", ikon: "harita", tur: "ana" },
        { tip: "dugme", id: "nasil", metin: "Nasıl oynanır?", ikon: "bilgi", tur: "ikincil" },
      ],
    };
  }

  function haritaEkrani() {
    const gorunen = gorunenler();
    const acikBolge = bolgeler.filter((b) => b.eserler.some((e) => durum.gezilen.has(e.id))).length;
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Sisli Harita", alt: `${gorunen.length}/${yerli.length} eser görünür · ${acikBolge}/${bolgeler.length} bölge`, geri: "geri",
          sag: [{ id: "bolgeler", ikon: "liste", etiket: "Bölgeler" }, { id: "baglar", ikon: "yildiz", etiket: "Bağlar" }] },
        { tip: "harita", id: "harita", eserler: gorunen, secili: durum.secili,
          baglantilar: gorunenBaglar(), sis: { acik: acikAlanlar(), opaklik: 0.88 } },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "istatistik", deger: durum.gezilen.size, etiket: "Gezilen eser", ikon: "konum" },
          { tip: "istatistik", deger: durum.muhur, etiket: "Mühür", ikon: "yildiz" },
          { tip: "istatistik", deger: iliskiler.length, etiket: "Tarihsel bağ", ikon: "bilgi" },
        ] },
        { tip: "ilerleme", deger: durum.gezilen.size, toplam: yerli.length, etiket: "Haritanın sisini arala" },
        { tip: "metin", metin: "Çizgiler yalnızca envanterde açıkça belirtilen tarihsel bağlardır; ad benzerliğinden üretilmez. Bir esere dokun, bağlarını ve kaynağını gör. Küme işaretine dokununca harita yakınlaşır; bağ çizgileri belirginleşir.", soluk: true },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "arala", metin: "Sisi arala (1 mühür)", ikon: "pusula", tur: "ana", devre_disi: durum.muhur < 1 },
          { tip: "dugme", id: "bolgeler", metin: "Bölgeler", ikon: "liste", tur: "ikincil" },
          { tip: "dugme", id: "baglar", metin: "Bağlar", ikon: "bilgi", tur: "ikincil" },
        ] },
        { tip: "baslik", metin: "Çizgi renkleri", boyut: 3 },
        { tip: "cipler", ogeler: ["Altın: külliye", "Yeşil: vakıf", "Mavi: mimar", "Mor: bani", "Turuncu: hanedan", "Kesikli: metin / komşuluk"] },
      ],
    };
  }

  function bolgelerEkrani() {
    const idler = gorunenIdler();
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Bölgeler", alt: `${bolgeler.length} bölge · ${durum.gezilen.size}/${yerli.length} eser gezildi`, geri: "geri" },
        { tip: "metin", metin: "Bir bölgede gördüğün eser sayısı arttıkça sis o bölgede geri çekilir. Tamamlanan bölgeler haritada tamamen açılır.", soluk: true },
        { tip: "liste", ogeler: bolgeler.map((b) => {
          const gorunen = b.eserler.filter((e) => idler.has(e.id)).length;
          const gezilen = b.eserler.filter((e) => durum.gezilen.has(e.id)).length;
          const durumAdi = gorunen ? (gezilen === b.eserler.length ? "Tamamlandı" : `${gorunen}/${b.eserler.length} görünür`) : "Sisli";
          return { id: `bolge:${b.id}`, metin: b.ad, alt: `${b.eserler.length} eser · ${durumAdi}`, ikon: gorunen ? "harita" : "bilgi", sag: `${gezilen}/${b.eserler.length}` };
        }) },
        { tip: "dugme", id: "harita", metin: "Haritaya dön", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function bolgeEkrani(id) {
    const b = bolgeler.find((x) => x.id === id);
    if (!b) return haritaEkrani();
    const idler = gorunenIdler();
    const gorunen = b.eserler.filter((e) => idler.has(e.id));
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: b.ad, alt: `${gorunen.length}/${b.eserler.length} eser görünür · ${b.ilce ?? "Bursa"}`, geri: "geri" },
        { tip: "metin", metin: `Bölgenin çekirdeği ${b.capa.ad}. Buradaki eserleri gezerek çevredeki sisi geri çek.`, soluk: true },
        gorunen.length
          ? { tip: "liste", ogeler: gorunen.map((e) => ({ id: `eser:${e.id}`, metin: e.ad, alt: `${turAdi(e.tur)}${e.yuzyil ? ` · ${e.yuzyil}. yüzyıl` : ""}`, ikon: "konum", sag: durum.gezilen.has(e.id) ? "gezildi" : "yeni" })) }
          : { tip: "metin", metin: "Bu bölge hâlâ sisin içinde. Yakındaki bir eseri gezerek ya da “Sisi arala” ile aç." },
        { tip: "dugme", id: "harita", metin: "Haritaya dön", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function eserEkrani(id) {
    const eser = bul(id);
    if (!eser) return haritaEkrani();
    const baglar = esereBaglar(eser.id);
    const paragraflar = String(eser.tarihce?.tr ?? "").split(/\n+/).filter(Boolean);
    const cipler = [turAdi(eser.tur), eser.yuzyil ? `${eser.yuzyil}. yüzyıl` : null, eser.ilce, eser.konum?.yaklasik ? "konum yaklaşık" : null].filter(Boolean);
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: eser.ad, alt: `${turAdi(eser.tur)}${eser.yuzyil ? ` · ${eser.yuzyil}. yüzyıl` : ""}`, geri: "geri" },
        { tip: "fotograflar", eser },
        { tip: "cipler", ogeler: cipler },
        ...paragraflar.map((p, i) => ({ tip: "metin", metin: p, soluk: i > 2 })),
        { tip: "metin", metin: `Kaynak: ${eser.kaynak}`, soluk: true },
        { tip: "baslik", metin: "Tarihsel bağlar", boyut: 2 },
        baglar.length
          ? { tip: "graf", id: "eser-graf", merkez: eser, iliskiler: baglar.slice(0, 8).map((b) => ({ eser: b.diger, tur: b.tur, baslik: b.baslik })) }
          : { tip: "metin", metin: "Bu eser için küratörlü bir tarihsel bağ kaydı yok. Bağ uydurmuyoruz; yalnızca envanterde açıkça belirtilen ilişkileri gösteriyoruz.", soluk: true },
        baglar.length
          ? { tip: "liste", ogeler: baglar.map((b) => ({ id: `bag:${b.id}`, metin: b.diger.ad, alt: `${bagTuruAdi(b.tur)} · ${b.baslik}`, ikon: "bilgi", sag: b.diger.konum ? "haritada" : "konum yok" })) }
          : null,
        { tip: "baslik", metin: "Konum", boyut: 3 },
        { tip: "metin", metin: eser.adres || `${eser.ilce ?? ""}${eser.ilce ? ", " : ""}${eser.il ?? IL}`, soluk: true },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "haritada", metin: "Haritada göster", ikon: "harita", tur: "ana" },
          { tip: "dugme", id: "hata", metin: "Hata bildir", ikon: "bilgi", tur: "ikincil" },
        ] },
      ].filter(Boolean),
    };
  }

  function bagEkrani(id) {
    const bag = iliskiler.find((x) => x.id === id);
    if (!bag) return haritaEkrani();
    const a = bul(bag.a), b = bul(bag.b);
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: bag.baslik, alt: bagTuruAdi(bag.tur), geri: "geri" },
        { tip: "cipler", ogeler: [bagTuruAdi(bag.tur)] },
        { tip: "metin", metin: bag.aciklama },
        a ? { tip: "eser", eser: a, id: `eser:${a.id}`, boyut: "satir" } : null,
        b ? { tip: "eser", eser: b, id: `eser:${b.id}`, boyut: "satir" } : null,
        { tip: "metin", metin: `Kaynak: ${bag.kaynak ?? "Bursa Vakıf Eserleri Envanteri"}`, soluk: true },
        { tip: "dugme", id: "haritada", metin: "Haritada göster", ikon: "harita", tur: "ana" },
      ].filter(Boolean),
    };
  }

  function baglarEkrani() {
    const idler = gorunenIdler();
    const liste = iliskiler.filter((i) => idler.has(i.a) && idler.has(i.b));
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Tarihsel Bağlar", alt: `${liste.length} bağ · yalnızca görünen eserler`, geri: "geri" },
        { tip: "metin", metin: "Her bağ envanter metnine dayanır. Bağa dokununca iki eserin ilişkisi ve kaynağı açılır.", soluk: true },
        liste.length
          ? { tip: "liste", ogeler: liste.map((i) => {
            const a = bul(i.a), b = bul(i.b);
            return { id: `bag:${i.id}`, metin: `${kisalt(a?.ad, 26)} ↔ ${kisalt(b?.ad, 26)}`, alt: `${bagTuruAdi(i.tur)} · ${i.baslik}`, ikon: "bilgi" };
          }) }
          : { tip: "metin", metin: "Henüz görünen eserler arasında kayıtlı bir bağ yok. Haritada yeni eserler açtıkça bağlar burada belirir." },
        { tip: "dugme", id: "harita", metin: "Haritaya dön", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function nasilEkrani() {
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Nasıl oynanır?", alt: "Sis, bağlar ve mühür", geri: "geri" },
        { tip: "baslik", metin: "1. Sisi arala", boyut: 2 },
        { tip: "metin", metin: "Harita başlangıçta koyu bir sisle kaplıdır. Bir esere dokunduğunda o eser ve çevresindeki 650 metre sisin içinden çıkar. Yeni eserler yeni bölgeleri görünür kılar." },
        { tip: "baslik", metin: "2. Bağları oku", boyut: 2 },
        { tip: "metin", metin: "Haritadaki çizgiler eserler arasındaki tarihsel bağlardır. Altın külliye, yeşil vakıf, mavi mimar, mor bani, turuncu hanedan bağını gösterir; kesikli çizgiler envanterde açıkça anılan metin ve komşuluk bağlarıdır." },
        { tip: "baslik", metin: "3. Bağ ağını incele", boyut: 2 },
        { tip: "metin", metin: "Bir eserin detayında “Tarihsel bağlar” bölümü vardır. Ortadaki eserden çıkan düğümler bağlı eserlerdir; birine dokununca o esere geçersin. Altta her bağın kısa açıklaması ve kaynağı bulunur." },
        { tip: "baslik", metin: "4. Mühür kazan", boyut: 2 },
        { tip: "metin", metin: "Her yeni eser +1 mühür verir. Mühürlerle “Sisi arala” düğmesini kullanıp en yakın sisli eseri açabilirsin. Başarımlar haritayı tamamladıkça açılır." },
        { tip: "metin", metin: "Tarihî bilgi uydurulmaz: bağlar yalnızca Bursa Vakıf Eserleri Envanteri'ndeki açık ifadelerden küratörlü olarak hazırlanmıştır.", soluk: true },
        { tip: "dugme", id: "geri", metin: "Geri", ikon: "geri", tur: "ikincil" },
      ],
    };
  }
}
