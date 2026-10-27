import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

/*
  Sisli Vakıf Atlası
  ------------------------------------------------------------------
  Bursa merkezli, Türkiye'ye yayılan bir vakıf mirası ağı. Harita
  karanlık bir atlas gibi başlar; gezilen her eser şehrini açar. Şehirler
  arasındaki külliye, bani, mimar, vakıf, hanedan ve ticaret bağları
  küratörlü veriden gelir, ad benzerliğinden üretilmez.
*/

const KAYIT = "sisli-vakif-atlasi-v5";
const BASLANGIC = "bursa-ulucami";
const BASLANGIC_SEHIR = "bursa";
const SEHIR_YARICAP = 14000;
const BASLANGIC_MUHUR = 4;
const YENI_ESER_PUANI = 10;

const BAG_ADI = {
  kulliye: "Aynı külliye",
  bani: "Aynı bani",
  mimar: "Aynı mimar",
  vakif: "Vakıf bağı",
  aile: "Hanedan / aile",
  ticaret: "Ticaret ağı",
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
  { id: "ilk-sis", ad: "İlk Işık", aciklama: "İlk eseri haritada aç." },
  { id: "uc-sehir", ad: "Üç Şehir", aciklama: "Üç ayrı şehirde birer eser keşfet." },
  { id: "tam-sehir", ad: "Şehir Ustası", aciklama: "Bir şehirdeki bütün eserleri gez." },
  { id: "ag-kasifi", ad: "Bağ Kâşifi", aciklama: "Üç eserin tarihsel bağ ağını incele." },
  { id: "muhur-ustasi", ad: "Mühürdar", aciklama: "On mühür topla." },
  { id: "anadolu-agi", ad: "Anadolu Ağı", aciklama: "Bütün şehirlerin sisini aç." },
  { id: "tum-harita", ad: "Atlasın Sahibi", aciklama: "Konumu bilinen bütün eserleri keşfet." },
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

function sehirId(il) {
  return String(il ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sehirleriKur(yerli) {
  const kume = new Map();
  for (const eser of yerli) {
    if (!kume.has(eser.il)) kume.set(eser.il, []);
    kume.get(eser.il).push(eser);
  }
  return [...kume.entries()].map(([ad, eserler]) => {
    const merkez = ortalama(eserler);
    let capa = eserler[0];
    for (const eser of eserler) {
      if (mesafe(eser.konum, merkez) < mesafe(capa.konum, merkez)) capa = eser;
    }
    return {
      id: sehirId(ad),
      ad,
      capa,
      merkez,
      eserler: eserler.slice().sort((a, b) => (a.yuzyil ?? 99) - (b.yuzyil ?? 99) || a.ad.localeCompare(b.ad, "tr")),
    };
  }).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

export default async function basla() {
  const tum = await eserler.liste();
  const yerli = tum.filter((e) => e.konum && Number.isFinite(Number(e.konum.lat)) && Number.isFinite(Number(e.konum.lng)));
  const sehirler = sehirleriKur(yerli);
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
    kapsam: "sehir",
    sehir: BASLANGIC_SEHIR,
    odak: null,
    rozetler: await basarim.liste(),
  };
  if (!durum.gezilen.size) {
    for (const id of [BASLANGIC, "edirne-selimiye-camii", "istanbul-suleymaniye-camii", "izmir-hisar-camii"]) {
      if (bul(id)) durum.gezilen.add(id);
    }
  }
  durum.odak = odakHesapla();

  await sahne.ayarla({ baslik: "Sisli Vakıf Atlası", tema: { zemin: "gece", renk: "firuze", yazi: "serif" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    await olayIsle(olay);
    await ciz();
  }

  function bul(id) {
    return tum.find((e) => e.id === id) ?? null;
  }

  function sehirBul(id) {
    return sehirler.find((s) => s.id === id) ?? null;
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

  function acikSehirler() {
    return sehirler.filter((s) => s.eserler.some((e) => durum.gezilen.has(e.id)));
  }

  function gorunenler() {
    const acik = new Set(acikSehirler().map((s) => s.id));
    return yerli.filter((e) => acik.has(sehirId(e.il)));
  }

  function acikAlanlar() {
    return acikSehirler().map((s) => ({ lat: s.merkez.lat, lng: s.merkez.lng, yaricap: SEHIR_YARICAP }));
  }

  function sehirEtiketleri() {
    return sehirler.map((s) => ({ lat: s.merkez.lat, lng: s.merkez.lng, metin: s.ad, alt: `${s.eserler.length} eser`, acik: s.eserler.some((e) => durum.gezilen.has(e.id)) }));
  }

  function gorunenBaglar() {
    const idler = new Set(gorunenler().map((e) => e.id));
    return iliskiler
      .filter((i) => idler.has(i.a) && idler.has(i.b))
      .map((i) => ({ a: i.a, b: i.b, tur: i.tur, etiket: i.baslik }));
  }

  function sehirBaglari() {
    const ciftler = new Map();
    for (const i of iliskiler) {
      const a = bul(i.a), b = bul(i.b);
      if (!a || !b || a.il === b.il) continue;
      const ca = sehirBul(sehirId(a.il)), cb = sehirBul(sehirId(b.il));
      if (!ca || !cb) continue;
      const anahtar = [ca.id, cb.id].sort().join("|");
      if (!ciftler.has(anahtar)) ciftler.set(anahtar, { a: ca.merkez, b: cb.merkez, tur: i.tur });
    }
    return [...ciftler.values()];
  }

  function esereBaglar(id) {
    return (iliskiHaritasi.get(id) ?? [])
      .map((i) => ({ ...i, diger: bul(i.a === id ? i.b : i.a), yon: i.a === id ? "a" : "b" }))
      .filter((i) => i.diger);
  }

  function odakHesapla() {
    if (durum.kapsam === "ag") return { lat: 39.0, lng: 35.0, zoom: 5 };
    const s = sehirBul(durum.sehir) ?? sehirBul(BASLANGIC_SEHIR) ?? sehirler[0];
    return s ? { lat: s.merkez.lat, lng: s.merkez.lng, zoom: 13 } : { lat: 39.0, lng: 35.0, zoom: 5 };
  }

  async function basarimKontrol() {
    if (durum.gezilen.size >= 1) await basarim.kazan("ilk-sis");
    const acik = acikSehirler();
    if (acik.length >= 3) await basarim.kazan("uc-sehir");
    if (sehirler.some((s) => s.eserler.every((e) => durum.gezilen.has(e.id)))) await basarim.kazan("tam-sehir");
    if (durum.agGezilen.size >= 3) await basarim.kazan("ag-kasifi");
    if (durum.muhur >= 10) await basarim.kazan("muhur-ustasi");
    if (sehirler.length && acik.length === sehirler.length) await basarim.kazan("anadolu-agi");
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
      await sahne.bildir(`${eser.ad} · ${eser.il} sisi açıldı. +1 mühür`);
    }
    if (esereBaglar(eser.id).length) durum.agGezilen.add(eser.id);
    durum.secili = eser.id;
    durum.kapsam = "sehir";
    durum.sehir = sehirId(eser.il);
    durum.odak = odakHesapla();
    await kaydet();
    await basarimKontrol();
    if (simdiki().ad !== "eser" || simdiki().id !== eser.id) git({ ad: "eser", id: eser.id });
  }

  async function sehirArala(id) {
    const hedef = sehirBul(id);
    if (!hedef) return;
    if (hedef.eserler.some((e) => durum.gezilen.has(e.id))) {
      durum.kapsam = "sehir";
      durum.sehir = hedef.id;
      durum.odak = odakHesapla();
      await sahne.bildir(`${hedef.ad} zaten açık.`);
      return;
    }
    if (durum.muhur < 1) {
      await sahne.bildir("Mühür yok. Yeni eserler gezerek mühür kazan.");
      return;
    }
    durum.muhur -= 1;
    durum.gezilen.add(hedef.capa.id);
    durum.secili = hedef.capa.id;
    durum.kapsam = "sehir";
    durum.sehir = hedef.id;
    durum.odak = odakHesapla();
    await profil.puanEkle(6, `${hedef.ad} sisi aralandı`);
    await sahne.bildir(`${hedef.ad} sisi açıldı. ${hedef.capa.ad} seni bekliyor.`);
    await kaydet();
    await basarimKontrol();
  }

  async function sisArala() {
    const acik = acikSehirler();
    const adaylar = sehirler.filter((s) => !acik.includes(s));
    if (!adaylar.length) {
      await sahne.bildir("Bütün şehirlerin sisi açıldı.");
      return;
    }
    const secilen = adaylar
      .map((s) => ({ s, d: acik.length ? Math.min(...acik.map((a) => mesafe(a.merkez, s.merkez))) : 0 }))
      .sort((a, b) => a.d - b.d)[0].s;
    await sehirArala(secilen.id);
  }

  async function olayIsle(olay) {
    if (olay.eser) {
      await eserAc(olay.eser);
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;
    if (id === "geri") { geri(); return; }
    if (id === "basla") {
      durum.kapsam = "sehir";
      durum.sehir = BASLANGIC_SEHIR;
      durum.odak = odakHesapla();
      durum.yigin = [{ ad: "harita" }];
      return;
    }
    if (id === "ag") {
      durum.kapsam = "ag";
      durum.odak = odakHesapla();
      durum.yigin = [{ ad: "harita" }];
      return;
    }
    if (id === "harita") { durum.yigin = [{ ad: "harita" }]; return; }
    if (id === "kapsam") {
      durum.kapsam = durum.kapsam === "ag" ? "sehir" : "ag";
      durum.odak = odakHesapla();
      return;
    }
    if (id === "nasil") { git({ ad: "nasil" }); return; }
    if (id === "sehirler") { git({ ad: "sehirler" }); return; }
    if (id === "baglar") { git({ ad: "baglar" }); return; }
    if (id === "arala") { await sisArala(); return; }
    if (id === "haritada") { durum.yigin = [{ ad: "harita" }]; return; }
    if (id === "hata") {
      const eser = durum.secili ? bul(durum.secili) : null;
      if (eser) await ekran.duzeltme(eser);
      return;
    }
    if (id.startsWith("arala:")) { await sehirArala(id.slice(6)); return; }
    if (id.startsWith("sehir-harita:")) {
      const sid = id.slice(13);
      durum.kapsam = "sehir";
      durum.sehir = sid;
      durum.odak = odakHesapla();
      durum.yigin = [{ ad: "harita" }];
      return;
    }
    if (id.startsWith("sehir:")) { git({ ad: "sehir", id: id.slice(6) }); return; }
    if (id.startsWith("eser:")) {
      const eser = bul(id.slice(5));
      if (eser) await eserAc(eser);
      return;
    }
    if (id.startsWith("bag:")) { git({ ad: "bag", id: id.slice(4) }); return; }
  }

  function arayuz() {
    const sayfa = simdiki();
    if (sayfa.ad === "kapak") return kapakEkrani();
    if (sayfa.ad === "harita") return haritaEkrani();
    if (sayfa.ad === "sehirler") return sehirlerEkrani();
    if (sayfa.ad === "sehir") return sehirEkrani(sayfa.id);
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
      ust: "Türkiye · Vakıf Mirası Ağı",
      baslik: "Sisli Vakıf Atlası",
      alt: `${sehirler.length} şehir · ${yerli.length} konumlu eser · ${iliskiler.length} kaynaklı bağ. Bursa'dan Edirne'ye, İzmir'den Mardin'e uzanan vakıf ağını sisin içinden aç.`,
      eser: kapakEser,
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Haritaya gir", ikon: "harita", tur: "ana" },
        { tip: "dugme", id: "ag", metin: "Türkiye ağı", ikon: "pusula", tur: "ikincil" },
        { tip: "dugme", id: "nasil", metin: "Nasıl oynanır?", ikon: "bilgi", tur: "ikincil" },
      ],
    };
  }

  function haritaEkrani() {
    const gorunen = gorunenler();
    const acik = acikSehirler();
    const baglar = gorunenBaglar();
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Vakıf Atlası",
          alt: `${acik.length}/${sehirler.length} şehir · ${gorunen.length}/${yerli.length} eser · ${baglar.length} bağ`,
          geri: "geri",
          sag: [{ id: "sehirler", ikon: "harita", etiket: "Şehirler" }, { id: "baglar", ikon: "yildiz", etiket: "Bağlar" }] },
        { tip: "harita", id: "harita", eserler: gorunen, secili: durum.secili,
          baglantilar: baglar,
          hayaletBaglantilar: durum.kapsam === "ag" ? sehirBaglari() : [],
          sis: { acik: acikAlanlar(), opaklik: 0.84, minPiksel: 58 },
          etiketler: sehirEtiketleri(),
          odak: odakHesapla() },
        { tip: "izgara", sutun: 2, cocuklar: [
          { tip: "istatistik", deger: durum.gezilen.size, etiket: "Gezilen eser", ikon: "konum" },
          { tip: "istatistik", deger: durum.muhur, etiket: "Mühür", ikon: "yildiz" },
          { tip: "istatistik", deger: `${acik.length}/${sehirler.length}`, etiket: "Açık şehir", ikon: "harita" },
          { tip: "istatistik", deger: baglar.length, etiket: "Görünen bağ", ikon: "bilgi" },
        ] },
        { tip: "ilerleme", deger: durum.gezilen.size, toplam: yerli.length, etiket: "Atlasın sisini arala" },
        { tip: "metin", metin: "Noktalar eserleri gösterir; küme işaretine dokununca harita yakınlaşır. Şehir etiketleri karanlıkta kalır, keşfettiğin şehir ışıklanır. Çizgiler yalnızca envanterde açıkça belirtilen tarihsel bağlardır.", soluk: true },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "arala", metin: "Sisi arala (1 mühür)", ikon: "pusula", tur: "ana", devre_disi: durum.muhur < 1 },
          { tip: "dugme", id: "sehirler", metin: "Şehirler", ikon: "harita", tur: "ikincil" },
        ] },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "kapsam", metin: durum.kapsam === "ag" ? "Şehre yaklaş" : "Tüm ağ", ikon: "pusula", tur: "ikincil" },
          { tip: "dugme", id: "baglar", metin: "Bağlar", ikon: "bilgi", tur: "ikincil" },
        ] },
        { tip: "baslik", metin: "Bağ renkleri", boyut: 3 },
        { tip: "cipler", ogeler: ["Altın: külliye", "Yeşil: vakıf", "Mavi: mimar", "Mor: bani", "Turuncu: hanedan", "Pembe: ticaret", "Kesikli: metin / komşuluk"] },
      ],
    };
  }

  function sehirlerEkrani() {
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Şehirler", alt: `${sehirler.length} şehir · ${acikSehirler().length} açık`, geri: "geri" },
        { tip: "metin", metin: "Her şehir kendi sisini taşır. Bir esere dokunmak o şehri açar; şehirler arası bir bağa gitmek yeni bir şehri ışıklandırır.", soluk: true },
        { tip: "liste", ogeler: sehirler.map((s) => {
          const acik = s.eserler.some((e) => durum.gezilen.has(e.id));
          const gezilen = s.eserler.filter((e) => durum.gezilen.has(e.id)).length;
          return {
            id: `sehir:${s.id}`,
            metin: s.ad,
            alt: `${s.eserler.length} eser · ${acik ? "açık" : "sisli"}`,
            ikon: acik ? "harita" : "bilgi",
            sag: `${gezilen}/${s.eserler.length}`,
          };
        }) },
        { tip: "dugme", id: "harita", metin: "Haritaya dön", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function sehirEkrani(id) {
    const s = sehirBul(id);
    if (!s) return haritaEkrani();
    const acik = s.eserler.some((e) => durum.gezilen.has(e.id));
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: s.ad, alt: `${s.eserler.length} eser · ${acik ? "açık" : "sisli"}`, geri: "geri" },
        { tip: "metin", metin: acik ? `${s.ad} artık aydınlık. Eserlere dokunarak bağ ağını büyüt.` : `${s.ad} hâlâ karanlıkta. Bir mühürle şehrin kapısını aralayabilirsin.`, soluk: true },
        acik
          ? { tip: "liste", ogeler: s.eserler.map((e) => ({ id: `eser:${e.id}`, metin: e.ad, alt: `${turAdi(e.tur)}${e.yuzyil ? ` · ${e.yuzyil}. yüzyıl` : ""}`, ikon: "konum", sag: durum.gezilen.has(e.id) ? "gezildi" : "yeni" })) }
          : { tip: "dugme", id: `arala:${s.id}`, metin: `Sisi arala (1 mühür)`, ikon: "pusula", tur: "ana", devre_disi: durum.muhur < 1 },
        { tip: "dugme", id: `sehir-harita:${s.id}`, metin: "Haritada göster", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function eserEkrani(id) {
    const eser = bul(id);
    if (!eser) return haritaEkrani();
    const baglar = esereBaglar(eser.id);
    const paragraflar = String(eser.tarihce?.tr ?? "").split(/\n+/).filter(Boolean);
    const cipler = [turAdi(eser.tur), eser.il, eser.yuzyil ? `${eser.yuzyil}. yüzyıl` : null, eser.konum?.yaklasik ? "konum yaklaşık" : null].filter(Boolean);
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: eser.ad, alt: `${turAdi(eser.tur)} · ${eser.il}${eser.yuzyil ? ` · ${eser.yuzyil}. yüzyıl` : ""}`, geri: "geri" },
        { tip: "fotograflar", eser },
        { tip: "cipler", ogeler: cipler },
        ...paragraflar.map((p, i) => ({ tip: "metin", metin: p, soluk: i > 2 })),
        { tip: "metin", metin: `Kaynak: ${eser.kaynak}`, soluk: true },
        { tip: "baslik", metin: "Tarihsel bağlar", boyut: 2 },
        baglar.length
          ? { tip: "graf", id: "eser-graf", merkez: eser, iliskiler: baglar.slice(0, 8).map((b) => ({ eser: b.diger, tur: b.tur, baslik: b.baslik })) }
          : { tip: "metin", metin: "Bu eser için küratörlü bir tarihsel bağ kaydı yok. Bağ uydurmuyoruz; yalnızca kaynaklı ilişkileri gösteriyoruz.", soluk: true },
        baglar.length
          ? { tip: "liste", ogeler: baglar.map((b) => ({ id: `bag:${b.id}`, metin: b.diger.ad, alt: `${bagTuruAdi(b.tur)} · ${b.baslik}`, ikon: "bilgi", sag: b.diger.konum ? "haritada" : "konum yok" })) }
          : null,
        { tip: "baslik", metin: "Konum", boyut: 3 },
        { tip: "metin", metin: eser.adres || `${eser.ilce ?? ""}${eser.ilce ? ", " : ""}${eser.il}`, soluk: true },
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
    const idler = new Set(gorunenler().map((e) => e.id));
    const liste = iliskiler.filter((i) => idler.has(i.a) && idler.has(i.b));
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Tarihsel Bağlar", alt: `${liste.length} bağ · açık şehirler`, geri: "geri" },
        { tip: "metin", metin: "Külliye, bani, mimar, vakıf, hanedan ve ticaret bağları; her biri kaynaklı. Bağa dokununca iki eserin ilişkisi ve kaynağı açılır.", soluk: true },
        liste.length
          ? { tip: "liste", ogeler: liste.map((i) => {
            const a = bul(i.a), b = bul(i.b);
            return { id: `bag:${i.id}`, metin: `${kisalt(a?.ad, 24)} ↔ ${kisalt(b?.ad, 24)}`, alt: `${bagTuruAdi(i.tur)} · ${i.baslik}`, ikon: "bilgi" };
          }) }
          : { tip: "metin", metin: "Henüz açık şehirler arasında kayıtlı bir bağ yok. Yeni şehirler açtıkça bağlar burada belirir." },
        { tip: "dugme", id: "harita", metin: "Haritaya dön", ikon: "harita", tur: "ikincil" },
      ],
    };
  }

  function nasilEkrani() {
    return {
      tip: "sutun",
      cocuklar: [
        { tip: "ust_cubuk", baslik: "Nasıl oynanır?", alt: "Sis, şehirler ve bağlar", geri: "geri" },
        { tip: "baslik", metin: "1. Şehirleri ışıklandır", boyut: 2 },
        { tip: "metin", metin: "Atlas karanlık başlar. Bursa'daki bir esere dokunduğunda Bursa aydınlanır. Şehirler arası bir bağdan başka bir şehre geçtiğinde o şehir de açılır. Mühürle kilitli bir şehri de aralayabilirsin." },
        { tip: "baslik", metin: "2. Bağları oku", boyut: 2 },
        { tip: "metin", metin: "Haritadaki eğriler tarihsel bağlardır: altın külliye, yeşil vakıf, mavi mimar, mor bani, turuncu hanedan, pembe ticaret. Kesikli çizgiler envanterde açıkça anılan metin ve komşuluk bağlarıdır." },
        { tip: "baslik", metin: "3. Bağ ağını incele", boyut: 2 },
        { tip: "metin", metin: "Bir eserin detayında merkezdeki eserden çıkan düğümler bağlı eserlerdir; birine dokununca o esere geçersin. Altta her bağın kısa açıklaması ve kaynağı bulunur." },
        { tip: "baslik", metin: "4. Tüm ağa bak", boyut: 2 },
        { tip: "metin", metin: "“Tüm ağ” düğmesi Türkiye ölçeğine çekilir; açık şehirler karanlıkta ışıldar, şehir etiketleri görünür. “Şehre yaklaş” yeniden kendi şehrine döner." },
        { tip: "metin", metin: "Tarihî bilgi uydurulmaz: bağlar envanter metinleri ve Vikipedi kaynaklarından küratörlü olarak hazırlanmıştır.", soluk: true },
        { tip: "dugme", id: "geri", metin: "Geri", ikon: "geri", tur: "ikincil" },
      ],
    };
  }
}
