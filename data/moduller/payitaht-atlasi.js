import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

// Payitaht Atlası: Selçuklu başkenti Konya'dan Osmanlı'nın ilk başkenti Bursa'ya, vakıf eserlerini yüzyıl yüzyıl gezdiren atlas.
// Her yüzyıl bir bölümdür: o yüzyılda yapılmış eserler haritada, şehirlere ve türlere göre sayılarıyla görünür.
// "Başkent tanıklıkları" eser kayıtlarındaki tarihçelerden aynen alınır, kaynağıyla gösterilir. Yüzyıl yalnızca yapım tarihinden gelir.

const SEKMELER = [
  { id: "yuzyillar", ad: "Yüzyıllar", ikon: "zaman" },
  { id: "sehirler", ad: "Şehirler", ikon: "harita" },
  { id: "sina", ad: "Sına", ikon: "soru" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
const TUR_COGUL = { cami: "cami", mescit: "mescit", medrese: "medrese", han: "han", hamam: "hamam", cesme: "çeşme", turbe: "türbe",
  kulliye: "külliye", imaret: "imaret", kopru: "köprü", tekke: "tekke", hazire: "hazire", carsi: "çarşı", kutuphane: "kütüphane", sivil: "sivil yapı", diger: "diğer yapı" };
const ROMA = { 11: "XI", 12: "XII", 13: "XIII", 14: "XIV", 15: "XV", 16: "XVI", 17: "XVII", 18: "XVIII", 19: "XIX", 20: "XX", 21: "XXI" };
const SEHIR_RENK = { Bursa: "altin", Konya: "firuze", Hatay: "mercan" };

const BASARIMLAR = [
  { id: "ilk-bolum", ad: "Yolculuk Başladı", aciklama: "Bir yüzyıl bölümünü aç." },
  { id: "bes-bolum", ad: "Zaman Gezgini", aciklama: "Beş farklı yüzyılı gez." },
  { id: "uc-sehir", ad: "Üç Başkent", aciklama: "Bursa, Konya ve Hatay sayfalarını aç." },
  { id: "tanik", ad: "Tanık", aciklama: "Bir başkent tanıklığının eserine git." },
  { id: "sina-6", ad: "Yüzyıl Bilgini", aciklama: "Sınavda 8 sorudan en az 6'sını bil." },
  { id: "sina-8", ad: "Müverrih", aciklama: "Sınavda 8 sorunun hepsini bil." },
];
const SORU_SAYISI = 8;
const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;

export default async function basla() {
  // ---------- Veri ----------
  const hepsi = await eserler.liste({});
  const kimlikle = new Map(hepsi.map((e) => [e.id, e]));
  const tarihli = hepsi.filter((e) => e.yuzyil);
  const yuzyillar = [...new Set(tarihli.map((e) => e.yuzyil))].sort((a, b) => a - b);
  const sehirler = [...new Set(hepsi.map((e) => e.il))].sort((a, b) => hepsi.filter((e) => e.il === b).length - hepsi.filter((e) => e.il === a).length);
  const tanikliklar = taniklikBul(hepsi);
  await basarim.tanimla(BASARIMLAR);

  const gezilen = new Set((await depo.oku("gezilen")) ?? []);
  const sehirAcilan = new Set((await depo.oku("sehir")) ?? []);
  let rekor = (await depo.oku("rekor")) ?? 0;

  // ---------- Durum ----------
  /** @type {any} */
  const d = { acildi: false, yigin: [{ ad: "yuzyillar" }], il: "hepsi", tamOku: false, sina: null, rozetler: [] };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => { d.tamOku = false; d.yigin.push({ ad, ...ek }); };

  await sahne.ayarla({ baslik: "Payitaht Atlası", tema: { zemin: "parsomen", renk: "altin", yazi: "serif" } });
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
      if (olay.id === "il") d.il = olay.deger;
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "kapak-yolculuk") { await sekmeyeGec("yuzyillar"); return bolumAc(yuzyillar[0]); }
    if (id === "kapak-yuzyillar") return sekmeyeGec("yuzyillar");
    if (id === "kapak-sehirler") return sekmeyeGec("sehirler");
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); d.tamOku = false; return; }

    if (id.startsWith("yy-")) return bolumAc(Number(id.slice(3)));
    if (id === "bolum-onceki" || id === "bolum-sonraki") {
      const i = yuzyillar.indexOf(ust().yuzyil) + (id === "bolum-sonraki" ? 1 : -1);
      if (yuzyillar[i]) { d.yigin.pop(); return bolumAc(yuzyillar[i]); }
      return;
    }
    if (id.startsWith("sehir-")) return sehirAc(id.slice(6));
    if (id.startsWith("syy-")) {
      const [il, yy] = id.slice(4).split("|");
      d.il = il;
      return bolumAc(Number(yy), true);
    }
    if (id.startsWith("tanik-")) { const e = kimlikle.get(id.slice(6)); if (e) { await basarim.kazan("tanik"); git("eser", { eser: e }); } return; }
    if (id === "zaman") { await ekran.zaman(tarihli.filter((e) => d.il === "hepsi" || e.il === d.il).filter((e) => e.fotograflar.length).slice(0, 60), { baslik: "Zaman çizelgesi" }); return; }
    if (id === "devam") { d.tamOku = !d.tamOku; return; }

    // Sınav
    if (id === "sina-basla") return sinaKur();
    if (id.startsWith("cevap-")) return sinaCevap(Number(id.slice(6)));
    if (id === "sina-sonraki") return sinaSonraki();

    // Eser
    if (id.startsWith("eser:") || (olay.eser && (id === "eser" || id.endsWith("-pin")))) {
      const e = olay.eser ? kimlikle.get(olay.eser.id) ?? olay.eser : kimlikle.get(id.slice(5));
      if (!e) return;
      if (d.sina && !d.sina.bitti && ust().ad === "sina") return;
      return git("eser", { eser: e });
    }
    const e = ust().eser;
    if (!e) return;
    if (id === "hata") { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler, editörlere iletildi."); }
  }

  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.yigin = [{ ad: sekme === "sina" ? "sina-giris" : sekme }];
    d.tamOku = false;
    if (sekme === "sina") d.rozetler = await basarim.liste();
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  async function bolumAc(yy, ilKorunsun = false) {
    if (!ilKorunsun && ust().ad !== "bolum") d.il = "hepsi";
    git("bolum", { yuzyil: yy });
    if (!gezilen.has(yy)) {
      gezilen.add(yy);
      await depo.yaz("gezilen", [...gezilen]);
      await profil.puanEkle(5, "Yeni yüzyıl");
    }
    await basarim.kazan("ilk-bolum");
    if (gezilen.size >= 5) await basarim.kazan("bes-bolum");
  }

  async function sehirAc(il) {
    git("sehir", { il });
    sehirAcilan.add(il);
    await depo.yaz("sehir", [...sehirAcilan]);
    if (sehirler.every((s) => sehirAcilan.has(s))) await basarim.kazan("uc-sehir");
  }

  // ---------- Sınav ----------
  function sinaKur() {
    const adaylar = eserler.karistir(tarihli.filter((e) => e.fotograflar.length));
    const secilen = [];
    const yy = new Map();
    // Yüzyıllar dengeli dağılsın: aynı yüzyıldan en çok iki soru
    for (const e of adaylar) {
      if ((yy.get(e.yuzyil) ?? 0) >= 2) continue;
      yy.set(e.yuzyil, (yy.get(e.yuzyil) ?? 0) + 1);
      secilen.push(e);
      if (secilen.length === SORU_SAYISI) break;
    }
    d.sina = { sorular: secilen.map((e) => ({ eser: e, secenekler: eserler.yuzyilSecenekleri(e, 4) })), sira: 0, dogru: 0, cevap: null, bitti: false };
    git("sina");
  }

  async function sinaCevap(i) {
    const s = d.sina;
    if (!s || s.cevap) return;
    const soru = s.sorular[s.sira];
    s.cevap = { secim: i, dogru: !!soru.secenekler[i]?.dogru };
    if (s.cevap.dogru) { s.dogru++; await sahne.efekt("yildiz"); } else await sahne.efekt("titre");
  }

  async function sinaSonraki() {
    const s = d.sina;
    if (!s) return;
    if (s.sira < s.sorular.length - 1) { s.sira++; s.cevap = null; return; }
    s.bitti = true;
    await profil.puanEkle(s.dogru * 5, "Payitaht sınavı");
    if (s.dogru >= 6) await basarim.kazan("sina-6");
    if (s.dogru === SORU_SAYISI) { await basarim.kazan("sina-8"); await sahne.efekt("konfeti"); }
    if (s.dogru > rekor) { rekor = s.dogru; await depo.yaz("rekor", rekor); }
    d.rozetler = await basarim.liste();
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const u = ust();
    if (u.ad === "bolum") return sahne.ciz(bolumEkrani(u.yuzyil));
    if (u.ad === "sehir") return sahne.ciz(sehirEkrani(u.il));
    if (u.ad === "eser") return sahne.ciz(eserEkrani(u.eser));
    if (u.ad === "sina" && d.sina) return sahne.ciz(sinaEkrani());
    if (u.ad === "sehirler") return sahne.ciz(sehirlerEkrani());
    if (u.ad === "sina-giris") return sahne.ciz(sinaGirisEkrani());
    return sahne.ciz(yuzyillarEkrani());
  }

  function kapakEkrani() {
    return {
      tip: "kapak", ust: sehirler.join(" · "), baslik: "Payitaht Atlası", renk: "altin",
      eser: kimlikle.get("bursa-orhan-bey-kulliyesi") ?? tarihli.find((e) => e.fotograflar.length),
      alt: `${ROMA[yuzyillar[0]]}. yüzyıldan ${ROMA[yuzyillar[yuzyillar.length - 1]]}. yüzyıla, ${tarihli.length} tarihli vakıf eseri. Başkentlerin yüzyıllar içinde nasıl büyüdüğünü haritada izle.`,
      cocuklar: [
        { tip: "dugme", id: "kapak-yolculuk", metin: "Zamanda yolculuğa çık", ikon: "zaman" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "kapak-yuzyillar", metin: "Yüzyıllar", ikon: "liste", tur: "ikincil" },
          { tip: "dugme", id: "kapak-sehirler", metin: "Şehirler", ikon: "harita", tur: "ikincil" },
        ] },
      ],
    };
  }

  function yuzyillarEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Yüzyıllar", alt: `${yuzyillar.length} bölüm · ${gezilen.size} gezildi` },
        { tip: "metin", metin: `Yapım tarihi bilinen ${tarihli.length} eser yüzyıllarına göre bölümlere ayrıldı. Bir bölüm aç; o yüzyılın eserlerini haritada, şehir şehir gör.`, soluk: true },
        ...yuzyillar.map((y) => {
          const liste = tarihli.filter((e) => e.yuzyil === y);
          const kapak = enIyi(liste);
          return { tip: "kart", id: `yy-${y}`, renk: gezilen.has(y) ? "altin" : undefined, cocuklar: [
            { tip: "afis", baslik: `${ROMA[y]}. yüzyıl`, alt: ozet(liste), eser: kapak, renk: "altin" },
            { tip: "cipler", ogeler: [...sayim(liste, (e) => e.tur).slice(0, 3).map(([t, n]) => `${n} ${TUR_COGUL[t] ?? t}`), ...(gezilen.has(y) ? ["Gezildi ✓"] : [])] },
          ] };
        }),
        { tip: "metin", metin: `${hepsi.length - tarihli.length} eserin kaydında açık bir yapım tarihi yok; bu eserler bölümlere alınmadı.`, soluk: true },
      ],
    };
  }

  function bolumEkrani(yy) {
    const tumu = tarihli.filter((e) => e.yuzyil === yy);
    const liste = d.il === "hepsi" ? tumu : tumu.filter((e) => e.il === d.il);
    const i = yuzyillar.indexOf(yy);
    const onceki = yuzyillar[i - 1], sonraki = yuzyillar[i + 1];
    const ilSecenek = [{ id: "hepsi", metin: `Hepsi (${tumu.length})` },
      ...sehirler.filter((s) => tumu.some((e) => e.il === s)).map((s) => ({ id: s, metin: `${s} (${tumu.filter((e) => e.il === s).length})` }))];
    const turSay = sayim(liste, (e) => e.tur);
    const fotolu = liste.filter((e) => e.fotograflar.length);
    const tanik = tanikliklar.filter((t) => t.eser.yuzyil === yy && (d.il === "hepsi" || t.eser.il === d.il));
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `${ROMA[yy]}. yüzyıl`, alt: `${yy}. yüzyıl · ${tumu.length} eser`, geri: "geri" },
        { tip: "afis", baslik: `${ROMA[yy]}. yüzyıl`, alt: ozet(tumu), eser: enIyi(liste.length ? liste : tumu), renk: "altin" },
        { tip: "secenekler", id: "il", secenekler: ilSecenek, secili: ilSecenek.some((s) => s.id === d.il) ? d.il : "hepsi" },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: liste.length, etiket: "eser", ikon: "kitap" },
          { tip: "istatistik", deger: new Set(liste.map((e) => e.ilce ?? e.il)).size, etiket: "ilçe", ikon: "konum" },
          { tip: "istatistik", deger: fotolu.length, etiket: "fotoğraflı", ikon: "kamera" },
        ] },
        { tip: "cipler", ogeler: turSay.slice(0, 6).map(([t, n]) => `${n} ${TUR_COGUL[t] ?? t}`) },
        ...(liste.some((e) => e.konum) ? [{ tip: "harita", id: "bolum-pin", eserler: liste.filter((e) => e.konum) }] : []),
        ...(tanik.length ? [
          { tip: "baslik", metin: "Başkent tanıklıkları", boyut: 2 },
          ...tanik.slice(0, 3).map((t) => ({ tip: "kart", id: `tanik-${t.eser.id}`, renk: SEHIR_RENK[t.eser.il], cocuklar: [
            { tip: "metin", metin: `“${t.cumle}”` },
            { tip: "metin", metin: `${t.eser.ad} kaydından · ${t.eser.kaynak}`, soluk: true },
          ] })),
        ] : []),
        { tip: "baslik", metin: "Bu yüzyılın eserleri", boyut: 2 },
        ...(fotolu.length ? [{ tip: "kaydirma", cocuklar: fotolu.slice(0, 16).map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) }] : []),
        { tip: "liste", ogeler: liste.slice(0, 80).map((e) => ({ id: `eser:${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], e.ilce ? `${e.ilce}, ${e.il}` : e.il].filter(Boolean).join(" · "), ikon: "konum" })) },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "bolum-onceki", metin: onceki ? `${ROMA[onceki]}. yy` : "Başlangıç", ikon: "geri", tur: "hayalet", devre_disi: !onceki },
          { tip: "dugme", id: "bolum-sonraki", metin: sonraki ? `${ROMA[sonraki]}. yy` : "Son bölüm", ikon: "ok", tur: "hayalet", devre_disi: !sonraki },
        ] },
      ],
    };
  }

  function sehirlerEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Şehirler", alt: `${sehirler.length} şehir · ${hepsi.length} eser` },
        ...sehirler.map((s) => {
          const liste = hepsi.filter((e) => e.il === s);
          const t = liste.filter((e) => e.yuzyil);
          const zirve = sayim(t, (e) => e.yuzyil)[0];
          return { tip: "kart", id: `sehir-${s}`, renk: SEHIR_RENK[s], cocuklar: [
            { tip: "afis", baslik: s, alt: `${liste.length} eser · ${t.length} tarihli${zirve ? ` · en çok ${ROMA[zirve[0]]}. yüzyıl` : ""}`, eser: enIyi(t.length ? t : liste), renk: SEHIR_RENK[s] },
          ] };
        }),
      ],
    };
  }

  function sehirEkrani(il) {
    const liste = hepsi.filter((e) => e.il === il);
    const t = liste.filter((e) => e.yuzyil);
    const yySay = new Map(sayim(t, (e) => e.yuzyil));
    const enCok = Math.max(1, ...yySay.values());
    const tanik = tanikliklar.filter((x) => x.eser.il === il);
    const ilceSay = sayim(liste, (e) => e.ilce ?? "Bilinmiyor");
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: il, alt: `${liste.length} vakıf eseri`, geri: "geri" },
        { tip: "afis", baslik: il, alt: `${liste.length} vakıf eseri · ${t.length} tanesinin yapım yüzyılı biliniyor`, eser: enIyi(t.length ? t : liste), renk: SEHIR_RENK[il] },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: liste.length, etiket: "eser", ikon: "kitap" },
          { tip: "istatistik", deger: ilceSay.length, etiket: "ilçe", ikon: "konum" },
          { tip: "istatistik", deger: t.length, etiket: "tarihli", ikon: "zaman" },
        ] },
        { tip: "baslik", metin: "Yüzyıllara göre", boyut: 2 },
        { tip: "metin", metin: "Bir yüzyıla dokun; o bölüm bu şehirle süzülmüş olarak açılır.", soluk: true },
        { tip: "liste", ogeler: yuzyillar.filter((y) => yySay.has(y)).map((y) => ({
          id: `syy-${il}|${y}`, metin: `${ROMA[y]}. yüzyıl`, ikon: "zaman",
          alt: "▮".repeat(Math.max(1, Math.round((yySay.get(y) / enCok) * 12))), sag: `${yySay.get(y)} eser`,
        })) },
        ...(liste.some((e) => e.konum) ? [{ tip: "harita", id: "sehir-pin", eserler: liste.filter((e) => e.konum) }] : []),
        ...(tanik.length ? [
          { tip: "baslik", metin: "Başkent tanıklıkları", boyut: 2 },
          ...tanik.slice(0, 4).map((x) => ({ tip: "kart", id: `tanik-${x.eser.id}`, renk: SEHIR_RENK[il], cocuklar: [
            { tip: "metin", metin: `“${x.cumle}”` },
            { tip: "metin", metin: `${x.eser.ad} kaydından · ${x.eser.kaynak}`, soluk: true },
          ] })),
        ] : []),
        { tip: "baslik", metin: "İlçeler", boyut: 2 },
        { tip: "cipler", ogeler: ilceSay.slice(0, 12).map(([ilce, n]) => `${ilce} ${n}`) },
        { tip: "dugme", id: "zaman", metin: "Zaman çizelgesinde gör", ikon: "zaman", tur: "ikincil" },
      ],
    };
  }

  function eserEkrani(e) {
    const p = paragraflar(e);
    const gorunen = d.tamOku ? p : p.slice(0, 2);
    const cagdas = tarihli.filter((x) => x.id !== e.id && x.yuzyil && x.yuzyil === e.yuzyil && x.il === e.il && x.fotograflar.length).slice(0, 10);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [e.ilce, e.il].filter(Boolean).join(", "), geri: "geri" },
        { tip: "fotograflar", eser: e },
        { tip: "cipler", ogeler: [TUR_ADI[e.tur] ?? e.tur, e.yuzyil ? `${ROMA[e.yuzyil]}. yüzyıl` : "Yapım tarihi bilinmiyor", e.il] },
        ...(gorunen.length ? gorunen.map((m) => ({ tip: "metin", metin: m })) : [{ tip: "metin", metin: "Bu eserin kaydında tarihçe yok.", soluk: true }]),
        ...(p.length > 2 ? [{ tip: "dugme", id: "devam", metin: d.tamOku ? "Daha az göster" : `Devamını oku (${p.length - 2} paragraf)`, ikon: "kitap", tur: "hayalet" }] : []),
        ...(e.konum ? [{ tip: "harita", id: "eser-konum", eserler: [e], secili: e.id }] : []),
        ...(cagdas.length ? [
          { tip: "baslik", metin: `Aynı yüzyılda ${e.il}`, boyut: 3 },
          { tip: "kaydirma", cocuklar: cagdas.map((x) => ({ tip: "eser", eser: x, id: "eser", boyut: "kucuk" })) },
        ] : []),
        { tip: "metin", metin: e.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function sinaGirisEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Sına", alt: rekor ? `En iyi skorun ${rekor}/${SORU_SAYISI}` : "Yüzyıl sınavı" },
        { tip: "afis", baslik: "Hangi yüzyıl?", alt: `${SORU_SAYISI} eser, her biri farklı bir dönemden. Fotoğrafa ve yerine bakıp yapıldığı yüzyılı bul.`, eser: enIyi(tarihli), renk: "altin" },
        { tip: "dugme", id: "sina-basla", metin: "Sınava başla", ikon: "oyun" },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
      ],
    };
  }

  function sinaEkrani() {
    const s = d.sina;
    if (s.bitti) {
      return {
        tip: "sutun", cocuklar: [
          { tip: "ust_cubuk", baslik: "Sonuç", geri: "geri" },
          { tip: "istatistik", deger: `${s.dogru}/${s.sorular.length}`, etiket: s.dogru >= 6 ? "Yüzyıl bilgini!" : "Atlas seni bekliyor", ikon: "kupa" },
          { tip: "baslik", metin: "Sorulan eserler", boyut: 3 },
          { tip: "liste", ogeler: s.sorular.map((q) => ({ id: `eser:${q.eser.id}`, metin: q.eser.ad, alt: `${ROMA[q.eser.yuzyil]}. yüzyıl · ${q.eser.il}`, ikon: "zaman" })) },
          { tip: "dugme", id: "sina-basla", metin: "Yeniden dene", ikon: "tekrar" },
        ],
      };
    }
    const q = s.sorular[s.sira];
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Soru ${s.sira + 1}/${s.sorular.length}`, alt: `${s.dogru} doğru`, geri: "geri" },
        { tip: "ilerleme", deger: s.sira + (s.cevap ? 1 : 0), toplam: s.sorular.length },
        { tip: "gorsel", eser: q.eser },
        { tip: "baslik", metin: q.eser.ad, boyut: 2 },
        { tip: "metin", metin: `${TUR_ADI[q.eser.tur] ?? q.eser.tur} · ${[q.eser.ilce, q.eser.il].filter(Boolean).join(", ")}`, soluk: true },
        { tip: "baslik", metin: "Hangi yüzyılda yapıldı?", boyut: 3 },
        { tip: "izgara", sutun: 2, cocuklar: q.secenekler.map((sec, i) => {
          let metin = sec.metin;
          if (s.cevap && sec.dogru) metin = `✓ ${metin}`;
          else if (s.cevap && s.cevap.secim === i) metin = `✗ ${metin}`;
          return { tip: "dugme", id: `cevap-${i}`, metin, tur: s.cevap && sec.dogru ? "ana" : "ikincil", devre_disi: !!s.cevap && !sec.dogru && s.cevap.secim !== i };
        }) },
        ...(s.cevap ? [
          { tip: "kart", renk: s.cevap.dogru ? "zumrut" : "mercan", cocuklar: [
            { tip: "baslik", metin: s.cevap.dogru ? "Doğru!" : `Doğrusu: ${ROMA[q.eser.yuzyil]}. yüzyıl`, boyut: 3 },
            { tip: "metin", metin: ilkCumle(q.eser) },
            { tip: "metin", metin: q.eser.kaynak, soluk: true },
          ] },
          { tip: "dugme", id: "sina-sonraki", metin: s.sira < s.sorular.length - 1 ? "Sonraki soru" : "Sonucu gör", ikon: "ok" },
        ] : []),
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

function ilkCumle(e) {
  const c = (paragraflar(e)[0] ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";
  return c.length > 220 ? `${c.slice(0, 219)}…` : c;
}

function sayim(liste, anahtar) {
  const m = new Map();
  for (const e of liste) m.set(anahtar(e), (m.get(anahtar(e)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function ozet(liste) {
  const sehir = sayim(liste, (e) => e.il).map(([s, n]) => `${s} ${n}`).join(" · ");
  return `${liste.length} eser${sehir ? ` — ${sehir}` : ""}`;
}

// Fotoğrafı, konumu ve uzun tarihçesi olan eseri öne çıkar (kapak görseli için).
function enIyi(liste) {
  return [...liste].sort((a, b) => puan(b) - puan(a))[0];
}
function puan(e) {
  return (e.fotograflar.length ? 10 : 0) + Math.min(4, e.fotograflar.length) + (e.konum ? 3 : 0) + Math.min(5, String(e.tarihce?.tr ?? "").length / 800);
}

// Tarihçelerde "başkent / payitaht" geçen cümleler, aynen.
function taniklikBul(liste) {
  const sonuc = [];
  for (const e of liste) {
    const metin = String(e.tarihce?.tr ?? "").replace(/\s+/g, " ");
    const cumle = metin.split(/(?<=[.!?])\s+/).find((c) => /başkent|payitaht/i.test(c));
    if (cumle && cumle.length <= 320) sonuc.push({ eser: e, cumle: cumle.trim() });
  }
  return sonuc;
}
