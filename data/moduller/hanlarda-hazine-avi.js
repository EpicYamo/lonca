import { sahne, eserler, basarim, profil, depo } from "@lonca/sdk";

// Hanlarda Hazine Avı: çocuklar için kervan yolculuğu. Kervan her menzilde bir hana konaklar;
// hanın gerçek fotoğrafına bakıp adını bulan altın kazanır. İpuçları (şehir, yüzyıl, bir şıkkı ele) altına mal olur.
// Doğru bilinen her han "Han defteri"ne girer; defterden hanın fotoğraflarını ve kayıttaki hikâyesini okursun.
// İpuçları ve hikâyeler yalnızca eser kaydından gelir.

const ZORLUKLAR = [
  { id: "cirak", ad: "Çırak", alt: "Bursa hanları · 2 şık · 30 saniye", sik: 2, sure: 30, yalnizBursa: true, renk: "zumrut", carpan: 1 },
  { id: "kalfa", ad: "Kalfa", alt: "Bursa, Konya ve Hatay · 3 şık · 25 saniye", sik: 3, sure: 25, yalnizBursa: false, renk: "altin", carpan: 2 },
  { id: "usta", ad: "Usta", alt: "Bütün hanlar · 4 şık · 15 saniye", sik: 4, sure: 15, yalnizBursa: false, renk: "mercan", carpan: 3 },
];
const MENZIL = 6;
const ODUL = 10;
const IPUCU_BEDEL = 3;

const RUTBELER = [
  { altin: 0, ad: "Yolcu" },
  { altin: 40, ad: "Çırak tüccar" },
  { altin: 120, ad: "Tüccar" },
  { altin: 250, ad: "Kervanbaşı" },
  { altin: 500, ad: "Hanlar ağası" },
];

const BASARIMLAR = [
  { id: "ilk-altin", ad: "İlk Altın", aciklama: "İlk hanı doğru bul." },
  { id: "tam-kervan", ad: "Tam Kervan", aciklama: "Bir yolculuğun bütün menzillerini bil." },
  { id: "keskin-goz", ad: "Keskin Göz", aciklama: "Bir yolculuğu hiç ipucu almadan bitir." },
  { id: "usta-yolcu", ad: "Usta Yolcu", aciklama: "Usta zorluğunda en az 5 han bil." },
  { id: "defter-10", ad: "Han Defteri", aciklama: "Defterine 10 han ekle." },
  { id: "kervanbasi", ad: "Kervanbaşı", aciklama: "Sandığında 250 altın biriktir." },
];

const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;

