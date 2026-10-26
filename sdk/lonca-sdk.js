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

  const depo = {
    oku: (anahtar) => cagir("depo.oku", String(anahtar)),
    yaz: (anahtar, deger) => cagir("depo.yaz", String(anahtar), deger),
  };

  Object.defineProperty(globalThis, "lonca", { value: Object.freeze({ eserler, ekran, sahne, profil, basarim, depo }) });
})();
