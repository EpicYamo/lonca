import { sahne, ekran, eserler, depo, dalislar } from "@lonca/sdk";

// Eser Keşfi: bütün vakıf eserlerinin cep ansiklopedisi. İl → ilçe → eser diye iner,
// türe göre süzer, adla ya da tarihçede geçen bir kelimeyle arar, kaynaklı tarihsel bağları konu konu gezersin.
// Her eser sayfası kaydın tamamını gösterir: fotoğraflar, tarihçe, adres, harita, bağlar, varsa dalış ve kaynak.

const SEKMELER = [
  { id: "sehirler", ad: "Şehirler", ikon: "harita" },
  { id: "ara", ad: "Ara", ikon: "arama" },
  { id: "baglar", ad: "Bağlar", ikon: "kalp" },
  { id: "listem", ad: "Listem", ikon: "liste" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
const BAG_ADI = { kulliye: "Aynı külliyenin parçaları", bani: "Aynı bani", mimar: "Aynı mimar", vakif: "Vakıf bağları", aile: "Aile bağları",
  ticaret: "Ticaret bağları", metin: "Kayıtlarda birbirini anan eserler", komsu: "Komşu yapılar", tipoloji: "Benzer tipler" };
const IL_RENK = { Bursa: "firuze", Konya: "altin", Hatay: "mercan" };
const SAYFA = 24;
const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;

export default async function basla() {
  // ---------- Veri ----------
  const hepsi = await eserler.liste({});
  const kimlikle = new Map(hepsi.map((e) => [e.id, e]));
  const iliskiler = (await eserler.iliskiler()).filter((i) => kimlikle.has(i.a) && kimlikle.has(i.b));
  const dalisListesi = await dalisListesiAl();
  const dalisli = new Map(dalisListesi.map((t) => [t.eser, t]));
  const iller = sayim(hepsi, (e) => e.il).map(([il]) => il);

  const listem = new Set((await depo.oku("listem")) ?? []);
  const sonBakilan = /** @type {string[]} */ ((await depo.oku("son-bakilan")) ?? []);

  // ---------- Durum ----------
  /** @type {any} */
  const d = { acildi: false, yigin: [{ ad: "sehirler" }], arama: "", aramaTur: "hepsi", aramaIl: "hepsi", sayfa: 1, tamOku: false, dalis: null, haritada: false };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => { d.tamOku = false; d.dalis = null; d.yigin.push({ ad, tur: "hepsi", sayfa: 1, haritada: false, ...ek }); };

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
      const u = ust();
      if (olay.id === "tur") { u.tur = olay.deger; u.sayfa = 1; }
      if (olay.id === "gorunum") u.haritada = olay.deger === "harita";
      if (olay.id === "ara-tur") { d.aramaTur = olay.deger; d.sayfa = 1; }
      if (olay.id === "ara-il") { d.aramaIl = olay.deger; d.sayfa = 1; }
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "kapak-sehirler") return sekmeyeGec("sehirler");
    if (id === "kapak-ara") return sekmeyeGec("ara");
    if (id === "kapak-baglar") return sekmeyeGec("baglar");
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); d.tamOku = false; d.dalis = null; return; }
    if (id === "devam") { d.tamOku = !d.tamOku; return; }
    if (id === "daha") { ust().sayfa++; return; }
    if (id === "ara-daha") { d.sayfa++; return; }
    if (id === "aramayi-temizle") { d.arama = ""; d.aramaTur = "hepsi"; d.aramaIl = "hepsi"; d.sayfa = 1; return; }

    if (id.startsWith("il-")) return git("il", { il: id.slice(3) });
    if (id.startsWith("ilce-")) { const [il, ilce] = id.slice(5).split("|"); return git("ilce", { il, ilce }); }
    if (id.startsWith("bagtur-")) return git("bagtur", { bagTur: id.slice(7) });
    if (id.startsWith("bag-")) { const bag = iliskiler.find((i) => i.id === id.slice(4)); if (bag) git("bag", { bag }); return; }
    if (id.startsWith("bag:")) { const bag = iliskiler.find((i) => i.id === id.slice(4)); if (bag) git("bag", { bag }); return; }
    if (id.startsWith("eser:") || id.startsWith("son-") || id.startsWith("lst-")) {
      const k = olay.eser?.id ?? id.slice(id.indexOf(id.startsWith("eser:") ? ":" : "-") + 1);
      return eserAc(kimlikle.get(k));
    }
    if (olay.eser && (id === "eser" || id.endsWith("-pin"))) return eserAc(kimlikle.get(olay.eser.id));

    const e = ust().eser;
    if (!e) return;
    if (id === "listeye") {
      if (listem.has(e.id)) listem.delete(e.id); else { listem.add(e.id); await sahne.efekt("yildiz"); }
      await depo.yaz("listem", [...listem]);
      return;
    }
    if (id === "dalis") { d.dalis = dalisKareleri(dalisli.get(e.id)); return; }
    if (id === "dalis-bitti") { d.dalis = null; return; }
    if (id === "uc") return ucGezisi(e);
    if (id === "hata") { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler, editörlere iletildi."); }
  }

  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.yigin = [{ ad: sekme, tur: "hepsi", sayfa: 1 }];
    d.tamOku = false;
    d.dalis = null;
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  async function eserAc(e) {
    if (!e) return;
    git("eser", { eser: e, uc: e.konum ? await ekran.ucVarMi(e).catch(() => false) : false });
    const i = sonBakilan.indexOf(e.id);
    if (i >= 0) sonBakilan.splice(i, 1);
    sonBakilan.unshift(e.id);
    await depo.yaz("son-bakilan", sonBakilan.slice(0, 12));
  }

  async function ucGezisi(e) {
    await ekran.uc({ eser: e, baslik: e.ad, duraklar: [
      { odak: "genel", metin: "Eserin bugünkü hâli ve çevresi. Parmağınla çevir, iki parmakla yaklaş." },
      { odak: "ust", metin: "Kuşbakışı: yapının çevresiyle ilişkisi." },
      { odak: "yakin", metin: "Yakından: cephe ve giriş." },
    ] });
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

  function bagSayisi(e) {
    return iliskiler.filter((i) => i.a === e.id || i.b === e.id).length;
  }
  function sirala(liste) {
    const p = (e) => (e.fotograflar.length ? 10 : 0) + Math.min(4, e.fotograflar.length) + bagSayisi(e) * 2 + (dalisli.has(e.id) ? 6 : 0) + (e.yuzyil ? 2 : 0);
    return [...liste].sort((a, b) => p(b) - p(a) || a.ad.localeCompare(b.ad, "tr"));
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const u = ust();
    if (u.ad === "il") return sahne.ciz(ilEkrani(u));
    if (u.ad === "ilce") return sahne.ciz(ilceEkrani(u));
    if (u.ad === "eser") return sahne.ciz(eserEkrani(u));
    if (u.ad === "bagtur") return sahne.ciz(bagTurEkrani(u.bagTur));
    if (u.ad === "bag") return sahne.ciz(bagEkrani(u.bag));
    if (u.ad === "ara") return sahne.ciz(araEkrani());
    if (u.ad === "baglar") return sahne.ciz(baglarEkrani());
    if (u.ad === "listem") return sahne.ciz(listemEkrani());
    return sahne.ciz(sehirlerEkrani());
  }

  function kapakEkrani() {
    return {
      tip: "kapak", ust: "Lonca · Vakıf mirası ansiklopedisi", baslik: "Eser Keşfi", renk: "firuze",
      eser: kimlikle.get("bursa-ulucami") ?? sirala(hepsi)[0],
      alt: `${iller.length} şehir, ${new Set(hepsi.map((e) => `${e.il}|${e.ilce}`)).size} ilçe, ${hepsi.length} vakıf eseri ve ${iliskiler.length} kaynaklı tarihsel bağ. Şehirden ilçeye, ilçeden esere in.`,
      cocuklar: [
        { tip: "dugme", id: "kapak-sehirler", metin: "Şehirlerden başla", ikon: "harita" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "kapak-ara", metin: "Eser ara", ikon: "arama", tur: "ikincil" },
          { tip: "dugme", id: "kapak-baglar", metin: "Bağlar", ikon: "kalp", tur: "ikincil" },
        ] },
      ],
    };
  }

  function sehirlerEkrani() {
    const son = sonBakilan.map((k) => kimlikle.get(k)).filter(Boolean).slice(0, 8);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Şehirler", alt: `${iller.length} şehir · ${hepsi.length} eser` },
        ...(son.length ? [
          { tip: "baslik", metin: "Son baktıkların", boyut: 3 },
          { tip: "kaydirma", cocuklar: son.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
        ] : []),
        ...iller.map((il) => {
          const liste = hepsi.filter((e) => e.il === il);
          return { tip: "kart", id: `il-${il}`, renk: IL_RENK[il], cocuklar: [
            { tip: "afis", baslik: il, alt: `${liste.length} eser · ${new Set(liste.map((e) => e.ilce)).size} ilçe`, eser: sirala(liste)[0], renk: IL_RENK[il] },
            { tip: "cipler", ogeler: sayim(liste, (e) => e.tur).slice(0, 4).map(([t, n]) => `${n} ${TUR_ADI[t] ?? t}`) },
          ] };
        }),
      ],
    };
  }

  function turSecenekleri(liste, secili) {
    const s = sayim(liste, (e) => e.tur).slice(0, 6);
    return { tip: "secenekler", id: "tur", secili, secenekler: [{ id: "hepsi", metin: "Hepsi" }, ...s.map(([t, n]) => ({ id: t, metin: `${TUR_ADI[t] ?? t} ${n}` }))] };
  }

  function ilEkrani(u) {
    const liste = hepsi.filter((e) => e.il === u.il);
    const ilceler = sayim(liste, (e) => e.ilce ?? "Belirsiz");
    const fotolu = sirala(liste).filter((e) => e.fotograflar.length).slice(0, 10);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: u.il, alt: `${liste.length} vakıf eseri`, geri: "geri" },
        { tip: "afis", baslik: u.il, alt: `${ilceler.length} ilçe · ${liste.filter((e) => e.fotograflar.length).length} fotoğraflı · ${liste.filter((e) => e.konum).length} haritada`, eser: fotolu[0], renk: IL_RENK[u.il] },
        { tip: "baslik", metin: "Öne çıkanlar", boyut: 3 },
        { tip: "kaydirma", cocuklar: fotolu.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
        { tip: "baslik", metin: "İlçeler", boyut: 2 },
        { tip: "liste", ogeler: ilceler.map(([ilce, n]) => {
          const l = liste.filter((e) => (e.ilce ?? "Belirsiz") === ilce);
          return { id: `ilce-${u.il}|${ilce}`, metin: ilce, alt: sayim(l, (e) => e.tur).slice(0, 3).map(([t, k]) => `${k} ${(TUR_ADI[t] ?? t).toLocaleLowerCase("tr")}`).join(", "), ikon: "konum", sag: `${n}` };
        }) },
      ],
    };
  }

  function ilceEkrani(u) {
    const tumu = sirala(hepsi.filter((e) => e.il === u.il && (e.ilce ?? "Belirsiz") === u.ilce));
    const liste = u.tur === "hepsi" ? tumu : tumu.filter((e) => e.tur === u.tur);
    const konumlu = liste.filter((e) => e.konum);
    const gorunen = liste.slice(0, u.sayfa * SAYFA);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: u.ilce, alt: `${u.il} · ${tumu.length} eser`, geri: "geri" },
        turSecenekleri(tumu, u.tur),
        ...(konumlu.length ? [{ tip: "secenekler", id: "gorunum", secili: u.haritada ? "harita" : "liste", secenekler: [{ id: "liste", metin: "Liste" }, { id: "harita", metin: `Harita (${konumlu.length})` }] }] : []),
        ...(u.haritada && konumlu.length
          ? [{ tip: "harita", id: "ilce-pin", eserler: konumlu }, { tip: "metin", metin: "Bir pine dokun, eser sayfası açılsın.", soluk: true, ortali: true }]
          : [
            { tip: "izgara", sutun: 2, cocuklar: gorunen.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
            ...(liste.length > gorunen.length ? [{ tip: "dugme", id: "daha", metin: `Daha fazla (${liste.length - gorunen.length})`, ikon: "liste", tur: "hayalet" }] : []),
          ]),
      ],
    };
  }

  function eserEkrani(u) {
    const e = u.eser;
    if (d.dalis) {
      return { tip: "dalis", id: "dalis", etiket: e.ad, kareler: d.dalis, cocuklar: [
        { tip: "dugme", id: "dalis-bitti", metin: "Eser sayfasına dön", ikon: "geri" },
      ] };
    }
    const p = paragraflar(e);
    const gorunen = d.tamOku ? p : p.slice(0, 3);
    const baglar = iliskiler.filter((i) => i.a === e.id || i.b === e.id);
    const tamlik = eserler.tamlik(e);
    const ayniIlce = sirala(hepsi.filter((x) => x.id !== e.id && x.il === e.il && x.ilce === e.ilce && x.fotograflar.length)).slice(0, 8);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [TUR_ADI[e.tur], e.ilce, e.il].filter(Boolean).join(" · "), geri: "geri" },
        { tip: "fotograflar", eser: e },
        { tip: "baslik", metin: e.ad, boyut: 1 },
        ...(e.ad_en && e.ad_en !== e.ad ? [{ tip: "metin", metin: e.ad_en, soluk: true }] : []),
        { tip: "cipler", ogeler: [TUR_ADI[e.tur] ?? e.tur, e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor", [e.ilce, e.il].filter(Boolean).join(", "), ...(listem.has(e.id) ? ["Listemde ♥"] : [])] },
        { tip: "satir", hizala: "yay", cocuklar: [
          ...(dalisli.has(e.id) ? [{ tip: "dugme", id: "dalis", metin: "İçine dal", ikon: "kamera" }] : []),
          { tip: "dugme", id: "listeye", metin: listem.has(e.id) ? "Listemde ♥" : "Listeme ekle", ikon: "kalp", tur: dalisli.has(e.id) ? "ikincil" : "ana" },
        ] },
        { tip: "baslik", metin: "Tarihçe", boyut: 2 },
        ...(gorunen.length ? gorunen.map((m) => ({ tip: "metin", metin: m })) : [{ tip: "metin", metin: "Bu eserin kaydında tarihçe yok.", soluk: true }]),
        ...(p.length > 3 ? [{ tip: "dugme", id: "devam", metin: d.tamOku ? "Daha az göster" : `Devamını oku (${p.length - 3} paragraf)`, ikon: "kitap", tur: "hayalet" }] : []),
        ...(e.adres ? [{ tip: "baslik", metin: "Adres", boyut: 3 }, { tip: "metin", metin: e.adres }] : []),
        ...(e.konum ? [
          { tip: "harita", id: "eser-konum", eserler: [e], secili: e.id },
          ...(e.konum.yaklasik ? [{ tip: "metin", metin: "Konum yaklaşıktır.", soluk: true }] : []),
        ] : [{ tip: "metin", metin: "Bu eserin konumu kayıtlı değil.", soluk: true }]),
        ...(u.uc ? [{ tip: "dugme", id: "uc", metin: "Gerçek 3B'de gez", ikon: "kup", tur: "ikincil" }] : []),
        ...(baglar.length ? [
          { tip: "baslik", metin: "Tarihsel bağlar", boyut: 2 },
          { tip: "graf", id: "bag", merkez: e, iliskiler: baglar.map((i) => ({ eser: kimlikle.get(i.a === e.id ? i.b : i.a), tur: i.tur, baslik: i.baslik, aciklama: i.aciklama, kaynak: i.kaynak })) },
        ] : []),
        ...(ayniIlce.length ? [
          { tip: "baslik", metin: `${e.ilce ?? e.il} ilçesinden`, boyut: 3 },
          { tip: "kaydirma", cocuklar: ayniIlce.map((x) => ({ tip: "eser", eser: x, id: "eser", boyut: "kucuk" })) },
        ] : []),
        { tip: "baslik", metin: "Kayıt", boyut: 3 },
        { tip: "ilerleme", deger: Math.round(tamlik.oran * 100), toplam: 100, etiket: "Kaydın tamlığı (%)" },
        ...(tamlik.eksikler.length ? [{ tip: "metin", metin: `Eksik alanlar: ${tamlik.eksikler.join(", ")}`, soluk: true }] : []),
        { tip: "metin", metin: `Kaynak: ${e.kaynak}`, soluk: true },
        { tip: "dugme", id: "listeye", metin: listem.has(e.id) ? "Listemden çıkar" : "Listeme ekle", ikon: "kalp", tur: "ikincil" },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function araEkrani() {
    const q = d.arama.toLocaleLowerCase("tr");
    let liste = hepsi;
    if (d.aramaIl !== "hepsi") liste = liste.filter((e) => e.il === d.aramaIl);
    if (d.aramaTur !== "hepsi") liste = liste.filter((e) => e.tur === d.aramaTur);
    let adda = liste, metinde = [];
    if (q) {
      adda = liste.filter((e) => `${e.ad} ${e.ad_en ?? ""} ${e.ilce ?? ""}`.toLocaleLowerCase("tr").includes(q));
      metinde = liste.filter((e) => !adda.includes(e) && String(e.tarihce?.tr ?? "").toLocaleLowerCase("tr").includes(q));
    }
    const sonuc = q ? [...sirala(adda), ...sirala(metinde)] : sirala(liste);
    const gorunen = sonuc.slice(0, d.sayfa * SAYFA);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Ara", alt: q ? `"${d.arama}" · ${sonuc.length} sonuç` : `${sonuc.length} eser` },
        { tip: "girdi", id: "ara", ipucu: "Ad, ilçe ya da bir kelime", deger: d.arama, dugme: "Ara" },
        { tip: "secenekler", id: "ara-il", secili: d.aramaIl, secenekler: [{ id: "hepsi", metin: "Bütün iller" }, ...iller.map((il) => ({ id: il, metin: il }))] },
        { tip: "secenekler", id: "ara-tur", secili: d.aramaTur, secenekler: [{ id: "hepsi", metin: "Her tür" }, ...sayim(hepsi, (e) => e.tur).slice(0, 7).map(([t]) => ({ id: t, metin: TUR_ADI[t] ?? t }))] },
        ...(q && metinde.length ? [{ tip: "metin", metin: `${adda.length} eserin adında, ${metinde.length} eserin tarihçesinde geçiyor.`, soluk: true }] : []),
        ...(sonuc.length
          ? [{ tip: "liste", ogeler: gorunen.map((e) => ({ id: `eser:${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], [e.ilce, e.il].filter(Boolean).join(", "), e.yuzyil ? `${e.yuzyil}. yy` : null].filter(Boolean).join(" · "), ikon: e.fotograflar.length ? "kamera" : "konum", sag: listem.has(e.id) ? "♥" : undefined })) }]
          : [{ tip: "metin", metin: "Sonuç yok. Başka bir kelime dene.", ortali: true }]),
        ...(sonuc.length > gorunen.length ? [{ tip: "dugme", id: "ara-daha", metin: `Daha fazla (${sonuc.length - gorunen.length})`, ikon: "liste", tur: "hayalet" }] : []),
        ...(q || d.aramaIl !== "hepsi" || d.aramaTur !== "hepsi" ? [{ tip: "dugme", id: "aramayi-temizle", metin: "Süzgeçleri temizle", ikon: "tekrar", tur: "hayalet" }] : []),
      ],
    };
  }

  function baglarEkrani() {
    const turler = sayim(iliskiler, (i) => i.tur);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Tarihsel bağlar", alt: `${iliskiler.length} kaynaklı bağ` },
        { tip: "metin", metin: "Eserler yalnız değildir: aynı külliyenin parçaları, aynı baninin yaptırdıkları, aynı ailenin türbeleri… Her bağ envanter kayıtlarına dayanır.", soluk: true },
        { tip: "liste", ogeler: turler.map(([t, n]) => ({ id: `bagtur-${t}`, metin: BAG_ADI[t] ?? t, alt: iliskiler.filter((i) => i.tur === t).slice(0, 2).map((i) => i.baslik).join(" · "), ikon: "kalp", sag: `${n}` })) },
      ],
    };
  }

  function bagTurEkrani(tur) {
    const liste = iliskiler.filter((i) => i.tur === tur);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: BAG_ADI[tur] ?? tur, alt: `${liste.length} bağ`, geri: "geri" },
        { tip: "liste", ogeler: liste.map((i) => ({ id: `bag-${i.id}`, metin: `${kimlikle.get(i.a).ad} ↔ ${kimlikle.get(i.b).ad}`, alt: i.baslik, ikon: "kalp" })) },
      ],
    };
  }

  function bagEkrani(bag) {
    const a = kimlikle.get(bag.a), b = kimlikle.get(bag.b);
    const konumlu = [a, b].filter((e) => e.konum);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: bag.baslik, alt: BAG_ADI[bag.tur] ?? bag.tur, geri: "geri" },
        { tip: "izgara", sutun: 2, cocuklar: [a, b].map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
        { tip: "metin", metin: bag.aciklama },
        ...(bag.kaynak ? [{ tip: "metin", metin: `Kaynak: ${bag.kaynak}`, soluk: true }] : []),
        ...(konumlu.length === 2 ? [{ tip: "harita", id: "bag-pin", eserler: konumlu, baglantilar: [{ a: a.id, b: b.id, tur: bag.tur, etiket: BAG_ADI[bag.tur] }] }] : []),
      ],
    };
  }

  function listemEkrani() {
    const liste = [...listem].map((k) => kimlikle.get(k)).filter(Boolean);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Listem", alt: liste.length ? `${liste.length} eser` : "Görmek istediğin eserler" },
        ...(liste.length
          ? [
            ...(liste.some((e) => e.konum) ? [{ tip: "harita", id: "liste-pin", eserler: liste.filter((e) => e.konum), rota: liste.filter((e) => e.konum).length > 1 }] : []),
            { tip: "liste", ogeler: liste.map((e) => ({ id: `lst-${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], [e.ilce, e.il].filter(Boolean).join(", ")].filter(Boolean).join(" · "), ikon: "kalp" })) },
          ]
          : [{ tip: "metin", metin: "Bir eser sayfasında ♥ simgesine dokun; eser buraya eklenir ve haritada rotası çizilir.", ortali: true }]),
      ],
    };
  }
}

// ---------- Yardımcılar ----------
function paragraflar(e) {
  const p = String(e.tarihce?.tr ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (p.length > 1 && p[0].length < 220 && ADRES_DESENI.test(p[0]) && e.adres) p.shift();
  return p;
}

function sayim(liste, anahtar) {
  const m = new Map();
  for (const e of liste) m.set(anahtar(e), (m.get(anahtar(e)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
