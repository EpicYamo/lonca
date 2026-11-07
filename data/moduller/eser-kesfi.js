import { sahne, ekran, eserler, depo, dalislar } from "@lonca/sdk";

// Eser Keşfi: Bursa'nın vakıf eserlerini tek yerde gezdiren rehber.
// Şehir seç, haritada bul, yakınındakileri gör; her eserin tarihçesini, fotoğraflarını,
// kaynaklarını ve kaynaklı tarihsel bağlarını aç. Bilgiler yalnızca eser kaydından gelir.

const SEKMELER = [
  { id: "kesfet", ad: "Keşfet", ikon: "pusula" },
  { id: "harita", ad: "Harita", ikon: "harita" },
  { id: "yakin", ad: "Yakınımda", ikon: "konum" },
  { id: "listem", ad: "Listem", ikon: "kalp" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
const BAG_ADI = { kulliye: "Aynı külliye", bani: "Aynı bani", mimar: "Aynı mimar", vakif: "Vakıf bağı", aile: "Aile bağı",
  ticaret: "Ticaret bağı", metin: "Metinde geçer", komsu: "Komşu yapı", tipoloji: "Benzer tip" };
const ALAN_ADI = { ad: "ad", tur: "tür", il: "il", ilce: "ilçe", yuzyil: "yüzyıl", konum: "konum", adres: "adres", tarihce: "tarihçe" };

const SAYFA_BOYU = 12;
const TURKIYE = { lat: 39.3, lng: 33.6, zoom: 5 };
const ADRES_DESENI = /(Caddesi|Sokak|Mahallesi|No:|yer almaktadır|bulunmaktadır)/;

export default async function basla() {
  // ---------- Veri ----------
  const hepsi = await eserler.liste({});
  const iliskiler = await eserler.iliskiler();
  const dalisListesi = await dalisListesiAl();
  const dalisEserleri = new Map(dalisListesi.map((t) => [t.eser, t]));
  const kimlikle = new Map(hepsi.map((e) => [e.id, e]));

  // Bağ sayısı: kaç kaynaklı bağı olduğu (öne çıkarma sıralamasında kullanılır)
  const bagSayisi = new Map();
  for (const i of iliskiler) for (const k of [i.a, i.b]) bagSayisi.set(k, (bagSayisi.get(k) ?? 0) + 1);

  // Şehirler: eser sayısına göre, merkezleri konumlu eserlerin ortalaması
  const sehirMap = new Map();
  for (const e of hepsi) {
    if (!sehirMap.has(e.il)) sehirMap.set(e.il, []);
    sehirMap.get(e.il).push(e);
  }
  const sehirler = [...sehirMap.entries()].map(([ad, liste]) => {
    const konumlu = liste.filter((e) => e.konum);
    const merkez = konumlu.length
      ? { lat: konumlu.reduce((t, e) => t + e.konum.lat, 0) / konumlu.length, lng: konumlu.reduce((t, e) => t + e.konum.lng, 0) / konumlu.length }
      : null;
    return { ad, liste, konumlu, merkez, kapak: enIyiler(liste, 1)[0] ?? liste[0] };
  }).sort((a, b) => b.liste.length - a.liste.length || a.ad.localeCompare(b.ad, "tr"));
  const konumluHepsi = hepsi.filter((e) => e.konum);

  // ---------- Kalıcı kayıtlar ----------
  const listem = new Set((await depo.oku("listem")) ?? []);
  const sonBakilan = /** @type {string[]} */ ((await depo.oku("son-bakilan")) ?? []);
  const kaydet = async () => {
    await depo.yaz("listem", [...listem]);
    await depo.yaz("son-bakilan", sonBakilan.slice(0, 12));
  };

  // ---------- Durum ----------
  /** @type {any} */
  const d = {
    acildi: false,
    sekme: "kesfet",
    yigin: [{ ad: "kesfet" }],
    sehir: "hepsi",
    tur: "hepsi",
    arama: "",
    sayfa: 1,
    haritaSecili: null,
    yakin: null,
    dalis: null,
  };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => d.yigin.push({ ad, ...ek });

  await sahne.ayarla({ baslik: "Eser Keşfi", tema: { zemin: "parsomen", renk: "firuze", yazi: "serif" } });
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
    if (olay.tur === "gonder" && olay.id === "ara") { d.arama = olay.deger.trim(); d.sayfa = 1; return; }
    if (olay.tur === "sec") {
      if (olay.id === "tur") { d.tur = olay.deger; d.sayfa = 1; }
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    // Kapak
    if (id === "basla") return acil("kesfet");
    if (id === "kapak-harita") return acil("harita");
    if (id === "kapak-yakin") { await acil("yakin"); return yakinimdakiler(); }

    // Gezinme
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); d.dalis = null; return; }
    if (id === "eser" && olay.eser) return eserAc(olay.eser);
    if (id.startsWith("sehir-")) return sehirSec(id.slice(6));
    if (id === "daha") { d.sayfa++; return; }
    if (id === "aramayi-temizle") { d.arama = ""; d.tur = "hepsi"; d.sayfa = 1; return; }
    if (id === "zaman") return zamanCizelgesi();

    // Harita
    if (id === "harita") { if (olay.eser) d.haritaSecili = olay.eser; return; }
    if (id === "secili-ac" && d.haritaSecili) return eserAc(d.haritaSecili);
    if (id === "yakinim") return yakinimdakiler();
    if (id.startsWith("yakin-")) return eserAc(kimlikle.get(id.slice(6)));
    if (id.startsWith("son-")) return eserAc(kimlikle.get(id.slice(4)));

    // Eser sayfası
    const e = ust().eser;
    if (id.startsWith("graf:") && olay.eser) return eserAc(kimlikle.get(olay.eser.id) ?? olay.eser);
    if (id.startsWith("bag-")) {
      const bag = iliskiler.find((x) => x.id === id.slice(4));
      if (bag && e) return eserAc(kimlikle.get(bag.a === e.id ? bag.b : bag.a));
      return;
    }
    if (!e) return;
    if (id === "listeye") return listeDegistir(e);
    if (id === "haritada") { d.haritaSecili = e; d.sehir = e.il; return sekmeyeGec("harita"); }
    if (id === "detay-harita") return;
    if (id === "uc") return ucGezisi(e);
    if (id === "dalis") { d.dalis = dalisKareleri(dalisEserleri.get(e.id)); return; }
    if (id === "dalis-bitti") { d.dalis = null; return; }
    if (id === "hata") { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler! Editörlere iletildi."); return; }
  }

  async function acil(sekme) {
    d.acildi = true;
    await sekmeyeGec(sekme);
  }
  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.sekme = sekme;
    d.yigin = [{ ad: sekme }];
    d.dalis = null;
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  function sehirSec(ad) {
    d.sehir = ad === "hepsi" || !sehirMap.has(ad) ? "hepsi" : ad;
    d.sayfa = 1;
    d.tur = "hepsi";
    d.haritaSecili = null;
  }

  async function eserAc(e) {
    if (!e) return;
    const bulunan = kimlikle.get(e.id) ?? e;
    let baglar = [];
    try { baglar = (await eserler.iliskiler(bulunan.id)).filter((b) => b.diger); } catch { baglar = []; }
    git("eser", { eser: bulunan, baglar, uc: await ucVarMi(bulunan) });
    d.dalis = null;
    const i = sonBakilan.indexOf(bulunan.id);
    if (i >= 0) sonBakilan.splice(i, 1);
    sonBakilan.unshift(bulunan.id);
    await kaydet();
  }

  async function listeDegistir(e) {
    if (listem.has(e.id)) { listem.delete(e.id); await sahne.bildir("Listenden çıkarıldı"); }
    else { listem.add(e.id); await sahne.efekt("yildiz"); await sahne.bildir("Listene eklendi"); }
    await kaydet();
  }

  async function ucVarMi(e) {
    try { return await ekran.ucVarMi(e); } catch { return false; }
  }

  async function ucGezisi(e) {
    await ekran.uc({
      eser: e, baslik: e.ad,
      duraklar: [
        { odak: "genel", metin: "Eserin bugünkü hâli ve çevresi. Parmağınla çevir, iki parmakla yaklaş." },
        { odak: "yakin", metin: "Yakından: cephe ve çatı örtüsü." },
        { odak: "ust", baslik: "Kuşbakışı", metin: "Yukarıdan bakınca yapının planı ve çevresiyle ilişkisi görünür." },
      ],
    });
  }

  async function zamanCizelgesi() {
    const kapsam = sehirListesi().filter((e) => e.yuzyil);
    if (!kapsam.length) return sahne.bildir("Bu seçimde yapım yüzyılı kayıtlı eser yok.");
    await ekran.zaman(kapsam, { baslik: d.sehir === "hepsi" ? "Yüzyıllar boyunca vakıf eserleri" : `${d.sehir}: yüzyıllar boyunca` });
  }

  async function yakinimdakiler() {
    d.yakin = { durum: "bekliyor", liste: [] };
    await ciz();
    try {
      d.yakin = { durum: "tamam", liste: await eserler.yakindaki({ limit: 12 }) };
    } catch {
      d.yakin = { durum: "hata", liste: [] };
    }
  }

  async function dalisListesiAl() {
    try { return (await dalislar.liste()).filter((t) => t && t.eser && Array.isArray(t.kareler) && t.kareler.length); } catch { return []; }
  }

  // Dalış tanımını "dalis" düğümünün karelerine çevirir (d.ts'teki dönüşüm)
  function dalisKareleri(t) {
    if (!t) return null;
    return t.kareler.map((k) => ({
      gorsel: `/medya/dalis/${t.eser}/${k.g}.jpg`, etiket: k.t, portal: k.p, cikis: k.c, baslik: k.b, yazi: k.y,
      bakislar: (k.k ?? []).map((x) => ({ nokta: x.n, alan: x.a, ust: x.u, baslik: x.b, metin: x.m, kaynak: x.k })),
    }));
  }

  // ======================================================================
  // Yardımcılar
  // ======================================================================

  // Bilgisi en dolu, fotoğraflı ve bağı olan eserler önce
  function puan(e) {
    const t = eserler.tamlik(e);
    return t.oran * 10 + Math.min(e.fotograflar.length, 4) * 2 + (bagSayisi.get(e.id) ?? 0) * 1.5
      + (dalisEserleri.has(e.id) ? 4 : 0) + (e.konum && !e.konum.yaklasik ? 1 : 0);
  }
  function enIyiler(liste, adet) {
    return [...liste].filter((e) => e.fotograflar.length).sort((a, b) => puan(b) - puan(a)).slice(0, adet);
  }

  // Her şehirden en iyi eser, sonra genel sıralama
  function oneCikanlar() {
    const secilen = sehirler.map((s) => s.kapak).filter((e) => e && e.fotograflar.length);
    return secilen.slice(0, 9);
  }

  function sehirListesi() {
    return d.sehir === "hepsi" ? hepsi : sehirMap.get(d.sehir) ?? [];
  }

  function suzulmus() {
    const kucuk = (x) => String(x ?? "").toLocaleLowerCase("tr");
    const aranan = kucuk(d.arama);
    return sehirListesi()
      .filter((e) => d.tur === "hepsi" || e.tur === d.tur)
      .filter((e) => !aranan || kucuk(e.ad).includes(aranan) || kucuk(e.ilce).includes(aranan))
      .sort((a, b) => puan(b) - puan(a));
  }

  function turSecenekleri() {
    const sayilar = {};
    for (const e of sehirListesi()) sayilar[e.tur] = (sayilar[e.tur] ?? 0) + 1;
    return [{ id: "hepsi", metin: "Hepsi" },
      ...Object.entries(sayilar).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([t, n]) => ({ id: t, metin: `${TUR_ADI[t] ?? t} (${n})` }))];
  }

  function yerYazi(e) {
    return [e.ilce, e.il].filter(Boolean).join(", ");
  }
  function konumYazi(e) {
    if (!e.konum) return "Konum kayıtlı değil";
    return e.konum.yaklasik ? "Yaklaşık konum" : "Konum doğrulanmış";
  }
  function mesafeYazi(m) {
    return m == null ? "" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  }
  function kaynakAyir(kaynak) {
    // "Vikipedi, X (CC BY-SA 4.0) — https://..." → metin ve bağlantı ayrı satırda
    const s = String(kaynak ?? "");
    const i = s.indexOf(" — http");
    return i >= 0 ? { metin: s.slice(0, i), baglanti: s.slice(i + 3) } : { metin: s, baglanti: null };
  }
  function paragraflar(e) {
    return String(e.tarihce?.tr ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean)
      .filter((p, i) => !(i === 0 && e.adres && p.length < 220 && ADRES_DESENI.test(p)));
  }
  function haritaOdak() {
    if (d.sehir === "hepsi") return TURKIYE;
    const s = sehirler.find((x) => x.ad === d.sehir);
    return s?.merkez ? { lat: s.merkez.lat, lng: s.merkez.lng, zoom: s.ad === "Bursa" ? 12 : 13 } : TURKIYE;
  }
  function sehirEtiketleri() {
    return sehirler.filter((s) => s.merkez).map((s) => ({ lat: s.merkez.lat, lng: s.merkez.lng, metin: s.ad, alt: `${s.liste.length} eser`, acik: d.sehir === "hepsi" || d.sehir === s.ad }));
  }
  function haritaBaglari(liste) {
    const idler = new Set(liste.map((e) => e.id));
    return iliskiler.filter((i) => idler.has(i.a) && idler.has(i.b)).map((i) => ({ a: i.a, b: i.b, tur: i.tur, etiket: i.baslik }));
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  async function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const ekranlar = { kesfet: kesfetEkrani, harita: haritaEkrani, yakin: yakinEkrani, listem: listemEkrani, eser: () => eserEkrani(ust()) };
    return sahne.ciz((ekranlar[ust().ad] ?? kesfetEkrani)());
  }

  function kapakEkrani() {
    const kapak = kimlikle.get("bursa-ulucami") ?? oneCikanlar()[0] ?? hepsi[0];
    return {
      tip: "kapak", ust: "Lonca · Vakıf mirası", baslik: "Eser Keşfi", eser: kapak, renk: "firuze",
      alt: `${sehirler.length} şehirde ${hepsi.length} vakıf eseri, ${iliskiler.length} kaynaklı tarihsel bağ. Her eserin tarihçesi, fotoğrafları ve kaynağı bir dokunuş uzağında.`,
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Keşfe başla", ikon: "pusula" },
        { tip: "satir", cocuklar: [
          { tip: "dugme", id: "kapak-harita", metin: "Haritada gez", ikon: "harita", tur: "ikincil" },
          { tip: "dugme", id: "kapak-yakin", metin: "Yakınımdakiler", ikon: "konum", tur: "ikincil" },
        ] },
      ],
    };
  }

  function sehirKartlari() {
    return [
      { tip: "kart", id: "sehir-hepsi", renk: d.sehir === "hepsi" ? "firuze" : undefined, cocuklar: [
        { tip: "baslik", metin: "Bütün şehirler", boyut: 3 },
        { tip: "metin", metin: `${hepsi.length} eser`, soluk: true },
      ] },
      ...sehirler.map((s) => ({ tip: "kart", id: `sehir-${s.ad}`, renk: d.sehir === s.ad ? "firuze" : undefined, cocuklar: [
        { tip: "baslik", metin: s.ad, boyut: 3 },
        { tip: "metin", metin: `${s.liste.length} eser`, soluk: true },
      ] })),
    ];
  }

  function kesfetEkrani() {
    const sonuc = suzulmus();
    const gosterilen = sonuc.slice(0, d.sayfa * SAYFA_BOYU);
    const sehirSecili = d.sehir !== "hepsi";
    const s = sehirSecili ? sehirler.find((x) => x.ad === d.sehir) : null;
    const son = sonBakilan.map((id) => kimlikle.get(id)).filter(Boolean).slice(0, 8);
    const suzgecVar = d.arama || d.tur !== "hepsi";
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Keşfet", alt: sehirSecili ? `${d.sehir} · ${s?.liste.length ?? 0} eser` : `${sehirler.length} şehir · ${hepsi.length} eser`,
          sag: [{ id: "zaman", ikon: "zaman", etiket: "Zaman çizelgesi" }] },
        { tip: "baslik", metin: "Şehir seç", boyut: 3 },
        { tip: "kaydirma", cocuklar: sehirKartlari() },
        ...(sehirSecili && s?.kapak
          ? [
            { tip: "baslik", metin: `${d.sehir}: öne çıkanlar`, boyut: 2 },
            { tip: "metin", metin: `${s.liste.length} vakıf eseri · ${s.konumlu.length} tanesi haritada`, soluk: true },
            { tip: "kaydirma", cocuklar: enIyiler(s.liste, 6).map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "buyuk" })) },
          ]
          : [
            { tip: "baslik", metin: "Her şehirden öne çıkanlar", boyut: 2 },
            { tip: "kaydirma", cocuklar: oneCikanlar().map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "buyuk" })) },
          ]),
        ...(son.length && !sehirSecili ? [
          { tip: "baslik", metin: "Son baktıkların", boyut: 3 },
          { tip: "kaydirma", cocuklar: son.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
        ] : []),
        { tip: "baslik", metin: sehirSecili ? `${d.sehir} eserleri` : "Bütün eserler", boyut: 2 },
        { tip: "girdi", id: "ara", ipucu: "Eser ya da ilçe ara (ör. han, Osmangazi)", deger: d.arama, dugme: "Ara" },
        { tip: "secenekler", id: "tur", secenekler: turSecenekleri(), secili: d.tur },
        sonuc.length
          ? { tip: "izgara", sutun: 2, cocuklar: gosterilen.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) }
          : { tip: "kart", cocuklar: [
            { tip: "metin", metin: "Bu süzgeçlere uyan eser yok.", ortali: true },
            { tip: "dugme", id: "aramayi-temizle", metin: "Süzgeçleri temizle", ikon: "tekrar", tur: "ikincil" },
          ] },
        gosterilen.length < sonuc.length
          ? { tip: "dugme", id: "daha", metin: `Daha fazla göster (${sonuc.length - gosterilen.length})`, tur: "ikincil" }
          : { tip: "metin", metin: `${sonuc.length} eser${suzgecVar ? " · süzgeç açık" : ""}`, soluk: true, ortali: true },
        { tip: "metin", metin: "Eserler bilgisi en dolu olandan başlayarak sıralanır. Bütün bilgiler eser kaydındaki kaynaktan gelir.", soluk: true },
      ],
    };
  }

  function haritaEkrani() {
    const liste = d.sehir === "hepsi" ? konumluHepsi : (sehirMap.get(d.sehir) ?? []).filter((e) => e.konum);
    const yaklasikSayi = liste.filter((e) => e.konum.yaklasik).length;
    const sec = d.haritaSecili;
    const sehirToplam = sehirListesi().length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Harita", alt: `${d.sehir === "hepsi" ? "Türkiye" : d.sehir} · ${liste.length} eser` },
        { tip: "kaydirma", cocuklar: sehirKartlari() },
        { tip: "harita", id: "harita", eserler: liste, secili: sec?.id, baglantilar: haritaBaglari(liste), etiketler: sehirEtiketleri(), odak: haritaOdak() },
        sec
          ? { tip: "kart", renk: "firuze", cocuklar: [
            { tip: "eser", eser: sec, id: "eser", boyut: "satir" },
            { tip: "cipler", ogeler: [yerYazi(sec), konumYazi(sec)] },
            { tip: "dugme", id: "secili-ac", metin: "Eserin sayfasını aç", ikon: "bilgi", tur: "ikincil" },
          ] }
          : { tip: "kart", cocuklar: [{ tip: "metin", metin: "Bir pine dokun, eserin özeti burada belirsin. Çizgiler kaynaklı tarihsel bağlardır.", ortali: true }] },
        { tip: "dugme", id: "yakinim", metin: "Yakınımdaki eserler", ikon: "konum", tur: "ikincil" },
        { tip: "metin", soluk: true, metin: `Haritada yalnızca konumu kayıtlı eserler var (${liste.length}/${sehirToplam}).`
          + (yaklasikSayi ? ` Bunların ${yaklasikSayi} tanesinin konumu yaklaşıktır; pin yapının tam yerini değil, bulunduğu çevreyi gösterir.` : "") },
      ],
    };
  }

  function yakinEkrani() {
    const y = d.yakin;
    const ustCubuk = { tip: "ust_cubuk", baslik: "Yakınımda", alt: "Konumun yalnızca bu sorgu için kullanılır" };
    if (!y) return { tip: "sutun", cocuklar: [ustCubuk,
      { tip: "kart", cocuklar: [
        { tip: "baslik", metin: "Çevrendeki vakıf eserleri", boyut: 3 },
        { tip: "metin", metin: "Konum izni verirsen sana en yakın vakıf eserlerini uzaklıklarıyla birlikte gösteririz." },
        { tip: "dugme", id: "yakinim", metin: "Yakınımdakileri bul", ikon: "konum" },
      ] }] };
    if (y.durum === "bekliyor") return { tip: "sutun", cocuklar: [ustCubuk, { tip: "kart", cocuklar: [{ tip: "metin", metin: "Konumun soruluyor…", ortali: true }] }] };
    if (y.durum === "hata" || !y.liste.length) return { tip: "sutun", cocuklar: [ustCubuk,
      { tip: "kart", cocuklar: [
        { tip: "baslik", metin: "Konumuna ulaşılamadı", boyut: 3 },
        { tip: "metin", metin: "Konum izni vermediysen ya da cihazın konumu bilmiyorsa yakındaki eserler gösterilemez. Haritadan da gezebilirsin." },
        { tip: "dugme", id: "yakinim", metin: "Tekrar dene", ikon: "tekrar", tur: "ikincil" },
      ] }] };
    const ornek = y.liste[0]?.ornek_konum;
    return {
      tip: "sutun", cocuklar: [
        ustCubuk,
        ornek ? { tip: "kart", renk: "mercan", cocuklar: [{ tip: "metin", metin: "Konumuna ulaşılamadı (izin verilmedi ya da cihaz bilmiyor). Uzaklıklar Bursa merkezine göre gösteriliyor." }] } : { tip: "bosluk" },
        { tip: "harita", id: "harita", eserler: y.liste },
        { tip: "liste", ogeler: y.liste.map((e) => ({
          id: `yakin-${e.id}`, metin: e.ad, ikon: "konum", sag: mesafeYazi(e.mesafe_m),
          alt: [TUR_ADI[e.tur], yerYazi(e), e.konum?.yaklasik ? "yaklaşık konum" : null].filter(Boolean).join(" · "),
        })) },
        { tip: "dugme", id: "yakinim", metin: "Yenile", ikon: "tekrar", tur: "hayalet" },
        { tip: "metin", metin: "Uzaklıklar kuş uçuşudur. Konumu yaklaşık olan eserlerde gerçek uzaklık biraz farklı olabilir.", soluk: true },
      ],
    };
  }

  function listemEkrani() {
    const liste = [...listem].map((id) => kimlikle.get(id)).filter(Boolean);
    const son = sonBakilan.map((id) => kimlikle.get(id)).filter(Boolean);
    const gezilenSehir = new Set(son.map((e) => e.il)).size;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Listem", alt: "Gitmek istediğin eserler" },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: liste.length, etiket: "listende", ikon: "kalp" },
          { tip: "istatistik", deger: son.length, etiket: "son bakılan", ikon: "pusula" },
          { tip: "istatistik", deger: `${gezilenSehir}/${sehirler.length}`, etiket: "şehir", ikon: "harita" },
        ] },
        liste.length
          ? { tip: "izgara", sutun: 2, cocuklar: liste.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) }
          : { tip: "kart", cocuklar: [{ tip: "metin", metin: "Bir eserin sayfasındaki “Listeme ekle” düğmesiyle gezmek istediğin eserleri burada topla.", ortali: true }] },
        ...(liste.filter((e) => e.konum).length >= 2 ? [
          { tip: "baslik", metin: "Listen haritada", boyut: 3 },
          { tip: "harita", id: "harita", eserler: liste.filter((e) => e.konum), rota: true },
        ] : []),
        ...(son.length ? [
          { tip: "baslik", metin: "Son baktıkların", boyut: 3 },
          { tip: "liste", ogeler: son.map((e) => ({ id: `son-${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], yerYazi(e)].filter(Boolean).join(" · "), ikon: "zaman" })) },
        ] : []),
      ],
    };
  }

  function eserEkrani(kayit) {
    const e = kayit.eser;
    if (d.dalis) {
      return { tip: "dalis", id: "dalis", etiket: e.ad, kareler: d.dalis, cocuklar: [
        { tip: "dugme", id: "dalis-bitti", metin: "Eser sayfasına dön", ikon: "geri" },
      ] };
    }
    const t = eserler.tamlik(e);
    const metinler = paragraflar(e);
    const kaynak = kaynakAyir(e.kaynak);
    const baglar = kayit.baglar ?? [];
    const bagKaynaklari = [...new Set(baglar.map((b) => b.kaynak).filter(Boolean))];
    const ayniSehir = (sehirMap.get(e.il) ?? []).filter((x) => x.id !== e.id && x.fotograflar.length)
      .sort((a, b) => Number(b.tur === e.tur) - Number(a.tur === e.tur) || puan(b) - puan(a)).slice(0, 8);
    const dalisVar = dalisEserleri.has(e.id);

    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [TUR_ADI[e.tur], yerYazi(e)].filter(Boolean).join(" · "), geri: "geri",
          sag: [{ id: "listeye", ikon: "kalp", etiket: listem.has(e.id) ? "Listemden çıkar" : "Listeme ekle" }] },
        e.fotograflar.length ? { tip: "fotograflar", eser: e } : { tip: "gorsel", eser: e },
        { tip: "cipler", ogeler: [
          TUR_ADI[e.tur] ?? "Eser",
          e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi kayıtlı değil",
          e.il,
          konumYazi(e),
          e.fotograflar.length > 1 ? `${e.fotograflar.length} fotoğraf` : null,
          listem.has(e.id) ? "♥ Listende" : null,
        ].filter(Boolean) },
        ...(e.ad_en ? [{ tip: "metin", metin: e.ad_en, soluk: true }] : []),

        // Eylemler
        ...(dalisVar ? [{ tip: "dugme", id: "dalis", metin: "Eserin içine dal", ikon: "kamera" }] : []),
        ...(kayit.uc ? [{ tip: "dugme", id: "uc", metin: "Gerçek 3B'de gez", ikon: "kup", tur: dalisVar ? "ikincil" : "ana" }] : []),
        { tip: "izgara", sutun: 2, cocuklar: [
          { tip: "dugme", id: "listeye", metin: listem.has(e.id) ? "Listemde" : "Listeme ekle", ikon: "kalp", tur: "ikincil" },
          { tip: "dugme", id: "haritada", metin: "Haritada gör", ikon: "harita", tur: "ikincil", devre_disi: !e.konum },
        ] },

        // Tarihçe
        { tip: "baslik", metin: "Tarihçe", boyut: 2 },
        ...(metinler.length
          ? metinler.slice(0, 8).map((p) => ({ tip: "metin", metin: p }))
          : [{ tip: "metin", metin: "Bu eser için kayıtlı tarihçe metni yok.", soluk: true }]),

        // Konum
        ...(e.konum ? [
          { tip: "baslik", metin: "Konum", boyut: 2 },
          { tip: "harita", id: "detay-harita", eserler: [e], secili: e.id, odak: { lat: e.konum.lat, lng: e.konum.lng, zoom: e.konum.yaklasik ? 14 : 16 } },
          e.konum.yaklasik
            ? { tip: "kart", renk: "altin", cocuklar: [
              { tip: "baslik", metin: "Yaklaşık konum", boyut: 3 },
              { tip: "metin", metin: "Bu eserin kesin koordinatı kaynakta yok; pin bulunduğu mahalleyi ya da çevreyi gösterir. Yerinde adresi ve tabelaları izle." },
            ] }
            : { tip: "metin", metin: "Konum, eser kaydındaki koordinattan gösteriliyor.", soluk: true },
        ] : [{ tip: "kart", cocuklar: [{ tip: "metin", metin: "Bu eserin konumu henüz kayıtlı değil. Biliyorsan aşağıdan editörlere bildirebilirsin." }] }]),
        ...(e.adres ? [{ tip: "metin", metin: `Adres: ${e.adres}` }] : []),

        // Tarihsel bağlar
        ...(baglar.length ? [
          { tip: "baslik", metin: "Tarihsel bağlar", boyut: 2 },
          { tip: "graf", id: "bag", merkez: e, iliskiler: baglar.slice(0, 8).map((b) => ({ eser: b.diger, tur: b.tur, baslik: b.baslik })) },
          { tip: "baslik", metin: "Bağlar ne anlatıyor?", boyut: 3 },
          { tip: "liste", ogeler: baglar.map((b) => ({
            id: `bag-${b.id}`, metin: `${b.diger.ad} · ${b.baslik}`, ikon: "ok",
            alt: `${BAG_ADI[b.tur] ?? b.tur}${b.diger.il !== e.il ? ` · ${b.diger.il}` : ""} — ${b.aciklama}`,
          })) },
        ] : []),

        // Kaynaklar ve bilgi kartı
        { tip: "kart", cocuklar: [
          { tip: "baslik", metin: "Kaynaklar", boyut: 3 },
          { tip: "metin", metin: kaynak.metin },
          ...(kaynak.baglanti ? [{ tip: "metin", metin: kaynak.baglanti, soluk: true }] : []),
          ...bagKaynaklari.map((k) => ({ tip: "metin", metin: `Bağlar için: ${k}`, soluk: true })),
          { tip: "ayrac" },
          { tip: "ilerleme", deger: eserler.TEMEL_ALANLAR.length - t.eksikler.length, toplam: eserler.TEMEL_ALANLAR.length, etiket: "Kayıtlı temel bilgiler" },
          { tip: "metin", soluk: true, metin: t.tam ? "Bu eserin bütün temel bilgileri kayıtlı."
            : `Eksik: ${t.eksikler.map((a) => ALAN_ADI[a] ?? a).join(", ")}. Biliyorsan editörlere bildirebilirsin.` },
        ] },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },

        // Aynı şehirden
        ...(ayniSehir.length ? [
          { tip: "baslik", metin: `Aynı şehirden: ${e.il}`, boyut: 3 },
          { tip: "kaydirma", cocuklar: ayniSehir.map((x) => ({ tip: "eser", eser: x, id: "eser", boyut: "kucuk" })) },
        ] : []),
      ],
    };
  }
}
