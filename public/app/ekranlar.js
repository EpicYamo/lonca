import { haritaGoster } from "./harita.js";
import { ucKur, ucVarMi, ODAK_ADI } from "./uc.js";
import { ciniArkaPlan } from "/ortak/cini.js";
import { cizim } from "/ortak/cizimler.js";
import { yildizSac, konfeti, ciz, say, baglaninca } from "/ortak/animasyon.js";

export const TUR_ADI = {
  cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı",
  kutuphane: "Kütüphane", sivil: "Sivil yapı", diger: "Yapı",
};
export const TUR_RENGI = {
  cami: "kobalt", mescit: "kobalt", han: "mercan", carsi: "mercan", hamam: "firuze", medrese: "zumrut", kutuphane: "zumrut",
  cesme: "firuze", kopru: "firuze", turbe: "murdum", hazire: "murdum", tekke: "murdum", kulliye: "altin", imaret: "altin",
};
const turAdi = (t) => TUR_ADI[t] ?? (t ? String(t) : "Eser");
const yuzyilMetni = (y) => (Number.isFinite(Number(y)) && y ? `${Number(y)}. yüzyıl` : "");
const metin = (x) => (x == null ? "" : String(x));

export function ekranYontemleri({ el, sahneyeKoy, seslendir, ilerlemeAyarla, rozetKaydet, onizleme, duzeltmeAc }) {
  const temizlikler = new Set();
  function hataBildir(eser) {
    const d = el("button", { className: "hata-bildir", type: "button", textContent: "Bir hata mı gördün? Bildir" });
    d.addEventListener("click", () => duzeltmeAc(eser));
    return d;
  }
  function gorsel(eser, sinif = "gorsel") {
    const foto = Array.isArray(eser?.fotograflar) ? eser.fotograflar.find((f) => typeof f === "string") : null;
    if (foto) return el("img", { className: `${sinif} foto`, src: foto, alt: `${metin(eser.ad)} fotoğrafı`, loading: "lazy" });
    const kap = el("div", { className: `${sinif} cizimli`, role: "img", ariaLabel: `${turAdi(eser?.tur)} çizimi` });
    kap.style.backgroundImage = ciniArkaPlan(metin(eser?.id || eser?.ad), TUR_RENGI[eser?.tur]);
    const cerceve = el("span", { className: "cizim-cerceve" });
    cerceve.innerHTML = cizim(eser?.tur); 
    kap.append(cerceve);
    return kap;
  }

  function cipler(eser) {
    return el("p", { className: "cipler" },
      el("span", { className: `cip tur-${metin(eser?.tur)}`, textContent: turAdi(eser?.tur) }),
      yuzyilMetni(eser?.yuzyil) ? el("span", { className: "cip", textContent: yuzyilMetni(eser.yuzyil) }) : null);
  }

  function yerBilgisi(eser) {
    const yer = eser?.adres || [eser?.ilce, eser?.il].filter(Boolean).join(", ");
    const m = Number(eser?.mesafe_m);
    const mesafe = Number.isFinite(m) && eser?.mesafe_m != null ? (m < 1000 ? `${m} m uzakta` : `${(m / 1000).toFixed(1)} km uzakta`) : "";
    const p = el("p", { className: "yer" });
    p.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>';
    p.append(el("span", { textContent: metin(yer) }));
    if (mesafe) p.append(el("span", { className: "mesafe", textContent: mesafe }));
    return p;
  }

  function dugme(etiket, sinif = "dugme") {
    return el("button", { className: sinif, textContent: etiket });
  }

  function bekle(kap, etiket = "Devam") {
    return new Promise((coz) => {
      const d = dugme(etiket);
      d.addEventListener("click", () => coz(), { once: true });
      kap.append(d);
      if (!onizleme) d.focus({ preventScroll: true });
    });
  }

  return {
    // ---------- Temel ----------
    "ekran.metin": async (yazi) => {
      const paragraflar = metin(yazi).split(/\n+/).filter(Boolean);
      const kap = sahneyeKoy(el("div", { className: "panel" },
        ...paragraflar.map((p, i) => el("p", { className: i === 0 ? "panel-metin" : "panel-ek", textContent: p }))));
      seslendir(metin(yazi));
      await bekle(kap);
    },

    "ekran.kart": async (eser) => {
      const kap = sahneyeKoy(el("article", { className: "eser-kart" },
        gorsel(eser),
        el("div", { className: "eser-govde" },
          cipler(eser),
          el("h2", { className: "eser-ad", textContent: metin(eser?.ad) }),
          yerBilgisi(eser),
          eser?.tarihce?.tr ? el("p", { className: "tarihce", textContent: metin(eser.tarihce.tr) }) : null,
          el("p", { className: "kaynak", textContent: `Kaynak: ${metin(eser?.kaynak) || "belirtilmemiş"}` }),
          duzeltmeAc && eser?.id ? hataBildir(eser) : null)));
      baglaninca(kap).then(() => ciz(kap.querySelector(".cizim-cerceve svg")));
      seslendir(`${metin(eser?.ad)}. ${turAdi(eser?.tur)}. ${yuzyilMetni(eser?.yuzyil)}. ${metin(eser?.tarihce?.tr)}`);
      await bekle(kap);
    },

    "ekran.soru": (soru, secenekler) => new Promise((coz) => {
      const liste = (Array.isArray(secenekler) ? secenekler : []).slice(0, 8)
        .map((s) => (typeof s === "string" ? { metin: s } : { metin: metin(s?.metin), dogru: s?.dogru }));
      const bilgiVar = liste.some((x) => typeof x.dogru === "boolean");
      const harfler = "ABCDEFGH";
      const kutu = el("div", { className: "secenekler", role: "group", ariaLabel: metin(soru) });
      const dugmeler = liste.map((s, i) => {
        const d = el("button", { className: "secenek" },
          el("span", { className: "harf", ariaHidden: "true", textContent: harfler[i] }),
          el("span", { className: "secenek-metin", textContent: s.metin }));
        d.addEventListener("click", () => {
          dugmeler.forEach((x) => (x.disabled = true));
          if (bilgiVar) {
            liste.forEach((x, j) => {
              if (x.dogru) { dugmeler[j].dataset.sonuc = "dogru"; dugmeler[j].append(el("span", { className: "sonuc-etiket", textContent: "Doğru" })); }
            });
            if (!s.dogru) { d.dataset.sonuc = "yanlis"; d.append(el("span", { className: "sonuc-etiket", textContent: "Senin cevabın" })); }
            else yildizSac(d.querySelector(".harf"));
            seslendir(s.dogru ? "Doğru!" : `Yanlış. Doğru cevap: ${liste.find((x) => x.dogru)?.metin ?? ""}`);
          }
          setTimeout(() => coz({ secim: i, metin: s.metin, dogru: bilgiVar ? !!s.dogru : null }), bilgiVar ? 1300 : 150);
        });
        return d;
      });
      kutu.append(...dugmeler);
      sahneyeKoy(el("div", { className: "panel soru-paneli" }, el("p", { className: "soru-metin", textContent: metin(soru) })), kutu);
      seslendir(`${metin(soru)}. Seçenekler: ${liste.map((s) => s.metin).join(", ")}`);
    }),

    "ekran.galeri": (eserler, secenek = {}) => new Promise((coz) => {
      const liste = (Array.isArray(eserler) ? eserler : []).slice(0, 60);
      const serit = el("div", { className: "galeri", role: "list" });
      serit.append(...liste.map((eser, i) => {
        const ac = dugme("Bu eseri aç", "dugme kucuk");
        ac.addEventListener("click", () => coz(eser), { once: true });
        const kart = el("article", { className: "galeri-kart", role: "listitem" },
          gorsel(eser),
          el("div", { className: "galeri-govde" },
            cipler(eser),
            el("h3", { textContent: metin(eser?.ad) }),
            yerBilgisi(eser),
            ac));
        kart.style.setProperty("--i", String(Math.min(i, 6)));
        return kart;
      }));
      const kapat = dugme("Galeriyi kapat", "dugme ikincil");
      kapat.addEventListener("click", () => coz(null), { once: true });
      sahneyeKoy(
        el("h2", { className: "ekran-baslik", textContent: metin(secenek.baslik) || "Eser galerisi" }),
        el("p", { className: "ekran-alt", textContent: liste.length ? `${liste.length} eser · kaydırarak gez` : "Gösterilecek eser yok." }),
        serit, kapat);
      seslendir(`${metin(secenek.baslik) || "Eser galerisi"}. ${liste.length} eser.`);
    }),

    "ekran.zaman": async (eserler, secenek = {}) => {
      const gruplar = new Map();
      for (const e of Array.isArray(eserler) ? eserler.slice(0, 80) : []) {
        const y = Number(e?.yuzyil) || 0;
        if (!gruplar.has(y)) gruplar.set(y, []);
        gruplar.get(y).push(e);
      }
      const sirali = [...gruplar.entries()].sort((a, b) => a[0] - b[0]);
      const ol = el("ol", { className: "zaman" }, ...sirali.map(([y, liste], i) =>
        el("li", { className: "zaman-durak", style: `--i:${i}` },
          el("span", { className: "zaman-boncuk", ariaHidden: "true" }),
          el("h3", { className: "zaman-yuzyil", textContent: y ? `${y}. yüzyıl` : "Tarihi bilinmeyen" }),
          el("ul", { className: "zaman-eserler" }, ...liste.map((e) =>
            el("li", {}, el("span", { className: "zaman-eser-ad", textContent: metin(e?.ad) }),
              el("span", { className: "zaman-eser-tur", textContent: turAdi(e?.tur) })))))));
      const kap = sahneyeKoy(
        el("h2", { className: "ekran-baslik", textContent: metin(secenek.baslik) || "Zaman çizelgesi" }),
        el("p", { className: "ekran-alt", textContent: "Eserler yapıldıkları yüzyıla göre" }),
        ol);
      seslendir(`${metin(secenek.baslik) || "Zaman çizelgesi"}. ${sirali.map(([y, l]) => `${y}. yüzyıl: ${l.map((e) => e.ad).join(", ")}`).join(". ")}`);
      await bekle(kap);
    },

    "ekran.sonuc": async (s = {}) => {
      const toplam = Math.max(0, Number(s.toplam) || 0), puan = Math.max(0, Math.min(Number(s.puan) || 0, toplam || Infinity));
      const oran = toplam ? puan / toplam : 1;
      const cevre = 2 * Math.PI * 54;
      const halka = el("div", { className: "sonuc-halka", role: "img", ariaLabel: toplam ? `${toplam} üzerinden ${puan}` : `${puan} puan` });
      halka.innerHTML = `<svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="54" class="halka-iz"/><circle cx="64" cy="64" r="54" class="halka-dolgu" stroke-dasharray="${cevre}" stroke-dashoffset="${cevre}"/></svg>`;
      const sayi = el("span", { className: "halka-sayi", textContent: "0" });
      halka.append(sayi);
      if (toplam) halka.append(el("span", { className: "halka-toplam", textContent: `/ ${toplam}` }));
      const kap = sahneyeKoy(el("div", { className: "panel sonuc" },
        halka,
        el("h2", { className: "sonuc-baslik", textContent: metin(s.baslik) || "Sonuç" }),
        s.mesaj ? el("p", { className: "panel-ek", textContent: metin(s.mesaj) }) : null));
      baglaninca(halka).then(() => {
        halka.querySelector(".halka-dolgu").style.strokeDashoffset = String(cevre * (1 - oran));
        say(sayi, puan, 1300);
        if (toplam && puan === toplam) setTimeout(konfeti, 900);
      });
      seslendir(`${metin(s.baslik) || "Sonuç"}. ${toplam ? `${toplam} üzerinden ${puan}` : `${puan} puan`}. ${metin(s.mesaj)}`);
      await bekle(kap);
    },

    "ekran.rozet": async (r = {}) => {
      const ad = metin(r.ad).slice(0, 40) || "Rozet";
      const muhur = el("div", { className: "muhur", role: "img", ariaLabel: `${ad} rozeti` });
      muhur.innerHTML = `<span class="muhur-isinlar"></span><span class="muhur-parilti"></span><svg viewBox="0 0 120 120" aria-hidden="true">
        <g class="muhur-yildiz"><rect x="22" y="22" width="76" height="76" rx="6"/><rect x="22" y="22" width="76" height="76" rx="6" transform="rotate(45 60 60)"/></g>
        <circle cx="60" cy="60" r="30" class="muhur-ic"/>
        <path d="M60 40l5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L60 70.1l-11.7 6.2 2.2-13.1-9.5-9.3 13.1-1.9z" class="muhur-sembol"/></svg>`;
      const kap = sahneyeKoy(el("div", { className: "panel rozet-paneli" },
        muhur,
        el("p", { className: "rozet-kazandin", textContent: "Yeni rozet" }),
        el("h2", { className: "rozet-ad", textContent: ad }),
        r.aciklama ? el("p", { className: "panel-ek", textContent: metin(r.aciklama) }) : null));
      rozetKaydet({ ad });
      baglaninca(muhur).then(() => setTimeout(() => yildizSac(muhur, 22), 450));
      seslendir(`Yeni rozet: ${ad}. ${metin(r.aciklama)}`);
      await bekle(kap);
    },

    "ekran.ilerleme": async (adim, toplam) => {
      ilerlemeAyarla(Number(adim) || 0, Number(toplam) || 0);
    },

    "ekran.ucVarMi": (eser) => ucVarMi(eser),
    "ekran.uc": async (s = {}) => {
      const duraklar = (Array.isArray(s.duraklar) ? s.duraklar : []).slice(0, 12)
        .map((d) => ({ odak: metin(d?.odak) || "genel", baslik: metin(d?.baslik), metin: metin(d?.metin) }));
      if (!duraklar.length) duraklar.push({ odak: "genel", baslik: "", metin: "" });
      const eser = s.eser ?? s.yapi?.eser;
      if (!(await ucVarMi(eser))) return { acildi: false }; 
      const sahne3 = el("div", { className: "uc-sahne", role: "region", ariaLabel: "3B gezi" });
      const bilgi = el("div", { className: "uc-bilgi", ariaLive: "polite" });
      const geri = dugme("Önceki", "dugme ikincil kucuk");
      const ileri = dugme("Sonraki durak", "dugme kucuk");
      const sayac = el("span", { className: "uc-sayac" });
      const atla = dugme("Geziyi atla", "uc-atla");
      const kap = sahneyeKoy(
        el("div", { className: "uc-ust" },
          s.baslik ? el("h2", { className: "ekran-baslik", textContent: metin(s.baslik) }) : el("span"), atla),
        sahne3, bilgi, el("div", { className: "uc-gezinme" }, geri, sayac, ileri));
      void kap;
      const uc = await ucKur(sahne3, { eser, odak: duraklar[0].odak, noktalar: false });
      temizlikler.add(uc.yokEt);
      let i = 0;
      return new Promise((coz) => {
        function goster() {
          const d = duraklar[i];
          bilgi.replaceChildren(
            el("p", { className: "uc-durak-adi", textContent: d.baslik || ODAK_ADI[d.odak] || "" }),
            d.metin ? el("p", { className: "uc-durak-metin", textContent: d.metin }) : null);
          sayac.textContent = `${i + 1} / ${duraklar.length}`;
          geri.disabled = i === 0;
          ileri.textContent = i === duraklar.length - 1 ? "Geziyi bitir" : "Sonraki durak";
          seslendir(`${d.baslik || ODAK_ADI[d.odak] || ""}. ${d.metin}`);
        }
        geri.addEventListener("click", () => { if (i > 0) { i--; uc.git(duraklar[i].odak); goster(); } });
        atla.addEventListener("click", () => { uc.yokEt(); temizlikler.delete(uc.yokEt); coz({ acildi: true }); });
        ileri.addEventListener("click", () => {
          if (i === duraklar.length - 1) { uc.yokEt(); temizlikler.delete(uc.yokEt); coz({ acildi: true }); return; }
          i++; uc.git(duraklar[i].odak); goster();
        });
        goster();
      });
    },

    _bilesen: { gorsel, cipler, yerBilgisi, turAdi },
    _temizle() { for (const f of temizlikler) { try { f(); } catch {} } temizlikler.clear(); },

    "ekran.harita": (eserler, secenek) =>
      haritaGoster(Array.isArray(eserler) ? eserler.slice(0, 200) : [], secenek ?? {}, { el, sahneyeKoy, seslendir, gorsel, cipler, yerBilgisi, dugme, turAdi }),
  };
}