export default async function basla() {
  const hanlar = (await eserler.liste({ tur: "han" })).filter((e) => e.fotograflar.length);
  const kimlikle = new Map(hanlar.map((e) => [e.id, e]));
  await basarim.tanimla(BASARIMLAR);

  let sandik = (await depo.oku("sandik")) ?? 0;
  const defter = new Set(((await depo.oku("defter")) ?? []).filter((k) => kimlikle.has(k)));

  /** @type {any} */
  const d = { ekran: "kapak", yigin: [], av: null, rozetler: [] };

  await sahne.ayarla({ baslik: "Hanlarda Hazine Avı", tema: { zemin: "parsomen", renk: "altin", yazi: "sans" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    try {
      await isle(olay);
    } catch {
      await sahne.bildir("Bir şeyler ters gitti, tekrar dene.");
    }
    await ciz();
  }

  async function isle(olay) {
    const av = d.av;
    if (olay.tur === "sure") {
      if (av && !av.cevap && olay.id === surekimligi(av)) await cevapla(null);
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "yolculuk") { d.ekran = "zorluk"; return; }
    if (id.startsWith("zorluk-")) return avKur(ZORLUKLAR.find((z) => z.id === id.slice(7)));
    if (id === "sandik") { d.rozetler = await basarim.liste(); d.ekran = "sandik"; return; }
    if (id === "defter") { d.ekran = "defter"; d.yigin = []; return; }
    if (id === "kapak") { d.ekran = "kapak"; d.av = null; return; }
    if (id === "geri") {
      if (d.yigin.length) { d.yigin.pop(); return; }
      d.ekran = d.av && !d.av.bitti && d.ekran === "oyun" ? "oyun" : "kapak";
      return;
    }
    if (id.startsWith("han-")) { const h = kimlikle.get(id.slice(4)); if (h && defter.has(h.id)) d.yigin.push(h); return; }
    if (id === "eser" && olay.eser && defter.has(olay.eser.id)) { d.yigin.push(kimlikle.get(olay.eser.id)); return; }
    if (id === "han-hikaye" && av) { const h = av.turlar[av.sira].han; d.ekran = "defter"; d.yigin = [h]; return; }

    if (!av || av.bitti) return;
    const tur = av.turlar[av.sira];
    if (id.startsWith("sik-") && !av.cevap) return cevapla(id.slice(4));
    if (id.startsWith("ipucu-") && !av.cevap) return ipucuAl(tur, id.slice(6));
    if (id === "sonraki" && av.cevap) {
      if (av.sira < av.turlar.length - 1) { av.sira++; av.cevap = null; return; }
      return bitir();
    }
  }

  function surekimligi(av) {
    return `menzil-${av.no}-${av.sira}`;
  }

  function avKur(z) {
    if (!z) return;
    const havuz = z.yalnizBursa ? hanlar.filter((h) => h.il === "Bursa") : hanlar;
    const secilen = eserler.karistir(havuz).slice(0, Math.min(MENZIL, havuz.length));
    const turlar = secilen.map((han) => {
      const yanlis = eserler.karistir(havuz.filter((h) => h.id !== han.id && !benzerAd(h, han))).slice(0, z.sik - 1);
      return { han, siklar: eserler.karistir([han, ...yanlis]), elenen: [], ipuclari: [] };
    });
    d.av = { z, turlar, sira: 0, altin: 0, dogru: 0, ipucuSayisi: 0, cevap: null, bitti: false, no: Date.now() % 100000 };
    d.ekran = "oyun";
  }

  async function ipucuAl(tur, tip) {
    const av = d.av;
    if (tur.ipuclari.includes(tip)) return;
    if (tip === "ele") {
      const aday = tur.siklar.filter((h) => h.id !== tur.han.id && !tur.elenen.includes(h.id));
      if (aday.length < 2 && tur.siklar.length > 2) return;
      if (!aday.length) return;
      tur.elenen.push(aday[0].id);
    }
    tur.ipuclari.push(tip);
    av.ipucuSayisi++;
    await sahne.bildir(`İpucu: −${IPUCU_BEDEL} altın`);
  }

  async function cevapla(kimlik) {
    const av = d.av;
    const tur = av.turlar[av.sira];
    const dogru = kimlik === tur.han.id;
    let kazanc = 0;
    if (dogru) {
      kazanc = Math.max(2, ODUL * av.z.carpan - tur.ipuclari.length * IPUCU_BEDEL);
      av.altin += kazanc;
      av.dogru++;
      const yeni = !defter.has(tur.han.id);
      defter.add(tur.han.id);
      await depo.yaz("defter", [...defter]);
      await sahne.efekt("yildiz");
      await basarim.kazan("ilk-altin");
      if (defter.size >= 10) await basarim.kazan("defter-10");
      if (yeni) await sahne.bildir("Han defterine eklendi!");
    } else {
      await sahne.efekt("titre");
    }
    av.cevap = { kimlik, dogru, kazanc, sureBitti: kimlik === null };
  }

  async function bitir() {
    const av = d.av;
    av.bitti = true;
    sandik += av.altin;
    await depo.yaz("sandik", sandik);
    await profil.puanEkle(av.altin, "Hazine avı");
    if (av.dogru === av.turlar.length) { await basarim.kazan("tam-kervan"); await sahne.efekt("konfeti"); }
    if (av.ipucuSayisi === 0 && av.dogru === av.turlar.length) await basarim.kazan("keskin-goz");
    if (av.z.id === "usta" && av.dogru >= 5) await basarim.kazan("usta-yolcu");
    if (sandik >= 250) await basarim.kazan("kervanbasi");
    d.rozetler = await basarim.liste();
    d.ekran = "sonuc";
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (d.ekran === "zorluk") return sahne.ciz(zorlukEkrani());
    if (d.ekran === "oyun") return sahne.ciz(oyunEkrani());
    if (d.ekran === "sonuc") return sahne.ciz(sonucEkrani());
    if (d.ekran === "sandik") return sahne.ciz(sandikEkrani());
    if (d.ekran === "defter") return sahne.ciz(d.yigin.length ? hanEkrani(d.yigin[d.yigin.length - 1]) : defterEkrani());
    return sahne.ciz(kapakEkrani());
  }

  function kapakEkrani() {
    return {
      tip: "kapak", ust: "Çocuklar için · Kervan yolculuğu", baslik: "Hanlarda Hazine Avı", renk: "altin",
      eser: kimlikle.get("bursa-koza-hani") ?? hanlar[0],
      alt: `Kervanın ${MENZIL} menzilde ${MENZIL} hana konaklayacak. Fotoğraftaki hanı bil, altınları sandığına doldur, han defterini tamamla. Sandığında ${sandik} altın var.`,
      cocuklar: [
        { tip: "dugme", id: "yolculuk", metin: "Kervana katıl", ikon: "oyun" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "sandik", metin: "Sandığım", ikon: "kupa", tur: "ikincil" },
          { tip: "dugme", id: "defter", metin: `Defter ${defter.size}/${hanlar.length}`, ikon: "kitap", tur: "ikincil" },
        ] },
      ],
    };
  }

  function zorlukEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Kervanını seç", alt: "Zorluk arttıkça altın da artar", geri: "kapak" },
        ...ZORLUKLAR.map((z) => ({ tip: "kart", id: `zorluk-${z.id}`, renk: z.renk, cocuklar: [
          { tip: "baslik", metin: z.ad, boyut: 2 },
          { tip: "metin", metin: z.alt },
          { tip: "cipler", ogeler: [`Doğru cevap ${ODUL * z.carpan} altın`, `İpucu −${IPUCU_BEDEL}`, `${MENZIL} menzil`] },
        ] })),
        { tip: "metin", metin: "İpuçları: hanın şehri, yapıldığı yüzyıl ya da yanlış bir şıkkı ele. Her ipucu kazanacağın altından düşer.", soluk: true },
      ],
    };
  }

  function oyunEkrani() {
    const av = d.av;
    const tur = av.turlar[av.sira];
    const han = tur.han;
    const c = av.cevap;
    const ipucuKart = [];
    if (tur.ipuclari.includes("yer")) ipucuKart.push(`Bu han ${han.ilce ? `${han.il}, ${han.ilce}` : han.il} ilinde.`);
    if (tur.ipuclari.includes("yuzyil")) ipucuKart.push(han.yuzyil ? `${han.yuzyil}. yüzyılda yapılmış.` : "Kaydında yapım yüzyılı yok; bu ipucu sana bir şey söylemedi.");
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Menzil ${av.sira + 1}/${av.turlar.length}`, alt: `${av.z.ad} kervanı · kesende ${av.altin} altın`, geri: "kapak" },
        { tip: "ilerleme", deger: av.sira + (c ? 1 : 0), toplam: av.turlar.length },
        ...(c ? [] : [{ tip: "sure", id: surekimligi(av), saniye: av.z.sure }]),
        { tip: "gorsel", eser: han },
        { tip: "baslik", metin: c ? han.ad : "Kervanımız hangi hana konakladı?", boyut: 2 },
        ...ipucuKart.map((m) => ({ tip: "metin", metin: `💡 ${m}` })),
        { tip: "izgara", sutun: tur.siklar.length > 2 ? 2 : 1, cocuklar: tur.siklar.map((h) => {
          const elendi = tur.elenen.includes(h.id);
          let metin = h.ad;
          if (c && h.id === han.id) metin = `✓ ${h.ad}`;
          else if (c && c.kimlik === h.id) metin = `✗ ${h.ad}`;
          return { tip: "dugme", id: `sik-${h.id}`, metin, tur: c ? (h.id === han.id ? "ana" : "hayalet") : "ikincil", devre_disi: elendi || (!!c && h.id !== han.id && c.kimlik !== h.id) };
        }) },
        ...(c ? sonucParcasi(av, tur, c) : [
          { tip: "baslik", metin: `İpuçları (her biri −${IPUCU_BEDEL} altın)`, boyut: 3 },
          { tip: "satir", hizala: "yay", cocuklar: [
            { tip: "dugme", id: "ipucu-yer", metin: "Şehri", ikon: "konum", tur: "hayalet", devre_disi: tur.ipuclari.includes("yer") },
            { tip: "dugme", id: "ipucu-yuzyil", metin: "Yüzyılı", ikon: "zaman", tur: "hayalet", devre_disi: tur.ipuclari.includes("yuzyil") },
            { tip: "dugme", id: "ipucu-ele", metin: "Ele", ikon: "soru", tur: "hayalet", devre_disi: tur.ipuclari.includes("ele") || tur.siklar.length <= 2 },
          ] },
        ]),
      ],
    };
  }

  function sonucParcasi(av, tur, c) {
    const han = tur.han;
    return [
      { tip: "kart", renk: c.dogru ? "zumrut" : "mercan", cocuklar: [
        { tip: "baslik", metin: c.dogru ? `Doğru! +${c.kazanc} altın` : c.sureBitti ? "Süre doldu!" : "Bu sefer olmadı", boyut: 3 },
        { tip: "metin", metin: `${han.ad} · ${[han.ilce, han.il].filter(Boolean).join(", ")}${han.yuzyil ? ` · ${han.yuzyil}. yüzyıl` : ""}` },
        ...(ilkCumle(han) ? [{ tip: "metin", metin: ilkCumle(han), soluk: true }] : []),
      ] },
      { tip: "satir", hizala: "yay", cocuklar: [
        ...(c.dogru ? [{ tip: "dugme", id: "han-hikaye", metin: "Hanın hikâyesi", ikon: "kitap", tur: "hayalet" }] : []),
        { tip: "dugme", id: "sonraki", metin: av.sira < av.turlar.length - 1 ? "Sonraki menzil" : "Sandığı aç", ikon: "ok" },
      ] },
    ];
  }

  function sonucEkrani() {
    const av = d.av;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Kervan vardı!", alt: `${av.z.ad} yolculuğu`, geri: "kapak" },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: av.altin, etiket: "altın", ikon: "kupa" },
          { tip: "istatistik", deger: `${av.dogru}/${av.turlar.length}`, etiket: "doğru", ikon: "yildiz" },
          { tip: "istatistik", deger: av.ipucuSayisi, etiket: "ipucu", ikon: "soru" },
        ] },
        { tip: "metin", metin: `Sandığında artık ${sandik} altın var: ${rutbe(sandik).ad}.`, ortali: true },
        { tip: "baslik", metin: "Bu yolculuğun hanları", boyut: 3 },
        { tip: "liste", ogeler: av.turlar.map((t) => ({ id: defter.has(t.han.id) ? `han-${t.han.id}` : `x-${t.han.id}`, metin: t.han.ad, alt: [t.han.ilce, t.han.il].filter(Boolean).join(", "), ikon: defter.has(t.han.id) ? "yildiz" : "soru" })) },
        { tip: "dugme", id: `zorluk-${av.z.id}`, metin: "Yeni yolculuk", ikon: "tekrar" },
        { tip: "dugme", id: "defter", metin: "Han defterim", ikon: "kitap", tur: "ikincil" },
      ],
    };
  }

  function sandikEkrani() {
    const r = rutbe(sandik);
    const sonraki = RUTBELER.find((x) => x.altin > sandik);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Hazine sandığım", alt: r.ad, geri: "kapak" },
        { tip: "istatistik", deger: sandik, etiket: "altın", ikon: "kupa" },
        sonraki
          ? { tip: "ilerleme", deger: sandik - r.altin, toplam: sonraki.altin - r.altin, etiket: `${sonraki.ad} rütbesine` }
          : { tip: "metin", metin: "En yüksek rütbedesin!", ortali: true },
        { tip: "liste", ogeler: RUTBELER.map((x) => ({ id: `r-${x.altin}`, metin: x.ad, alt: `${x.altin} altın`, ikon: sandik >= x.altin ? "yildiz" : "kupa" })) },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
      ],
    };
  }

  function defterEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Han defteri", alt: `${defter.size}/${hanlar.length} han bulundu`, geri: "kapak" },
        { tip: "ilerleme", deger: defter.size, toplam: hanlar.length },
        { tip: "metin", metin: "Yolculukta doğru bildiğin hanlar buraya eklenir. Bir hana dokun, hikâyesini oku.", soluk: true },
        { tip: "izgara", sutun: 2, cocuklar: hanlar.map((h) => defter.has(h.id)
          ? { tip: "eser", eser: h, id: "eser", boyut: "kucuk" }
          : { tip: "kart", cocuklar: [
            { tip: "baslik", metin: "?", boyut: 1 },
            { tip: "metin", metin: `Gizli han · ${h.il}`, soluk: true },
          ] }) },
      ],
    };
  }

  function hanEkrani(h) {
    const p = paragraflar(h).slice(0, 3);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: h.ad, alt: [h.ilce, h.il].filter(Boolean).join(", "), geri: "geri" },
        { tip: "fotograflar", eser: h },
        { tip: "cipler", ogeler: [h.yuzyil ? `${h.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor", h.il, "Defterimde ✓"] },
        ...p.map((m) => ({ tip: "metin", metin: m })),
        { tip: "metin", metin: h.kaynak, soluk: true },
      ],
    };
  }
}

// ---------- Yardımcılar ----------
function rutbe(altin) {
  return [...RUTBELER].reverse().find((r) => altin >= r.altin) ?? RUTBELER[0];
}

// "Koza Hanı" ile "İç Koza Hanı" gibi birbirine çok benzeyen adlar aynı soruda şık olmasın.
function benzerAd(a, b) {
  const kok = (e) => e.ad.toLocaleLowerCase("tr").replace(/\(.*?\)/g, "").replace(/\b(han[ıi]?|kervansaray[ıi]?|iç|ii|i)\b/g, "").trim();
  const x = kok(a), y = kok(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

function paragraflar(e) {
  const p = String(e.tarihce?.tr ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (p.length > 1 && p[0].length < 220 && ADRES_DESENI.test(p[0])) p.shift();
  return p;
}

function ilkCumle(e) {
  const c = (paragraflar(e)[0] ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";
  return c.length > 200 ? `${c.slice(0, 199)}…` : c;
}
