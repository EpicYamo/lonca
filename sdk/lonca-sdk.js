(() => {
  "use strict";
  const bekleyen = new Map();
  let sayac = 0;

  function cagir(yontem, ...args) {
    return new Promise((coz, reddet) => {
      const id = ++sayac;
      bekleyen.set(id, { coz, reddet });
      parent.postMessage({ lonca: 1, id, yontem, args }, "*");
    });
  }

  const olayKuyrugu = [];
  let olayBekleyen = null;

  window.addEventListener("message", (e) => {
    if (e.source !== parent) return;
    const m = e.data;
    if (!m || m.lonca !== 1) return;
    if (m.tur === "kare") { boyutlariAl(m.boyutlar); return kareCalistir(m.dt, m.t); }
    if (m.tur === "calistir" && m.ekran) ekranBoyutu = { en: sayi(m.ekran.en, 360) || 360, boy: sayi(m.ekran.boy, 640) || 640 }; // başlatıcı da dinler
    if (m.tur === "girdi") return girdiAl(m.olay);
    if (m.tur === "olay") {
      if (olayBekleyen) { const coz = olayBekleyen; olayBekleyen = null; coz(m.olay); }
      else olayKuyrugu.push(m.olay);
      return;
    }
    if (m.id == null) return;
    const p = bekleyen.get(m.id);
    if (!p) return;
    bekleyen.delete(m.id);
    m.ok ? p.coz(m.sonuc) : p.reddet(new Error(m.hata));
  });

  function karistir(dizi) {
    for (let i = dizi.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
    }
    return dizi;
  }

  const TEMEL_ALANLAR = ["ad", "tur", "il", "ilce", "yuzyil", "konum", "adres", "tarihce"];
  const dolu = (x) => typeof x === "string" ? x.trim().length > 0 : x != null;
  const ALAN_VAR = {
    ad: (e) => dolu(e.ad), tur: (e) => dolu(e.tur), il: (e) => dolu(e.il), ilce: (e) => dolu(e.ilce),
    yuzyil: (e) => Number.isInteger(e.yuzyil),
    konum: (e) => !!e.konum && Number.isFinite(e.konum.lat) && Number.isFinite(e.konum.lng),
    adres: (e) => dolu(e.adres), tarihce: (e) => !!e.tarihce && dolu(e.tarihce.tr),
    fotograf: (e) => Array.isArray(e.fotograflar) && e.fotograflar.length > 0,
    ad_en: (e) => dolu(e.ad_en), tarihce_en: (e) => !!e.tarihce && dolu(e.tarihce.en),
  };

  const eserler = {
    yakindaki: (secenek = {}) => cagir("eserler.yakindaki", secenek),
    getir: (id) => cagir("eserler.getir", id),
    liste: (secenek = {}) => cagir("eserler.liste", secenek),
    iliskiler: (id) => cagir("eserler.iliskiler", id == null ? null : String(id)),
    yuzyilSecenekleri(eser, adet = 4) {
      const dogru = eser && eser.yuzyil;
      if (!dogru) return [];
      const adaylar = new Set([dogru]);
      for (let d = 1; adaylar.size < adet; d++) {
        if (dogru - d >= 11) adaylar.add(dogru - d);
        if (adaylar.size < adet && dogru + d <= 21) adaylar.add(dogru + d);
      }
      return karistir([...adaylar]).map((y) => ({ metin: `${y}. yüzyıl`, dogru: y === dogru }));
    },
    karistir: (dizi) => karistir([...dizi]),
    tamlik(eser) {
      const e = eser || {};
      const eksikler = TEMEL_ALANLAR.filter((a) => !ALAN_VAR[a](e));
      const var_ = {};
      for (const a of Object.keys(ALAN_VAR)) var_[a] = ALAN_VAR[a](e);
      return { tam: eksikler.length === 0, eksikler, oran: (TEMEL_ALANLAR.length - eksikler.length) / TEMEL_ALANLAR.length, var: var_ };
    },
    TEMEL_ALANLAR: Object.freeze([...TEMEL_ALANLAR]),
  };

  const ekran = {
    metin: (metin) => cagir("ekran.metin", String(metin)),
    kart: (eser) => cagir("ekran.kart", eser),
    soru: (soru, secenekler) => cagir("ekran.soru", String(soru), secenekler),
    harita: (liste, secenek = {}) => cagir("ekran.harita", Array.isArray(liste) ? liste : [], secenek),
    galeri: (liste, secenek = {}) => cagir("ekran.galeri", Array.isArray(liste) ? liste : [], secenek),
    zaman: (liste, secenek = {}) => cagir("ekran.zaman", Array.isArray(liste) ? liste : [], secenek),
    sonuc: (secenek = {}) => cagir("ekran.sonuc", secenek),
    rozet: (secenek = {}) => cagir("ekran.rozet", secenek),
    ilerleme: (adim, toplam) => cagir("ekran.ilerleme", adim, toplam),
    uc: (secenek = {}) => cagir("ekran.uc", secenek),
    ucVarMi: (eser) => cagir("ekran.ucVarMi", eser),
    duzeltme: (eser) => cagir("ekran.duzeltme", eser),
  };

  const sahne = {
    ayarla: (secenek = {}) => cagir("sahne.ayarla", secenek),
    ciz: (agac) => cagir("sahne.ciz", agac),
    olay: () => (olayKuyrugu.length ? Promise.resolve(olayKuyrugu.shift()) : new Promise((coz) => { olayBekleyen = coz; })),
    /** for await (const olay of sahne.olaylar()) { ... } */
    async *olaylar() { while (true) yield await sahne.olay(); },
    bildir: (metin) => cagir("sahne.bildir", String(metin)),
    efekt: (ad) => cagir("sahne.efekt", String(ad)),
  };

  const profil = {
    bilgi: () => cagir("profil.bilgi"),
    puanEkle: (puan, neden) => cagir("profil.puanEkle", Number(puan) || 0, neden == null ? null : String(neden)),
  };

  const basarim = {
    tanimla: (liste) => cagir("basarim.tanimla", liste),
    kazan: (id) => cagir("basarim.kazan", String(id)),
    liste: () => cagir("basarim.liste"),
  };

  const dalislar = {
    /** Yayındaki dalış tanımları (uydudan içine kaydırmalı geziler). */
    liste: () => cagir("dalislar.liste"),
  };

  const depo = {
    oku: (anahtar) => cagir("depo.oku", String(anahtar)),
    yaz: (anahtar, deger) => cagir("depo.yaz", String(anahtar), deger),
  };

  // ---------- Oyun: tuval, oyun döngüsü, dokunma, klavye, ses, titreşim ----------
  // Modül görünmez bir çerçevede çalışır; tuvali uygulama çizer. Modül çizim komutlarını gönderir, uygulama her karede
  // { tur:"kare" } ve dokunma/klavye girdisini { tur:"girdi" } iletir. Kare onayı (kare_tamam) gelmeden yeni kare gönderilmez.
  const akis = (veri) => parent.postMessage({ lonca: 1, tur: "akis", veri }, "*");
  const MAKS_KOMUT = 4000;
  const sayi = (x, v = 0) => (Number.isFinite(+x) ? +x : v);
  const yaziMi = (x) => (x == null ? "" : String(x));
  function kalemYap() {
    const k = [];
    const ekle = (c) => { if (k.length < MAKS_KOMUT) k.push(c); return kalem; };
    const kalem = {
      temizle: (renk) => ekle(["temizle", renk == null ? null : yaziMi(renk)]),
      dikdortgen: (x, y, en, boy, renk, s = {}) => ekle(["dikdortgen", sayi(x), sayi(y), sayi(en), sayi(boy), yaziMi(renk ?? "#fff"), sayi(s.yuvarlak), s.cizgi == null ? null : yaziMi(s.cizgi), sayi(s.kalinlik, 2)]),
      daire: (x, y, r, renk, s = {}) => ekle(["daire", sayi(x), sayi(y), Math.max(0, sayi(r)), yaziMi(renk ?? "#fff"), s.cizgi == null ? null : yaziMi(s.cizgi), sayi(s.kalinlik, 2)]),
      cizgi: (x1, y1, x2, y2, renk, kalinlik = 2, s = {}) => ekle(["cizgi", sayi(x1), sayi(y1), sayi(x2), sayi(y2), yaziMi(renk ?? "#fff"), sayi(kalinlik, 2), sayi(s.kesikli)]),
      yol: (noktalar, renk, s = {}) => ekle(["yol", (Array.isArray(noktalar) ? noktalar : []).slice(0, 400).map((n) => [sayi(n?.[0] ?? n?.x), sayi(n?.[1] ?? n?.y)]), yaziMi(renk ?? "#fff"), !!s.kapali, !!s.dolgu, sayi(s.kalinlik, 2)]),
      yazi: (metin, x, y, s = {}) => ekle(["yazi", yaziMi(metin).slice(0, 300), sayi(x), sayi(y), sayi(s.boyut, 16), yaziMi(s.renk ?? "#fff"), yaziMi(s.hiza ?? "sol"), !!s.kalin, yaziMi(s.yazi ?? "sans"), yaziMi(s.taban ?? "orta")]),
      gorsel: (kaynak, x, y, en, boy, s = {}) => {
        const url = typeof kaynak === "string" ? kaynak : Array.isArray(kaynak?.fotograflar) ? kaynak.fotograflar.find((f) => typeof f === "string") : null;
        return url ? ekle(["gorsel", url, sayi(x), sayi(y), sayi(en), sayi(boy), sayi(s.yuvarlak), s.kirp === "sigdir" ? "sigdir" : "kapla"]) : kalem;
      },
      saydamlik: (a) => ekle(["saydamlik", Math.max(0, Math.min(1, sayi(a, 1)))]),
      kaydet: () => ekle(["kaydet"]),
      geriYukle: () => ekle(["geri"]),
      tasi: (x, y) => ekle(["tasi", sayi(x), sayi(y)]),
      dondur: (aci) => ekle(["dondur", sayi(aci)]),
      olcekle: (sx, sy) => ekle(["olcekle", sayi(sx, 1), sayi(sy ?? sx, 1)]),
    };
    return { kalem, komutlar: k };
  }

  const dokunmalar = new Map(); // parmak → { parmak, tuval, x, y, ilkX, ilkY }
  // Tuvallerin gerçek boyutu (mantıksal birim). Tam ekran tuvalde ekranın boyutudur; uygulama her karede ve boyut
  // değişince gönderir. Tuval henüz ekranda değilse uygulama ekranının boyutu kullanılır.
  const boyutlar = new Map();   // tuval → { en, boy }
  let ekranBoyutu = { en: 360, boy: 640 };
  function boyutlariAl(b) {
    if (!b || typeof b !== "object") return;
    for (const [id, v] of Object.entries(b)) if (Array.isArray(v)) boyutlar.set(id, { en: sayi(v[0], 360), boy: sayi(v[1], 640) });
  }
  const tuslar = new Set();
  const dinleyiciler = new Map(); // tur → Set<fn>
  let donguFn = null, karede = false;
  const kareCizimleri = new Map();  // döngü içinde çizilenler kare onayıyla birlikte gider

  function hataBildir(hata) {
    parent.postMessage({ lonca: 1, tur: "hata", mesaj: String(hata && hata.message || hata) }, "*");
  }
  function kareCalistir(dt, t) {
    const fn = donguFn;
    karede = true;
    try { if (fn) fn(sayi(dt, 0.016), sayi(t)); } catch (h) { donguFn = null; hataBildir(h); }
    karede = false;
    const cizimler = Object.fromEntries(kareCizimleri);
    kareCizimleri.clear();
    akis({ tur: "kare_tamam", cizimler, devam: !!donguFn });
  }
  function yay(tur, olay) {
    for (const fn of dinleyiciler.get(tur) ?? []) { try { fn(olay); } catch (h) { hataBildir(h); } }
  }
  function girdiAl(o) {
    if (!o || typeof o !== "object") return;
    if (o.tur === "basla") dokunmalar.set(o.parmak, { parmak: o.parmak, tuval: o.tuval, x: o.x, y: o.y, ilkX: o.x, ilkY: o.y });
    else if (o.tur === "surukle") { const d = dokunmalar.get(o.parmak); if (d) { d.x = o.x; d.y = o.y; } }
    else if (o.tur === "birak") dokunmalar.delete(o.parmak);
    else if (o.tur === "tus") tuslar.add(o.tus);
    else if (o.tur === "tus_birak") tuslar.delete(o.tus);
    else if (o.tur === "odak_kaybi") { tuslar.clear(); dokunmalar.clear(); }
    else if (o.tur === "boyut" && o.tuval != null) boyutlar.set(String(o.tuval), { en: sayi(o.en, 360), boy: sayi(o.boy, 640) });
    yay(o.tur, { ...o });
  }

  const oyun = {
    /** Oyun döngüsünü başlatır: fn(dt saniye, t saniye) her karede çağrılır. Dönen işlev döngüyü durdurur. */
    dongu(fn) {
      donguFn = typeof fn === "function" ? fn : null;
      akis({ tur: "dongu", acik: !!donguFn });
      const bu = donguFn;
      return () => { if (donguFn === bu) { donguFn = null; akis({ tur: "dongu", acik: false }); } };
    },
    durdur() { donguFn = null; akis({ tur: "dongu", acik: false }); },
    get calisiyor() { return !!donguFn; },
    /** Tuvale çizer: fn(kalem) içinde kalem.temizle / dikdortgen / daire / yazi / gorsel… çağır. */
    ciz(id, fn) {
      const { kalem, komutlar } = kalemYap();
      if (typeof fn === "function") fn(kalem);
      if (karede) kareCizimleri.set(String(id), komutlar);
      else akis({ tur: "ciz", id: String(id), komutlar });
    },
    dokunmalar: (tuval) => [...dokunmalar.values()].filter((d) => tuval == null || d.tuval === String(tuval)).map((d) => ({ ...d })),
    tus: (ad) => tuslar.has(String(ad)),
    /** Tuvalin şu anki gerçek boyutu { en, boy }: tam ekran tuvalde ekranın boyutu. Her karede oku, yerleşimi buna göre kur. */
    boyut: (tuval) => {
      const b = (tuval != null && boyutlar.get(String(tuval))) || (tuval == null && boyutlar.values().next().value) || ekranBoyutu;
      return { en: b.en, boy: b.boy };
    },
    dinle(tur, fn) {
      if (typeof fn !== "function") return () => {};
      if (!dinleyiciler.has(tur)) dinleyiciler.set(tur, new Set());
      dinleyiciler.get(tur).add(fn);
      return () => dinleyiciler.get(tur)?.delete(fn);
    },
    ses: (ad) => { akis({ tur: "ses", ses: ad && typeof ad === "object" ? { ...ad } : String(ad ?? "bip") }); },
    titres: (tur) => { akis({ tur: "titres", titres: typeof tur === "number" ? tur : String(tur ?? "hafif") }); },
    rastgele: (a, b) => (b == null ? Math.random() * sayi(a, 1) : sayi(a) + Math.random() * (sayi(b) - sayi(a))),
    tamSayi: (a, b) => { const x = Math.ceil(sayi(a)), y = Math.floor(sayi(b)); return y < x ? x : x + Math.floor(Math.random() * (y - x + 1)); },
    sec: (dizi) => (Array.isArray(dizi) && dizi.length ? dizi[Math.floor(Math.random() * dizi.length)] : undefined),
    sinirla: (x, a, b) => Math.max(a, Math.min(b, x)),
    carpisir: (a, b) => a.x < b.x + b.en && a.x + a.en > b.x && a.y < b.y + b.boy && a.y + a.boy > b.y,
    bekle: (sn) => cagir("oyun.bekle", sayi(sn)),
  };

  Object.defineProperty(globalThis, "lonca", { value: Object.freeze({ eserler, ekran, sahne, profil, basarim, depo, dalislar, oyun }) });
})();
