import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

// Sisli Vakıf Atlası: harita sisle örtülü başlar. Keşfettiğin her eser çevresindeki sisi açar;
// oradan en yakın komşulara ve kaynaklı tarihsel bağlarla (aynı külliye, aynı bani, aile…) uzak eserlere ilerlersin.
// Bütün bilgiler eser kayıtlarından ve küratörlü bağlardan gelir; bağ açıklamaları kaynağıyla gösterilir.

const SEKMELER = [
  { id: "atlas", ad: "Atlas", ikon: "harita" },
  { id: "iz", ad: "İz sür", ikon: "pusula" },
  { id: "defter", ad: "Defter", ikon: "kitap" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
const BAG_ADI = { kulliye: "Aynı külliye", bani: "Aynı bani", mimar: "Aynı mimar", vakif: "Vakıf bağı", aile: "Aile bağı",
  ticaret: "Ticaret bağı", metin: "Kayıtta anılır", komsu: "Komşu yapı", tipoloji: "Benzer tip" };
const IL_RENK = { Bursa: "firuze", Konya: "altin", Hatay: "mercan" };

const BASARIMLAR = [
  { id: "ilk-sis", ad: "Sis Aralandı", aciklama: "İlk yeni eseri keşfet." },
  { id: "on", ad: "Fener", aciklama: "10 eser keşfet." },
  { id: "elli", ad: "Haritacı", aciklama: "50 eser keşfet." },
  { id: "bag", ad: "İz Sürücü", aciklama: "Bir bağı izleyerek eser keşfet." },
  { id: "bes-bag", ad: "Ağ Örücü", aciklama: "5 bağın iki ucunu da aç." },
  { id: "ilce", ad: "Mahalle Mahalle", aciklama: "Bir ilçenin bütün eserlerini keşfet." },
];

// Başlangıç eserleri: şehrin tarihî merkezinden
const BASLANGIC = { Bursa: "bursa-ulucami" };
const ACIK_YARICAP = 380;
const KENAR_SAYISI = 6;
const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;

export default async function basla() {
  // ---------- Veri ----------
  const hepsi = (await eserler.liste({})).filter((e) => e.konum);
  const kimlikle = new Map(hepsi.map((e) => [e.id, e]));
  const iliskiler = (await eserler.iliskiler()).filter((i) => kimlikle.has(i.a) && kimlikle.has(i.b));
  const iller = [...new Set(hepsi.map((e) => e.il))].sort((a, b) => hepsi.filter((e) => e.il === b).length - hepsi.filter((e) => e.il === a).length);
  await basarim.tanimla(BASARIMLAR);

  // ---------- Kalıcı kayıt: her il bir başlangıç eseriyle açılır ----------
  const kesif = new Set(((await depo.oku("sis-kesif")) ?? []).filter((k) => kimlikle.has(k)));
  for (const il of iller) {
    if (![...kesif].some((k) => kimlikle.get(k).il === il)) {
      const ilListe = hepsi.filter((e) => e.il === il);
      const merkezIlce = sayim(ilListe, (e) => e.ilce ?? "?")[0]?.[0];
      const ilk = kimlikle.get(BASLANGIC[il]) ?? enIyi(ilListe.filter((e) => (e.ilce ?? "?") === merkezIlce));
      if (ilk) kesif.add(ilk.id);
    }
  }
  await depo.yaz("sis-kesif", [...kesif]);

  // ---------- Durum ----------
  /** @type {any} */
  const d = { acildi: false, yigin: [{ ad: "atlas" }], il: iller[0], secili: null, tamOku: false, yeni: null, rozetler: [] };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => { d.tamOku = false; d.yigin.push({ ad, ...ek }); };

  await sahne.ayarla({ baslik: "Sisli Vakıf Atlası", tema: { zemin: "gece", renk: "firuze", yazi: "serif" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    try {
      await isle(olay);
    } catch {
      await sahne.bildir("Bir şeyler ters gitti, tekrar dene.");
    }
    await ciz();
  }

  // ======================================================================
  // Olaylar
  // ======================================================================
  async function isle(olay) {
    if (olay.tur === "sekme") return sekmeyeGec(olay.id);
    if (olay.tur === "sec") {
      if (olay.id === "il") { d.il = olay.deger; d.secili = null; }
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "kapak-atlas") return sekmeyeGec("atlas");
    if (id === "kapak-iz") return sekmeyeGec("iz");
    if (id === "kapak-nasil") { d.acildi = true; await sahne.ayarla({ sekmeler: SEKMELER, sekme: "atlas" }); d.yigin = [{ ad: "atlas" }]; return git("nasil"); }
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); d.tamOku = false; d.yeni = null; return; }
    if (id === "devam") { d.tamOku = !d.tamOku; return; }

    if (id === "atlas") { if (olay.eser) d.secili = kimlikle.get(olay.eser.id) ?? null; return; }
    if (id === "secili-ac" && d.secili) return git("eser", { eser: d.secili });
    if (id.startsWith("bag:")) {
      const bag = iliskiler.find((i) => i.id === id.slice(4));
      if (bag) git("bag", { bag });
      return;
    }
    if (id.startsWith("ac-")) return kesfet(id.slice(3), false);
    if (id.startsWith("iz-")) return kesfet(id.slice(3), true);
    if (id.startsWith("git-")) { const e = kimlikle.get(id.slice(4)); if (e) git("eser", { eser: e }); return; }
    if (id.startsWith("eser:") || (id === "eser" && olay.eser)) {
      const e = kimlikle.get(olay.eser?.id ?? id.slice(5));
      if (e && kesif.has(e.id)) git("eser", { eser: e });
      return;
    }
    if (id.startsWith("ilce-")) { const [il, ilce] = id.slice(5).split("|"); return git("ilce", { il, ilce }); }

    const e = ust().eser;
    if (!e) return;
    if (id === "hata") { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler, editörlere iletildi."); }
  }

  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.yigin = [{ ad: sekme }];
    d.tamOku = false;
    d.yeni = null;
    if (sekme === "defter") d.rozetler = await basarim.liste();
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  async function kesfet(kimlik, bagla) {
    const e = kimlikle.get(kimlik);
    if (!e) return;
    const yeniMi = !kesif.has(e.id);
    if (yeniMi) {
      kesif.add(e.id);
      await depo.yaz("sis-kesif", [...kesif]);
      await profil.puanEkle(bagla ? 15 : 10, "Sisten çıkan eser");
      await sahne.efekt("parla");
      await basarim.kazan("ilk-sis");
      if (bagla) await basarim.kazan("bag");
      if (kesif.size >= 10) await basarim.kazan("on");
      if (kesif.size >= 50) await basarim.kazan("elli");
      if (iliskiler.filter((i) => kesif.has(i.a) && kesif.has(i.b)).length >= 5) await basarim.kazan("bes-bag");
      const ilceListe = hepsi.filter((x) => x.il === e.il && x.ilce === e.ilce);
      if (ilceListe.length >= 3 && ilceListe.every((x) => kesif.has(x.id))) {
        await basarim.kazan("ilce");
        await sahne.efekt("konfeti");
        await sahne.bildir(`${e.ilce} ilçesinin bütün eserleri sisten çıktı!`);
      }
    }
    d.il = e.il;
    git("eser", { eser: e });
    d.yeni = yeniMi ? e.id : null;
  }

  // ---------- Hesaplar ----------
  function kenar(il) {
    const acik = hepsi.filter((e) => kesif.has(e.id) && (!il || e.il === il));
    return hepsi.filter((e) => !kesif.has(e.id) && (!il || e.il === il)).map((e) => {
      let en = Infinity, yakin = null;
      for (const a of acik) { const m = mesafe(a, e); if (m < en) { en = m; yakin = a; } }
      return { eser: e, mesafe: en, yakin };
    }).sort((a, b) => a.mesafe - b.mesafe);
  }

  function sisliBaglar(il) {
    const sonuc = [];
    for (const i of iliskiler) {
      const aAcik = kesif.has(i.a), bAcik = kesif.has(i.b);
      if (aAcik === bAcik) continue;
      const bilinen = kimlikle.get(aAcik ? i.a : i.b), gizli = kimlikle.get(aAcik ? i.b : i.a);
      if (il && bilinen.il !== il) continue;
      sonuc.push({ bag: i, bilinen, gizli });
    }
    return sonuc;
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const u = ust();
    if (u.ad === "eser") return sahne.ciz(eserEkrani(u.eser));
    if (u.ad === "bag") return sahne.ciz(bagEkrani(u.bag));
    if (u.ad === "ilce") return sahne.ciz(ilceEkrani(u.il, u.ilce));
    if (u.ad === "nasil") return sahne.ciz(nasilEkrani());
    if (u.ad === "iz") return sahne.ciz(izEkrani());
    if (u.ad === "defter") return sahne.ciz(defterEkrani());
    return sahne.ciz(atlasEkrani());
  }

  function kapakEkrani() {
    return {
      tip: "kapak", ust: `${iller.join(" · ")} · Sisli atlas`, baslik: "Sisli Vakıf Atlası", renk: "firuze",
      eser: kimlikle.get("bursa-yesil-turbe") ?? enIyi(hepsi),
      alt: `${hepsi.length} vakıf eseri sisin altında. ${kesif.size} tanesi açık. Komşuları ve kaynaklı tarihsel bağları izleyerek haritayı aç.`,
      cocuklar: [
        { tip: "dugme", id: "kapak-atlas", metin: "Atlası aç", ikon: "harita" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "kapak-iz", metin: "İz sür", ikon: "pusula", tur: "ikincil" },
          { tip: "dugme", id: "kapak-nasil", metin: "Nasıl oynanır?", ikon: "bilgi", tur: "ikincil" },
        ] },
      ],
    };
  }

  function haritaSecenekleri(il) {
    const liste = hepsi.filter((e) => e.il === il);
    const acik = liste.filter((e) => kesif.has(e.id));
    const baglar = iliskiler.filter((i) => kesif.has(i.a) && kesif.has(i.b) && kimlikle.get(i.a).il === il)
      .map((i) => ({ id: i.id, a: i.a, b: i.b, tur: i.tur, etiket: BAG_ADI[i.tur] ?? i.tur, baslik: i.baslik, aciklama: i.aciklama, kaynak: i.kaynak }));
    const hayalet = sisliBaglar(il).map(({ bilinen, gizli, bag }) => ({ a: bilinen.konum, b: gizli.konum, tur: bag.tur }));
    const ilceler = new Map();
    for (const e of liste) {
      const k = e.ilce ?? "?";
      if (!ilceler.has(k)) ilceler.set(k, []);
      ilceler.get(k).push(e);
    }
    const etiketler = [...ilceler.entries()].map(([ilce, l]) => ({
      lat: l.reduce((t, e) => t + e.konum.lat, 0) / l.length, lng: l.reduce((t, e) => t + e.konum.lng, 0) / l.length,
      metin: ilce, alt: `${l.filter((e) => kesif.has(e.id)).length}/${l.length}`, acik: l.some((e) => kesif.has(e.id)),
    }));
    return { acik, liste, baglar, hayalet, etiketler, sis: { acik: acik.map((e) => ({ lat: e.konum.lat, lng: e.konum.lng, yaricap: ACIK_YARICAP })), opaklik: 0.78 } };
  }

  function atlasEkrani() {
    const h = haritaSecenekleri(d.il);
    const k = kenar(d.il).slice(0, 3);
    const s = d.secili && d.secili.il === d.il ? d.secili : null;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Atlas", alt: `${d.il} · ${h.acik.length}/${h.liste.length} eser sisten çıktı` },
        { tip: "secenekler", id: "il", secili: d.il, secenekler: iller.map((il) => ({ id: il, metin: `${il} ${hepsi.filter((e) => e.il === il && kesif.has(e.id)).length}/${hepsi.filter((e) => e.il === il).length}` })) },
        { tip: "harita", id: "atlas", eserler: h.acik, secili: s?.id, sis: h.sis, baglantilar: h.baglar, hayaletBaglantilar: h.hayalet, etiketler: h.etiketler },
        { tip: "ilerleme", deger: h.acik.length, toplam: h.liste.length, etiket: `${d.il} atlası` },
        s
          ? { tip: "kart", id: "secili-ac", renk: IL_RENK[s.il], cocuklar: [
            { tip: "eser", eser: s, id: "secili-ac", boyut: "satir" },
            { tip: "dugme", id: "secili-ac", metin: "Eseri aç", ikon: "ok" },
          ] }
          : { tip: "metin", metin: "Işıklı pinler keşfettiğin eserler. Soluk kesikli çizgiler sisin içindeki bağlı eserlere uzanır.", soluk: true },
        { tip: "baslik", metin: "Sisin kenarında", boyut: 2 },
        ...k.map((x) => kenarKarti(x)),
        { tip: "dugme", id: "kapak-iz", metin: "Bütün izleri gör", ikon: "pusula", tur: "ikincil" },
      ],
    };
  }

  function kenarKarti(x) {
    const e = x.eser;
    return { tip: "kart", id: `ac-${e.id}`, cocuklar: [
      { tip: "baslik", metin: `Sisli bir ${(TUR_ADI[e.tur] ?? "yapı").toLocaleLowerCase("tr")}`, boyut: 3 },
      { tip: "metin", metin: `${x.yakin ? `${x.yakin.ad} eserinden ` : ""}${metre(x.mesafe)} uzakta · ${e.ilce ?? e.il}`, soluk: true },
      { tip: "dugme", id: `ac-${e.id}`, metin: "Sisi kaldır", ikon: "pusula", tur: "hayalet" },
    ] };
  }

  function izEkrani() {
    const baglar = sisliBaglar(null);
    const k = kenar(d.il).slice(0, KENAR_SAYISI);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "İz sür", alt: `${baglar.length} bağ sisin içine uzanıyor` },
        { tip: "baslik", metin: "Bağların izi", boyut: 2 },
        { tip: "metin", metin: "Keşfettiğin eserlerin kayıtlı tarihsel bağları. Bağı izle, öbür ucundaki eser sisten çıksın.", soluk: true },
        ...(baglar.length
          ? baglar.slice(0, 12).map(({ bag, bilinen, gizli }) => ({ tip: "kart", id: `iz-${gizli.id}`, renk: "firuze", cocuklar: [
            { tip: "cipler", ogeler: [BAG_ADI[bag.tur] ?? bag.tur, `${TUR_ADI[gizli.tur] ?? gizli.tur}`, gizli.ilce ?? gizli.il] },
            { tip: "baslik", metin: `${bilinen.ad} → ?`, boyut: 3 },
            { tip: "metin", metin: bag.baslik },
            { tip: "dugme", id: `iz-${gizli.id}`, metin: "Bağı izle", ikon: "ok", tur: "hayalet" },
          ] }))
          : [{ tip: "metin", metin: "Şu an sisin içine uzanan bir bağ yok. Komşu eserleri açtıkça yeni bağlar belirir.", ortali: true }]),
        { tip: "baslik", metin: `${d.il}: en yakın sisli eserler`, boyut: 2 },
        ...k.map((x) => kenarKarti(x)),
      ],
    };
  }

  function eserEkrani(e) {
    const p = paragraflar(e);
    const gorunen = d.tamOku ? p : p.slice(0, 2);
    const baglar = iliskiler.filter((i) => i.a === e.id || i.b === e.id);
    const acikBag = baglar.filter((i) => kesif.has(i.a) && kesif.has(i.b));
    const sisliBag = baglar.filter((i) => !(kesif.has(i.a) && kesif.has(i.b)));
    const komsular = hepsi.filter((x) => x.id !== e.id && x.il === e.il).map((x) => ({ eser: x, mesafe: mesafe(e, x) }))
      .sort((a, b) => a.mesafe - b.mesafe).slice(0, 5);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [TUR_ADI[e.tur], e.ilce, e.il].filter(Boolean).join(" · "), geri: "geri" },
        ...(d.yeni === e.id ? [{ tip: "kart", renk: "firuze", cocuklar: [
          { tip: "baslik", metin: "Sisten çıktı!", boyut: 3 },
          { tip: "metin", metin: `Atlasında artık ${kesif.size} eser açık.` },
        ] }] : []),
        { tip: "fotograflar", eser: e },
        { tip: "cipler", ogeler: [TUR_ADI[e.tur] ?? e.tur, e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor", e.ilce ?? e.il] },
        ...(gorunen.length ? gorunen.map((m) => ({ tip: "metin", metin: m })) : [{ tip: "metin", metin: "Bu eserin kaydında tarihçe yok.", soluk: true }]),
        ...(p.length > 2 ? [{ tip: "dugme", id: "devam", metin: d.tamOku ? "Daha az göster" : `Devamını oku (${p.length - 2} paragraf)`, ikon: "kitap", tur: "hayalet" }] : []),
        ...(acikBag.length ? [
          { tip: "baslik", metin: "Açık bağlar", boyut: 2 },
          { tip: "graf", id: "bag", merkez: e, iliskiler: acikBag.map((i) => ({ eser: kimlikle.get(i.a === e.id ? i.b : i.a), tur: i.tur, baslik: i.baslik, aciklama: i.aciklama, kaynak: i.kaynak })) },
        ] : []),
        ...(sisliBag.length ? [
          { tip: "baslik", metin: "Sise uzanan bağlar", boyut: 2 },
          { tip: "liste", ogeler: sisliBag.map((i) => {
            const diger = kimlikle.get(i.a === e.id ? i.b : i.a);
            return { id: `iz-${diger.id}`, metin: i.baslik, alt: `${BAG_ADI[i.tur] ?? i.tur} · sisli bir ${(TUR_ADI[diger.tur] ?? "yapı").toLocaleLowerCase("tr")}`, ikon: "pusula", sag: "İzle" };
          }) },
        ] : []),
        { tip: "baslik", metin: "Komşular", boyut: 2 },
        { tip: "liste", ogeler: komsular.map((x) => kesif.has(x.eser.id)
          ? { id: `git-${x.eser.id}`, metin: x.eser.ad, alt: TUR_ADI[x.eser.tur] ?? x.eser.tur, ikon: "konum", sag: metre(x.mesafe) }
          : { id: `ac-${x.eser.id}`, metin: `Sisli bir ${(TUR_ADI[x.eser.tur] ?? "yapı").toLocaleLowerCase("tr")}`, alt: "Dokun, sisi kaldır", ikon: "soru", sag: metre(x.mesafe) }) },
        { tip: "metin", metin: e.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function bagEkrani(bag) {
    const a = kimlikle.get(bag.a), b = kimlikle.get(bag.b);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: BAG_ADI[bag.tur] ?? "Bağ", alt: bag.baslik, geri: "geri" },
        { tip: "baslik", metin: bag.baslik, boyut: 2 },
        { tip: "metin", metin: bag.aciklama },
        ...(bag.kaynak ? [{ tip: "metin", metin: `Kaynak: ${bag.kaynak}`, soluk: true }] : []),
        { tip: "izgara", sutun: 2, cocuklar: [a, b].map((e) => ({ tip: "eser", eser: e, id: `eser:${e.id}`, boyut: "kucuk" })) },
      ],
    };
  }

  function ilceEkrani(il, ilce) {
    const liste = hepsi.filter((e) => e.il === il && (e.ilce ?? "?") === ilce);
    const acik = liste.filter((e) => kesif.has(e.id));
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: ilce, alt: `${il} · ${acik.length}/${liste.length} keşfedildi`, geri: "geri" },
        { tip: "ilerleme", deger: acik.length, toplam: liste.length },
        { tip: "liste", ogeler: liste.map((e) => kesif.has(e.id)
          ? { id: `git-${e.id}`, metin: e.ad, alt: TUR_ADI[e.tur] ?? e.tur, ikon: "yildiz" }
          : { id: `ac-${e.id}`, metin: "Sisli eser", alt: TUR_ADI[e.tur] ?? e.tur, ikon: "soru", sag: "Aç" }) },
      ],
    };
  }

  function defterEkrani() {
    const acikBag = iliskiler.filter((i) => kesif.has(i.a) && kesif.has(i.b)).length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Keşif defteri", alt: `${kesif.size}/${hepsi.length} eser` },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: kesif.size, etiket: "eser", ikon: "harita" },
          { tip: "istatistik", deger: `${acikBag}/${iliskiler.length}`, etiket: "bağ", ikon: "kalp" },
          { tip: "istatistik", deger: `%${Math.round((kesif.size / Math.max(1, hepsi.length)) * 100)}`, etiket: "atlas", ikon: "yildiz" },
        ] },
        ...iller.flatMap((il) => {
          const ilceler = sayim(hepsi.filter((e) => e.il === il), (e) => e.ilce ?? "?");
          return [
            { tip: "baslik", metin: il, boyut: 2 },
            { tip: "liste", ogeler: ilceler.map(([ilce, n]) => {
              const k = hepsi.filter((e) => e.il === il && (e.ilce ?? "?") === ilce && kesif.has(e.id)).length;
              return { id: `ilce-${il}|${ilce}`, metin: ilce, alt: "▮".repeat(Math.round((k / n) * 10)) + "▯".repeat(10 - Math.round((k / n) * 10)), ikon: k === n ? "yildiz" : "konum", sag: `${k}/${n}` };
            }) },
          ];
        }),
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
      ],
    };
  }

  function nasilEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Nasıl oynanır?", geri: "geri" },
        { tip: "liste", ogeler: [
          { id: "n1", metin: "Harita sisle örtülü", alt: "Her şehirde bir eserle başlarsın; keşfettiğin her eserin çevresi aydınlanır.", ikon: "harita" },
          { id: "n2", metin: "Sisin kenarı", alt: "Açık eserlere en yakın sisli yapılar listelenir. Sisi kaldırınca eserin kaydı açılır.", ikon: "pusula" },
          { id: "n3", metin: "Bağları izle", alt: "Aynı külliye, aynı bani, aile… Kaynaklı bağlar seni uzaktaki eserlere götürür.", ikon: "kalp" },
          { id: "n4", metin: "İlçeleri tamamla", alt: "Defterinde her ilçenin ilerlemesini görürsün; bir ilçeyi bitirince rozet kazanırsın.", ikon: "kupa" },
        ] },
        { tip: "dugme", id: "geri", metin: "Atlasa dön", ikon: "harita" },
      ],
    };
  }
}

// ---------- Yardımcılar ----------
function paragraflar(e) {
  const p = String(e.tarihce?.tr ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (p.length > 1 && p[0].length < 220 && ADRES_DESENI.test(p[0])) p.shift();
  return p;
}

function sayim(liste, anahtar) {
  const m = new Map();
  for (const e of liste) m.set(anahtar(e), (m.get(anahtar(e)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function enIyi(liste) {
  const puan = (e) => (e.fotograflar.length ? 10 : 0) + Math.min(4, e.fotograflar.length) + Math.min(5, String(e.tarihce?.tr ?? "").length / 800);
  return [...liste].sort((a, b) => puan(b) - puan(a))[0];
}

function mesafe(a, b) {
  if (!a?.konum || !b?.konum) return Infinity;
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.konum.lat - a.konum.lat) * r, dLng = (b.konum.lng - a.konum.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.konum.lat * r) * Math.cos(b.konum.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const metre = (m) => (!Number.isFinite(m) ? "uzakta" : m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
