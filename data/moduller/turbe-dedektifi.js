import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

// Türbe Dedektifi: her türbe bir dosya. Fotoğrafla başlarsın; tanık ifadeleri (tarihçeden, tarih ve adlar karartılmış),
// mimari iz ve komşu yapılar gibi ipuçlarını açtıkça dosyanın değeri düşer. Sonunda hükmünü verirsin: türbe hangi yüzyılda yapıldı?
// Dosya kapanınca türbenin adı, hikâyesi ve kaynağı açılır. Bütün ipuçları eser kaydından gelir; yüzyıl yalnızca yapım tarihinden.

const SEKMELER = [
  { id: "dosyalar", ad: "Dosyalar", ikon: "liste" },
  { id: "arsiv", ad: "Arşiv", ikon: "kitap" },
  { id: "rutbe", ad: "Rütbe", ikon: "kupa" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
const IPUCLARI = [
  { id: "yer", ad: "Olay yeri", ikon: "konum" },
  { id: "tanik1", ad: "Birinci tanık", ikon: "kullanici" },
  { id: "tanik2", ad: "İkinci tanık", ikon: "kullanici" },
  { id: "mimari", ad: "Mimari iz", ikon: "kup" },
  { id: "komsu", ad: "Komşu yapılar", ikon: "harita" },
];
const BASLANGIC_PUAN = 100;
const IPUCU_BEDEL = 15;
const EN_AZ = 25;

const RUTBELER = [
  { puan: 0, ad: "Stajyer" },
  { puan: 150, ad: "Komiser yardımcısı" },
  { puan: 400, ad: "Komiser" },
  { puan: 800, ad: "Başkomiser" },
  { puan: 1400, ad: "Başmüfettiş" },
];

const BASARIMLAR = [
  { id: "ilk-dosya", ad: "İlk Dosya", aciklama: "Bir dosyayı doğru kapat." },
  { id: "tek-bakis", ad: "Tek Bakış", aciklama: "Hiç ipucu açmadan bir dosya çöz." },
  { id: "bes-dosya", ad: "Dosya Avcısı", aciklama: "5 dosya çöz." },
  { id: "uc-sehir", ad: "Üç Şehir", aciklama: "Bursa, Konya ve Hatay'dan birer dosya çöz." },
  { id: "hepsi", ad: "Arşiv Kapandı", aciklama: "Bütün dosyaları kapat." },
];

const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;
const DONEM_DESENI = /(dönem|devr|sultan|bey|paşa|hatun|şehzade|yüzyıl|vefat|inşa|yaptır)/i;
const MIMARI_DESENI = /(kubbe|tuğla|almaşık|sekizgen|kesme taş|moloz|çini|revak|kasnak|pencere|kemer|cephe|plan)/i;

export default async function basla() {
  // ---------- Veri ----------
  const hepsi = await eserler.liste({});
  const turbeler = hepsi.filter((e) => e.tur === "turbe" && e.yuzyil && e.fotograflar.length)
    .sort((a, b) => a.il.localeCompare(b.il, "tr") || a.id.localeCompare(b.id));
  const dosyaNo = new Map(turbeler.map((e, i) => [e.id, i + 1]));
  const kimlikle = new Map(turbeler.map((e) => [e.id, e]));
  await basarim.tanimla(BASARIMLAR);

  /** @type {Record<string, { dogru: boolean, puan: number, ipucu: number }>} */
  const arsiv = (await depo.oku("arsiv")) ?? {};
  const toplam = () => Object.values(arsiv).reduce((t, x) => t + x.puan, 0);

  // ---------- Durum ----------
  /** @type {any} */
  const d = { acildi: false, yigin: [{ ad: "dosyalar" }], il: "hepsi", dava: null, rozetler: [] };
  const ust = () => d.yigin[d.yigin.length - 1];

  await sahne.ayarla({ baslik: "Türbe Dedektifi", tema: { zemin: "gece", renk: "murdum", yazi: "serif" } });
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
    if (olay.tur === "sec") { if (olay.id === "il") d.il = olay.deger; return; }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "kapak-dosyalar") return sekmeyeGec("dosyalar");
    if (id === "kapak-gunun") { await sekmeyeGec("dosyalar"); return davaAc(gununDosyasi()); }
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); return; }
    if (id.startsWith("dosya-")) return davaAc(kimlikle.get(id.slice(6)));
    if (id.startsWith("kapali-")) { const e = kimlikle.get(id.slice(7)); if (e) d.yigin.push({ ad: "kapanis", eser: e }); return; }
    if (id === "rastgele") {
      const acik = turbeler.filter((e) => !arsiv[e.id]);
      return davaAc(eserler.karistir(acik.length ? acik : turbeler)[0]);
    }

    const dava = d.dava;
    if (dava && ust().ad === "dava") {
      if (id.startsWith("ipucu-")) return ipucuAc(id.slice(6));
      if (id.startsWith("hukum-")) return hukumVer(Number(id.slice(6)));
    }
    if (id === "kapanis" && dava) { d.yigin.push({ ad: "kapanis", eser: dava.eser }); return; }
    if (id === "sonraki-dosya") {
      const sira = turbeler.findIndex((e) => e.id === dava?.eser.id);
      const sonraki = turbeler.slice(sira + 1).concat(turbeler.slice(0, sira)).find((e) => !arsiv[e.id]);
      d.yigin = [d.yigin[0]];
      if (sonraki) return davaAc(sonraki);
      await sahne.bildir("Bütün dosyalar kapandı!");
      return;
    }
    const e = ust().eser;
    if (id === "hata" && e) { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler, editörlere iletildi."); }
  }

  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.yigin = [{ ad: sekme }];
    if (sekme === "rutbe") d.rozetler = await basarim.liste();
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  function gununDosyasi() {
    const gun = Math.floor(Date.now() / 86_400_000);
    return turbeler[gun % turbeler.length];
  }

  function davaAc(e) {
    if (!e) return;
    if (arsiv[e.id]) { d.yigin.push({ ad: "kapanis", eser: e }); return; }
    d.dava = { eser: e, acik: [], secenekler: eserler.yuzyilSecenekleri(e, 4), hukum: null, ipuclari: ipuclariHazirla(e) };
    d.yigin.push({ ad: "dava", eser: e });
  }

  function davaPuani(dava) {
    return Math.max(EN_AZ, BASLANGIC_PUAN - dava.acik.length * IPUCU_BEDEL);
  }

  async function ipucuAc(ipucu) {
    const dava = d.dava;
    if (!dava || dava.hukum || dava.acik.includes(ipucu) || !dava.ipuclari[ipucu]) return;
    dava.acik.push(ipucu);
    await sahne.bildir(`İpucu açıldı · dosya değeri ${davaPuani(dava)}`);
  }

  async function hukumVer(i) {
    const dava = d.dava;
    if (!dava || dava.hukum) return;
    const dogru = !!dava.secenekler[i]?.dogru;
    const puan = dogru ? davaPuani(dava) : 0;
    dava.hukum = { secim: i, dogru, puan };
    arsiv[dava.eser.id] = { dogru, puan, ipucu: dava.acik.length };
    await depo.yaz("arsiv", arsiv);
    if (dogru) {
      await profil.puanEkle(Math.round(puan / 5), "Türbe dosyası");
      await sahne.efekt(dava.acik.length === 0 ? "konfeti" : "yildiz");
      await basarim.kazan("ilk-dosya");
      if (dava.acik.length === 0) await basarim.kazan("tek-bakis");
      const cozulen = turbeler.filter((e) => arsiv[e.id]?.dogru);
      if (cozulen.length >= 5) await basarim.kazan("bes-dosya");
      if (["Bursa", "Konya", "Hatay"].every((il) => cozulen.some((e) => e.il === il))) await basarim.kazan("uc-sehir");
    } else {
      await sahne.efekt("titre");
    }
    if (turbeler.every((e) => arsiv[e.id])) await basarim.kazan("hepsi");
  }

  // ---------- İpuçları: yalnızca kayıttan ----------
  function ipuclariHazirla(e) {
    const cumleler = paragraflar(e).join(" ").split(/(?<=[.!?])\s+/).map((c) => c.trim()).filter((c) => c.length > 30);
    const karart = (c) => karartilmis(c, e);
    const donem = cumleler.filter((c) => DONEM_DESENI.test(c) && !MIMARI_DESENI.test(c));
    const mimari = cumleler.filter((c) => MIMARI_DESENI.test(c));
    const diger = cumleler.filter((c) => !donem.includes(c) && !mimari.includes(c));
    const taniklar = [...donem, ...diger];
    const komsular = e.konum
      ? hepsi.filter((x) => x.id !== e.id && x.konum && x.yuzyil && x.tur !== "turbe")
        .map((x) => ({ x, m: mesafe(e, x) })).filter((k) => k.m < 1500).sort((a, b) => a.m - b.m).slice(0, 3)
      : [];
    return {
      yer: `${e.il}${e.ilce ? `, ${e.ilce}` : ""}${e.adres ? ` · ${karart(e.adres)}` : ""}`,
      tanik1: taniklar[0] ? karart(taniklar[0]) : null,
      tanik2: taniklar[1] ? karart(taniklar[1]) : null,
      mimari: mimari[0] ? karart(mimari[0]) : null,
      komsu: komsular.length ? komsular.map(({ x, m }) => `${x.ad} (${TUR_ADI[x.tur] ?? x.tur}, ${x.yuzyil}. yüzyıl) · ${metre(m)}`).join("\n") : null,
    };
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const u = ust();
    if (u.ad === "dava") return sahne.ciz(davaEkrani());
    if (u.ad === "kapanis") return sahne.ciz(kapanisEkrani(u.eser));
    if (u.ad === "arsiv") return sahne.ciz(arsivEkrani());
    if (u.ad === "rutbe") return sahne.ciz(rutbeEkrani());
    return sahne.ciz(dosyalarEkrani());
  }

  function kapakEkrani() {
    const cozulen = turbeler.filter((e) => arsiv[e.id]).length;
    return {
      tip: "kapak", ust: "Gizemli türbeler · Yüzyıl dosyaları", baslik: "Türbe Dedektifi", renk: "murdum",
      eser: kimlikle.get("bursa-yesil-turbe") ?? turbeler[0],
      alt: `${turbeler.length} dosya masanda. Fotoğrafa bak, tanıkları dinle, komşu yapıları sorgula; sonra hükmünü ver: bu türbe hangi yüzyılda yapıldı? ${cozulen ? `${cozulen} dosya kapandı.` : ""}`,
      cocuklar: [
        { tip: "dugme", id: "kapak-gunun", metin: "Günün dosyası", ikon: "soru" },
        { tip: "dugme", id: "kapak-dosyalar", metin: "Bütün dosyalar", ikon: "liste", tur: "ikincil" },
      ],
    };
  }

  function dosyalarEkrani() {
    const iller = [...new Set(turbeler.map((e) => e.il))];
    const liste = d.il === "hepsi" ? turbeler : turbeler.filter((e) => e.il === d.il);
    const acik = liste.filter((e) => !arsiv[e.id]).length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Dosyalar", alt: `${acik} açık dosya · ${toplam()} puan` },
        { tip: "secenekler", id: "il", secili: d.il, secenekler: [{ id: "hepsi", metin: "Hepsi" }, ...iller.map((il) => ({ id: il, metin: `${il} ${turbeler.filter((e) => e.il === il).length}` }))] },
        { tip: "dugme", id: "rastgele", metin: "Rastgele bir dosya aç", ikon: "tekrar", tur: "ikincil" },
        { tip: "liste", ogeler: liste.map((e) => {
          const a = arsiv[e.id];
          return {
            id: `dosya-${e.id}`, metin: a ? `Dosya ${dosyaNo.get(e.id)} · ${e.ad}` : `Dosya ${dosyaNo.get(e.id)} · Gizemli türbe`,
            alt: [e.il, e.ilce].filter(Boolean).join(", "), ikon: a ? (a.dogru ? "yildiz" : "bilgi") : "soru",
            sag: a ? (a.dogru ? `${a.puan} p` : "çözülemedi") : "açık",
          };
        }) },
      ],
    };
  }

  function davaEkrani() {
    const dava = d.dava;
    const e = dava.eser;
    const h = dava.hukum;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Dosya ${dosyaNo.get(e.id)}`, alt: h ? "Hüküm verildi" : `Dosya değeri ${davaPuani(dava)} puan`, geri: "geri" },
        { tip: "gorsel", eser: e },
        { tip: "metin", metin: "Delil 1 · Fotoğraf. Yapının malzemesine, kubbesine, pencerelerine dikkat et.", soluk: true },
        ...IPUCLARI.filter((ip) => dava.ipuclari[ip.id]).map((ip) => dava.acik.includes(ip.id)
          ? { tip: "kart", renk: "murdum", cocuklar: [
            { tip: "baslik", metin: ip.ad, boyut: 3 },
            ...String(dava.ipuclari[ip.id]).split("\n").map((m) => ({ tip: "metin", metin: ip.id.startsWith("tanik") || ip.id === "mimari" ? `“${m}”` : m })),
          ] }
          : { tip: "dugme", id: `ipucu-${ip.id}`, metin: `${ip.ad} (−${IPUCU_BEDEL})`, ikon: ip.ikon, tur: "hayalet", devre_disi: !!h }),
        { tip: "ayrac" },
        { tip: "baslik", metin: h ? (h.dogru ? `Doğru hüküm! +${h.puan} puan` : `Yanlış hüküm. Türbe ${e.yuzyil}. yüzyılda yapıldı.`) : "Hükmün: hangi yüzyıl?", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: dava.secenekler.map((s, i) => {
          let metin = s.metin;
          if (h && s.dogru) metin = `✓ ${metin}`;
          else if (h && h.secim === i) metin = `✗ ${metin}`;
          return { tip: "dugme", id: `hukum-${i}`, metin, tur: h ? (s.dogru ? "ana" : "hayalet") : "ikincil", devre_disi: !!h && !s.dogru && h.secim !== i };
        }) },
        ...(h ? [
          { tip: "dugme", id: "kapanis", metin: "Dosyayı aç: türbenin hikâyesi", ikon: "kitap" },
          { tip: "dugme", id: "sonraki-dosya", metin: "Sonraki dosya", ikon: "ok", tur: "ikincil" },
        ] : []),
      ],
    };
  }

  function kapanisEkrani(e) {
    const a = arsiv[e.id];
    const p = paragraflar(e).slice(0, 4);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: `Dosya ${dosyaNo.get(e.id)} · kapandı`, geri: "geri" },
        { tip: "fotograflar", eser: e },
        { tip: "cipler", ogeler: [`${e.yuzyil}. yüzyıl`, [e.ilce, e.il].filter(Boolean).join(", "), ...(a ? [a.dogru ? `${a.puan} puan` : "Çözülemedi", `${a.ipucu} ipucu`] : [])] },
        ...p.map((m) => ({ tip: "metin", metin: m })),
        ...(e.konum ? [{ tip: "harita", id: "kapanis-konum", eserler: [e], secili: e.id }] : []),
        { tip: "metin", metin: e.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function arsivEkrani() {
    const kapali = turbeler.filter((e) => arsiv[e.id]);
    const dogru = kapali.filter((e) => arsiv[e.id].dogru);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Arşiv", alt: `${kapali.length}/${turbeler.length} dosya kapandı` },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: dogru.length, etiket: "çözüldü", ikon: "yildiz" },
          { tip: "istatistik", deger: kapali.length - dogru.length, etiket: "çözülemedi", ikon: "bilgi" },
          { tip: "istatistik", deger: toplam(), etiket: "puan", ikon: "kupa" },
        ] },
        ...(kapali.length
          ? [{ tip: "izgara", sutun: 2, cocuklar: kapali.map((e) => ({ tip: "kart", id: `kapali-${e.id}`, renk: arsiv[e.id].dogru ? "murdum" : undefined, cocuklar: [
            { tip: "gorsel", eser: e },
            { tip: "baslik", metin: e.ad, boyut: 3 },
            { tip: "metin", metin: `${e.yuzyil}. yüzyıl · ${arsiv[e.id].dogru ? `${arsiv[e.id].puan} p` : "çözülemedi"}`, soluk: true },
          ] })) }]
          : [{ tip: "metin", metin: "Arşivin boş. Bir dosya aç, hükmünü ver; kapanan dosyalar burada saklanır.", ortali: true }]),
      ],
    };
  }

  function rutbeEkrani() {
    const p = toplam();
    const r = [...RUTBELER].reverse().find((x) => p >= x.puan) ?? RUTBELER[0];
    const sonraki = RUTBELER.find((x) => x.puan > p);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Rütbe", alt: r.ad },
        { tip: "istatistik", deger: p, etiket: `puan · ${r.ad}`, ikon: "kupa" },
        sonraki
          ? { tip: "ilerleme", deger: p - r.puan, toplam: sonraki.puan - r.puan, etiket: `${sonraki.ad} rütbesine` }
          : { tip: "metin", metin: "En yüksek rütbedesin.", ortali: true },
        { tip: "liste", ogeler: RUTBELER.map((x) => ({ id: `r-${x.puan}`, metin: x.ad, alt: `${x.puan} puan`, ikon: p >= x.puan ? "yildiz" : "kupa" })) },
        { tip: "metin", metin: `Her dosya ${BASLANGIC_PUAN} puanla açılır; açtığın her ipucu ${IPUCU_BEDEL} puan düşürür (en az ${EN_AZ}).`, soluk: true },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
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

// Hükmü ele vermesin: sayılar, yüzyıl ifadeleri ve türbenin kendi adı karartılır.
function karartilmis(cumle, e) {
  let c = cumle
    .replace(/\b[XVI]{1,5}\.\s*(yüzyıl|yy)/gi, "███. $1")
    .replace(/\d+/g, "███");
  const adlar = e.ad.replace(/\(.*?\)/g, " ").split(/[\s()/-]+/)
    .filter((k) => k.length > 3 && !/^(türbe|türbesi|kabri|hazire|haziresi|ve)$/i.test(k));
  for (const ad of adlar) c = c.replace(new RegExp(ad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "███");
  return c.length > 360 ? `${c.slice(0, 359)}…` : c;
}

function mesafe(a, b) {
  if (!a?.konum || !b?.konum) return Infinity;
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.konum.lat - a.konum.lat) * r, dLng = (b.konum.lng - a.konum.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.konum.lat * r) * Math.cos(b.konum.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const metre = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
