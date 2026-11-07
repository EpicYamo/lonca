import { haritaKur, BAG_RENK, bagTuruAdi } from "./harita.js";
import { ikon } from "/ortak/ikonlar.js";
import { ciniArkaPlan } from "/ortak/cini.js";
import { konfeti, yildizSac, hareketAzalt } from "/ortak/animasyon.js";
import { dalisKur, dalisKareleri } from "./dalis.js";

const MAKS_DUGUM = 900, MAKS_DERINLIK = 24;
const metin = (x) => (x == null ? "" : String(x));
const RENKLER = ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"];

export function sahneOlustur({ el, kap, sekmeCubugu, gonder, bileşen }) {
  const { gorsel, cipler, yerBilgisi, turAdi } = bileşen;
  const agirlar = new Map(); // id → { tip, kap, api, kullanildi }
  let sekmeler = [], seciliSekme = null, ilkCizim = true, sayac = 0, oncekiImza = null;
  let gecmis = [];                 
  const sureler = new Map();       

  function imza(agac) {
    const n = Array.isArray(agac?.cocuklar) ? agac.cocuklar[0] : agac;
    const c = Array.isArray(n?.cocuklar) ? n.cocuklar[0] : null;
    return JSON.stringify([n?.tip, n?.baslik, n?.metin, c?.tip, c?.metin ?? c?.id]);
  }

  function ikonlu(ad, yazi) {
    const s = el("span", { className: "s-ikon", ariaHidden: "true" });
    s.innerHTML = ikon(ad);
    return yazi == null ? s : [s, el("span", { textContent: yazi })];
  }

  function dokun(oge, id, ek = {}) {
    oge.addEventListener("click", () => gonder({ tur: "dokun", id: metin(id), ...ek }));
  }

  function ciz(n, derinlik = 0) {
    if (!n || typeof n !== "object") return null;
    if (++sayac > MAKS_DUGUM) throw new Error(`Arayüz çok büyük (en fazla ${MAKS_DUGUM} öğe)`);
    if (derinlik > MAKS_DERINLIK) throw new Error("Arayüz çok derin");
    const cocuklar = () => (Array.isArray(n.cocuklar) ? n.cocuklar : []).map((c) => ciz(c, derinlik + 1)).filter(Boolean);

    switch (n.tip) {
      case "sutun": return el("div", { className: `s-sutun s-aralik-${["dar", "genis"].includes(n.aralik) ? n.aralik : "normal"}` }, ...cocuklar());
      case "satir": return el("div", { className: `s-satir s-hizala-${["bas", "orta", "son", "yay"].includes(n.hizala) ? n.hizala : "orta"}` }, ...cocuklar());
      case "izgara": {
        const d = el("div", { className: "s-izgara" }, ...cocuklar());
        d.style.setProperty("--sutun", String([1, 2, 3].includes(n.sutun) ? n.sutun : 2));
        return d;
      }
      case "kaydirma": return el("div", { className: "s-kaydirma" }, ...cocuklar());
      case "kart": {
        const tik = n.id != null;
        const d = el(tik ? "button" : "div", { className: `s-kart${tik ? " s-tik" : ""} renk-${RENKLER.includes(n.renk) ? n.renk : "yok"}` }, ...cocuklar());
        if (tik) { d.dataset.odak = `kart:${n.id}`; dokun(d, n.id); }
        return d;
      }
      case "afis": {
        const d = el("header", { className: "s-afis" });
        const foto = n.eser?.fotograflar?.find?.((f) => typeof f === "string");
        if (foto) d.style.backgroundImage = `linear-gradient(180deg, rgba(10,18,40,.05), rgba(10,18,40,.82)), url("${encodeURI(foto)}")`;
        else d.style.backgroundImage = `linear-gradient(180deg, rgba(10,18,40,.15), rgba(10,18,40,.78)), ${ciniArkaPlan(metin(n.desen ?? n.eser?.id ?? n.baslik), RENKLER.includes(n.renk) ? n.renk : undefined)}`;
        d.append(el("h2", { className: "s-afis-baslik", textContent: metin(n.baslik) }));
        if (n.alt) d.append(el("p", { className: "s-afis-alt", textContent: metin(n.alt) }));
        return d;
      }
      case "baslik": {
        const b = [1, 2, 3].includes(n.boyut) ? n.boyut : 2;
        return el(`h${b + 1}`, { className: `s-baslik s-b${b}`, textContent: metin(n.metin) });
      }
      case "metin": return el("p", { className: `s-metin${n.soluk ? " soluk" : ""}${n.ortali ? " ortali" : ""}`, textContent: metin(n.metin) });
      case "dugme": {
        const d = el("button", { className: `s-dugme ${["ikincil", "hayalet"].includes(n.tur) ? n.tur : "ana"}`, disabled: !!n.devre_disi });
        if (n.ikon) d.append(...ikonlu(n.ikon, metin(n.metin))); else d.textContent = metin(n.metin);
        d.dataset.odak = `dugme:${n.id}`;
        dokun(d, n.id);
        return d;
      }
      case "ikon_dugme": {
        const d = el("button", { className: "s-ikon-dugme", ariaLabel: metin(n.etiket), title: metin(n.etiket) }, ikonlu(n.ikon));
        d.dataset.odak = `ikon:${n.id}`;
        dokun(d, n.id);
        return d;
      }
      case "eser": {
        const e = n.eser ?? {};
        const boyut = ["kucuk", "satir"].includes(n.boyut) ? n.boyut : "buyuk";
        const d = el("button", { className: `s-eser s-eser-${boyut}` });
        d.dataset.odak = `eser:${n.id ?? ""}:${metin(e.id)}`;
        if (boyut === "satir") {
          d.append(gorsel(e, "s-eser-kucuk-gorsel"), el("span", { className: "s-eser-metin" },
            el("strong", { textContent: metin(e.ad) }), el("span", { textContent: [turAdi(e.tur), e.yuzyil ? `${e.yuzyil}. yüzyıl` : ""].filter(Boolean).join(" · ") })));
        } else {
          d.append(gorsel(e, "s-eser-gorsel"), el("span", { className: "s-eser-govde" },
            boyut === "buyuk" ? cipler(e) : null,
            el("strong", { className: "s-eser-ad", textContent: metin(e.ad) }),
            boyut === "buyuk" ? yerBilgisi(e) : el("span", { className: "s-eser-tur", textContent: turAdi(e.tur) })));
        }
        dokun(d, n.id ?? "eser", { eser: e });
        return d;
      }
      case "gorsel": return gorsel(n.eser ?? {}, "s-gorsel");
      case "cipler": return el("p", { className: "cipler" }, ...(Array.isArray(n.ogeler) ? n.ogeler : []).slice(0, 12).map((c) => el("span", { className: "cip", textContent: metin(c) })));
      case "istatistik": {
        const d = el("div", { className: "s-istatistik" });
        if (n.ikon) d.append(ikonlu(n.ikon));
        d.append(el("strong", { textContent: metin(n.deger) }), el("span", { textContent: metin(n.etiket) }));
        return d;
      }
      case "ilerleme": {
        const toplam = Math.max(1, Number(n.toplam) || 1), deger = Math.max(0, Math.min(toplam, Number(n.deger) || 0));
        const cubuk = el("div", { className: "s-ilerleme", role: "progressbar", ariaValueMin: "0", ariaValueMax: String(toplam), ariaValueNow: String(deger), ariaLabel: metin(n.etiket) || "İlerleme" },
          el("span", {}));
        cubuk.firstChild.style.width = `${(deger / toplam) * 100}%`;
        return el("div", { className: "s-ilerleme-kap" }, n.etiket ? el("span", { className: "s-ilerleme-etiket", textContent: `${metin(n.etiket)} · ${deger}/${toplam}` }) : null, cubuk);
      }
      case "liste": {
        const ul = el("ul", { className: "s-liste" });
        for (const o of (Array.isArray(n.ogeler) ? n.ogeler : []).slice(0, 200)) {
          const d = el("button", { className: "s-liste-ogesi" });
          d.dataset.odak = `liste:${metin(o?.id)}`;
          if (o?.ikon) d.append(ikonlu(o.ikon));
          d.append(el("span", { className: "s-liste-metin" }, el("strong", { textContent: metin(o?.metin) }), o?.alt ? el("span", { textContent: metin(o.alt) }) : null));
          if (o?.sag) d.append(el("span", { className: "s-liste-sag", textContent: metin(o.sag) }));
          dokun(d, o?.id);
          ul.append(el("li", {}, d));
        }
        return ul;
      }
      case "secenekler": {
        const grup = el("div", { className: "s-secenekler", role: "radiogroup" });
        for (const s of (Array.isArray(n.secenekler) ? n.secenekler : []).slice(0, 8)) {
          const secili = s?.id === n.secili;
          const d = el("button", { className: `s-secenek${secili ? " secili" : ""}`, role: "radio", ariaChecked: String(secili), textContent: metin(s?.metin) });
          d.dataset.odak = `sec:${n.id}:${metin(s?.id)}`;
          d.addEventListener("click", () => gonder({ tur: "sec", id: metin(n.id), deger: metin(s?.id) }));
          grup.append(d);
        }
        return grup;
      }
      case "girdi": {
        const girdi = el("input", { className: "s-girdi", placeholder: metin(n.ipucu), value: metin(n.deger), ariaLabel: metin(n.ipucu) || "Metin" });
        girdi.dataset.odak = `girdi:${n.id}`;
        const form = el("form", { className: "s-form" }, girdi, el("button", { className: "s-dugme ana", textContent: metin(n.dugme) || "Gönder" }));
        form.addEventListener("submit", (e) => { e.preventDefault(); gonder({ tur: "gonder", id: metin(n.id), deger: girdi.value.slice(0, 500) }); });
        return form;
      }
      case "harita": return agirBilesen(n, "harita", (kutu) => haritaKur(kutu, {
        eserler: n.eserler, rota: !!n.rota, secili: n.secili,
        baglantilar: n.baglantilar, hayaletBaglantilar: n.hayaletBaglantilar, sis: n.sis, etiketler: n.etiketler, odak: n.odak,
        onSec: (eser) => gonder({ tur: "dokun", id: metin(n.id), eser }),
        onBagSec: (bag) => { if (bag?.id) gonder({ tur: "dokun", id: `bag:${metin(bag.id)}`, bag }); },
      }), (api) => api.guncelle({ eserler: n.eserler, rota: !!n.rota, secili: n.secili, baglantilar: n.baglantilar, hayaletBaglantilar: n.hayaletBaglantilar, sis: n.sis, etiketler: n.etiketler, odak: n.odak }));
      case "graf": {
        const merkez = n.merkez ?? {};
        const iliskiler = (Array.isArray(n.iliskiler) ? n.iliskiler : []).filter((x) => x?.eser).slice(0, 8);
        const kap = el("section", { className: "s-graf", role: "group", ariaLabel: `${metin(merkez.ad)} kaynaklı bağ ağı` });
        if (!iliskiler.length) {
          kap.append(el("p", { className: "s-graf-bos", textContent: "Bu eser için kayıtlı tarihsel bağ yok." }));
          return kap;
        }
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 440 360");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `${metin(merkez.ad)} ve ${iliskiler.length} kaynaklı tarihsel bağ`);
        const cx = 220, cy = 155, R = 112;
        const kisa = (s, n) => { const t = metin(s); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
        const defs = document.createElementNS(NS, "defs");
        const cizgiGrubu = document.createElementNS(NS, "g");
        const dugumGrubu = document.createElementNS(NS, "g");
        svg.append(defs, cizgiGrubu, dugumGrubu);

        const hale = document.createElementNS(NS, "circle");
        hale.setAttribute("cx", cx);
        hale.setAttribute("cy", cy);
        hale.setAttribute("r", 39);
        hale.setAttribute("class", "s-graf-hale");
        dugumGrubu.append(hale);
        const merkezDaire = document.createElementNS(NS, "circle");
        merkezDaire.setAttribute("cx", cx);
        merkezDaire.setAttribute("cy", cy);
        merkezDaire.setAttribute("r", 32);
        merkezDaire.style.fill = "var(--ana, #b99345)";
        merkezDaire.style.stroke = "var(--zemin)";
        merkezDaire.style.strokeWidth = "4";
        dugumGrubu.append(merkezDaire);
        const merkezYazi = document.createElementNS(NS, "text");
        merkezYazi.setAttribute("x", cx);
        merkezYazi.setAttribute("y", cy + 4);
        merkezYazi.setAttribute("text-anchor", "middle");
        merkezYazi.style.fill = "var(--ana-metin, #fff)";
        merkezYazi.style.font = "700 10px var(--yazi-baslik, sans-serif)";
        merkezYazi.textContent = kisa(merkez.ad, 16);
        dugumGrubu.append(merkezYazi);

        iliskiler.forEach((il, i) => {
          const aci = (i / iliskiler.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(aci) * R;
          const y = cy + Math.sin(aci) * R;
          const cizgi = document.createElementNS(NS, "line");
          cizgi.setAttribute("x1", cx);
          cizgi.setAttribute("y1", cy);
          cizgi.setAttribute("x2", x);
          cizgi.setAttribute("y2", y);
          cizgi.setAttribute("stroke", BAG_RENK[il.tur] ?? BAG_RENK.komsu);
          cizgi.setAttribute("stroke-width", "3");
          cizgi.setAttribute("stroke-opacity", ".62");
          cizgi.setAttribute("stroke-linecap", "round");
          cizgiGrubu.append(cizgi);

          const g = document.createElementNS(NS, "g");
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "button");
          g.setAttribute("aria-label", `${metin(il.eser.ad)}. ${bagTuruAdi(il.tur)}${il.baslik ? `: ${metin(il.baslik)}` : ""}. Açıklama ve kaynak aşağıda.`);
          g.style.cursor = "pointer";
          const baslik = document.createElementNS(NS, "title");
          baslik.textContent = `${metin(il.eser.ad)} — ${metin(il.baslik || bagTuruAdi(il.tur))}`;
          const foto = il.eser.fotograflar?.find?.((f) => typeof f === "string");
          if (foto) {
            const kirp = document.createElementNS(NS, "clipPath");
            const kirpId = `graf-foto-${i}-${Math.random().toString(36).slice(2)}`;
            kirp.setAttribute("id", kirpId);
            const daireKirp = document.createElementNS(NS, "circle");
            daireKirp.setAttribute("cx", x);
            daireKirp.setAttribute("cy", y);
            daireKirp.setAttribute("r", 10);
            kirp.append(daireKirp);
            defs.append(kirp);
            const resim = document.createElementNS(NS, "image");
            resim.setAttribute("href", foto);
            resim.setAttribute("x", x - 10);
            resim.setAttribute("y", y - 10);
            resim.setAttribute("width", 20);
            resim.setAttribute("height", 20);
            resim.setAttribute("preserveAspectRatio", "xMidYMid slice");
            resim.setAttribute("clip-path", `url(#${kirpId})`);
            resim.setAttribute("aria-hidden", "true");
            g.append(resim);
          }
          const daire = document.createElementNS(NS, "circle");
          daire.setAttribute("cx", x);
          daire.setAttribute("cy", y);
          daire.setAttribute("r", 12);
          daire.setAttribute("fill", foto ? "transparent" : BAG_RENK[il.tur] ?? BAG_RENK.komsu);
          daire.setAttribute("class", "s-graf-dugum");
          daire.style.stroke = "var(--zemin)";
          daire.style.strokeWidth = "3";
          const yazi = document.createElementNS(NS, "text");
          yazi.setAttribute("x", x);
          yazi.setAttribute("y", y + 26);
          yazi.setAttribute("text-anchor", "middle");
          yazi.setAttribute("class", "s-graf-dugum-adi");
          yazi.textContent = kisa(il.eser.ad, 16);
          g.append(baslik, daire, yazi);
          const sec = () => gonder({ tur: "dokun", id: `eser:${metin(il.eser.id)}`, eser: il.eser });
          g.addEventListener("click", sec);
          g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sec(); } });
          dugumGrubu.append(g);
        });
        kap.append(el("p", { className: "s-graf-ipucu", textContent: `${iliskiler.length} kaynaklı bağ · çizgiler yol/rota değildir. Açıklamayı ve künyeyi aşağıda incele.` }), svg);

        const liste = el("div", { className: "s-graf-liste" });
        for (const il of iliskiler) {
          const d = el("button", { className: `s-graf-oge s-graf-${metin(il.tur)}`, type: "button" });
          const foto = il.eser.fotograflar?.find?.((f) => typeof f === "string");
          d.append(
            foto ? el("img", { className: "s-graf-foto", src: foto, alt: "", loading: "lazy" }) : el("span", { className: "s-graf-foto s-graf-foto-bos", ariaHidden: "true", textContent: "✧" }),
            el("span", { className: "s-graf-govde" },
              el("span", { className: "s-graf-tur", textContent: bagTuruAdi(il.tur) }),
              el("strong", { textContent: metin(il.eser.ad) }),
              il.baslik ? el("span", { className: "s-graf-baslik", textContent: metin(il.baslik) }) : null,
              il.aciklama ? el("span", { className: "s-graf-aciklama", textContent: metin(il.aciklama) }) : null,
              il.kaynak ? el("small", { className: "s-graf-kaynak", textContent: `Kaynak: ${metin(il.kaynak)}` }) : null),
            el("span", { className: "s-graf-ok", ariaHidden: "true", textContent: "›" }));
          d.addEventListener("click", () => gonder({ tur: "dokun", id: `eser:${metin(il.eser.id)}`, eser: il.eser }));
          liste.append(d);
        }
        kap.append(liste);
        return kap;
      }
      case "rozet": {
        const d = el("div", { className: `s-rozet${n.kazanildi ? " kazanildi" : ""}` });
        d.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><g><rect x="26" y="26" width="68" height="68" rx="6"/><rect x="26" y="26" width="68" height="68" rx="6" transform="rotate(45 60 60)"/></g><circle cx="60" cy="60" r="26"/><path d="M60 43l5 10.4 11.4 1.7-8.2 8 2 11.3L60 69l-10.2 5.4 2-11.3-8.2-8 11.4-1.7z"/></svg>`;
        d.append(el("strong", { textContent: metin(n.ad) }), n.aciklama ? el("span", { textContent: metin(n.aciklama) }) : null,
          el("span", { className: "gizli-metin", textContent: n.kazanildi ? "Kazanıldı" : "Henüz kazanılmadı" }));
        return d;
      }
      case "ust_cubuk": {
        const d = el("header", { className: "s-ust-cubuk" });
        if (n.geri != null) {
          const g = el("button", { className: "s-ust-geri", ariaLabel: "Geri" }, ikonlu("geri"));
          g.dataset.odak = `ust-geri:${n.geri}`;
          dokun(g, n.geri);
          d.append(g);
        }
        d.append(el("div", { className: "s-ust-metin" },
          el("strong", { textContent: metin(n.baslik) }), n.alt ? el("span", { textContent: metin(n.alt) }) : null));
        for (const b of (Array.isArray(n.sag) ? n.sag : []).slice(0, 2)) {
          const x = el("button", { className: "s-ust-ikon", ariaLabel: metin(b?.etiket), title: metin(b?.etiket) }, ikonlu(b?.ikon ?? "bilgi"));
          x.dataset.odak = `ust:${metin(b?.id)}`;
          dokun(x, b?.id);
          d.append(x);
        }
        return d;
      }
      case "kapak": {
        const d = el("section", { className: "s-kapak" });
        const foto = n.eser?.fotograflar?.find?.((f) => typeof f === "string");
        const renk = RENKLER.includes(n.renk) ? n.renk : undefined;
        d.style.backgroundImage = foto
          ? `linear-gradient(180deg, rgba(8,12,28,.15) 0%, rgba(8,12,28,.35) 45%, rgba(8,12,28,.92) 100%), url("${encodeURI(foto)}")`
          : `linear-gradient(180deg, rgba(8,12,28,.25), rgba(8,12,28,.9)), ${ciniArkaPlan(metin(n.desen ?? n.baslik), renk)}`;
        if (!foto) d.style.backgroundSize = "cover, 72px 72px";
        d.append(el("div", { className: "s-kapak-icerik" },
          n.ust ? el("span", { className: "s-kapak-ust", textContent: metin(n.ust) }) : null,
          el("h2", { className: "s-kapak-baslik", textContent: metin(n.baslik) }),
          n.alt ? el("p", { className: "s-kapak-alt", textContent: metin(n.alt) }) : null,
          el("div", { className: "s-kapak-dugmeler" }, ...cocuklar())));
        return d;
      }
      case "fotograflar": {
        const fotolar = (n.eser?.fotograflar ?? []).filter((f) => typeof f === "string").slice(0, 8);
        if (!fotolar.length) return gorsel(n.eser ?? {}, "s-gorsel");
        const serit = el("div", { className: "s-fotograflar", role: "group", ariaLabel: `${metin(n.eser?.ad)} fotoğrafları` },
          ...fotolar.map((f, i) => el("img", { src: f, alt: `${metin(n.eser?.ad)}, fotoğraf ${i + 1}/${fotolar.length}`, loading: "lazy", decoding: "async" })));
        return el("figure", { className: "s-foto-kap" }, serit,
          el("figcaption", { textContent: `Fotoğraf: ${metin(n.eser?.kaynak).split(",").slice(0, 2).join(",") || "Vakıf Katılım"}` }));
      }
      case "sure": {
        const saniye = Math.max(1, Math.min(600, Number(n.saniye) || 30));
        const anahtar = `${metin(n.id)}:${saniye}:${metin(n.tur ?? "")}`;
        let k = sureler.get(anahtar);
        if (!k) { k = { bitis: performance.now() + saniye * 1000, bitti: false }; sureler.set(anahtar, k); }
        k.kullanildi = true;
        const cubuk = el("div", { className: "s-sure", role: "timer", ariaLabel: "Kalan süre" }, el("span", {}), el("b", {}));
        const kalan = () => Math.max(0, k.bitis - performance.now());
        const guncelle = () => {
          if (!cubuk.isConnected) return;
          const t = kalan();
          cubuk.firstChild.style.width = `${(t / (saniye * 1000)) * 100}%`;
          cubuk.lastChild.textContent = `${Math.ceil(t / 1000)} sn`;
          cubuk.classList.toggle("az", t < 5000);
          if (t <= 0) { if (!k.bitti) { k.bitti = true; gonder({ tur: "sure", id: metin(n.id) }); } return; }
          requestAnimationFrame(guncelle);
        };
        requestAnimationFrame(guncelle);
        return cubuk;
      }
      case "dalis": {
        const kareler = dalisKareleri(n.kareler);
        if (kareler.length < 2) return null;
        const id = `dalis:${metin(n.id)}:${kareler.map((k) => k.gorsel).join("|")}`;
        let kayit = agirlar.get(id);
        if (!kayit) {
          const kutu = el("section", { className: "s-dalis", ariaLabel: metin(n.etiket) || "Kaydırarak içine gir" });
          kayit = { kap: kutu, api: dalisKur(kutu, { kareler, etiket: metin(n.etiket) || "Kaydırarak içine gir", el }) };
          agirlar.set(id, kayit);
        }
        kayit.kullanildi = true;
        const son = cocuklar();
        return el("div", { className: "s-dalis-kap" }, kayit.kap, son.length ? el("div", { className: "s-dalis-son" }, ...son) : null);
      }
      case "ayrac": return el("hr", { className: "s-ayrac" });
      case "bosluk": return el("div", { className: "s-bosluk", ariaHidden: "true" });
      default: return null;
    }
  }

  function agirBilesen(n, tip, kur, guncelle) {
    const id = `${tip}:${metin(n.id)}`;
    let kayit = agirlar.get(id);
    if (kayit) {
      kayit.kullanildi = true;
      kayit.api?.then?.((api) => guncelle(api, kayit.son));
      kayit.son = { odak: n.odak };
      return kayit.kap;
    }
    const kutu = el("div", { className: `s-${tip}`, role: "region", ariaLabel: tip === "harita" ? "Harita" : "3B görünüm" });
    kayit = { kap: kutu, kullanildi: true, son: { odak: n.odak } };
    kayit.api = kur(kutu);
    agirlar.set(id, kayit);
    if (tip === "harita") {
      const liste = (Array.isArray(n.eserler) ? n.eserler : []).filter((e) => e?.konum);
      const kap = el("div", { className: "s-agir-kap" }, kutu,
        el("details", { className: "s-esdeger" }, el("summary", { textContent: `Haritadaki ${liste.length} eser (liste)` }),
          el("ul", {}, ...liste.slice(0, 100).map((e) => {
            const d = el("button", { className: "s-liste-ogesi", textContent: metin(e.ad) });
            d.addEventListener("click", () => gonder({ tur: "dokun", id: metin(n.id), eser: e }));
            return el("li", {}, d);
          }))));
      kayit.kap = kap;
    }
    return kayit.kap;
  }

  function sekmeleriCiz() {
    sekmeCubugu.hidden = !sekmeler.length;
    sekmeCubugu.replaceChildren(...sekmeler.map((s) => {
      const secili = s.id === seciliSekme;
      const d = el("button", { className: `sekme${secili ? " secili" : ""}`, role: "tab", ariaSelected: String(secili) }, ...ikonlu(s.ikon ?? "yildiz", s.ad));
      d.addEventListener("click", () => {
        if (seciliSekme === s.id) return;
        seciliSekme = s.id;
        sekmeleriCiz();
        ilkCizim = true; 
        gonder({ tur: "sekme", id: s.id });
      });
      return d;
    }));
  }

  return {
    ayarla(s = {}) {
      sekmeler = (Array.isArray(s.sekmeler) ? s.sekmeler : []).slice(0, 5)
        .map((x) => ({ id: metin(x?.id), ad: metin(x?.ad).slice(0, 14), ikon: x?.ikon })).filter((x) => x.id);
      if (s.sekme) seciliSekme = metin(s.sekme);
      if (!sekmeler.some((x) => x.id === seciliSekme)) seciliSekme = sekmeler[0]?.id ?? null;
      sekmeleriCiz();
      return { baslik: s.baslik ? metin(s.baslik).slice(0, 40) : null };
    },
    ciz(agac) {
      sayac = 0;
      for (const k of agirlar.values()) k.kullanildi = false;
      for (const k of sureler.values()) k.kullanildi = false;
      const odakAnahtari = document.activeElement?.dataset?.odak;
      const yeniImza = imza(agac), ayniGorunum = yeniImza === oncekiImza;
      let yon = "ileri";
      if (!ayniGorunum) {
        const i = gecmis.lastIndexOf(yeniImza);
        if (i >= 0) { yon = "geri"; gecmis = gecmis.slice(0, i + 1); } else gecmis.push(yeniImza);
        if (gecmis.length > 30) gecmis.shift();
      }
      oncekiImza = yeniImza;
      const kaydirma = ayniGorunum ? kap.scrollTop : 0, pencere = ayniGorunum ? scrollY : 0;
      const kok = ciz(agac);
      const ilkCizimdi = ilkCizim;
      const ilkTip = Array.isArray(agac?.cocuklar) ? agac.cocuklar[0]?.tip : agac?.tip;
      const tam = ["ust_cubuk", "afis", "kapak", "dalis"].includes(ilkTip) || agac?.tip === "kapak";
      const sarmal = el("div", { className: `s-kok${ilkCizim ? " s-giris" : ""}${tam ? " s-kok-tam" : ""}` }, kok);
      kap.replaceChildren(sarmal);
      ilkCizim = false;
      for (const [id, k] of agirlar) if (!k.kullanildi) { k.api?.then?.((a) => a.yokEt()); agirlar.delete(id); }
      kap.scrollTop = kaydirma; scrollTo(0, pencere);
      if (!ayniGorunum && !ilkCizimdi && !hareketAzalt()) kap.firstElementChild?.classList.add(yon === "geri" ? "s-kay-geri" : "s-kay-ileri");
      for (const [a, k] of sureler) if (!k.kullanildi) sureler.delete(a);
      if (odakAnahtari && ayniGorunum) kap.querySelector(`[data-odak="${CSS.escape(odakAnahtari)}"]`)?.focus({ preventScroll: true });
    },
    sekmeSec(id) { seciliSekme = id; sekmeleriCiz(); },
    efekt(ad) {
      if (ad === "konfeti") konfeti(80);
      else if (ad === "yildiz") yildizSac(kap.querySelector(".s-kok") ?? kap, 22);
      else if (ad === "titre" && !hareketAzalt()) kap.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { duration: 360 });
      else if (ad === "parla") kap.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.25)" }, { filter: "brightness(1)" }], { duration: 500 });
    },
    temizle() {
      for (const k of agirlar.values()) k.api?.then?.((a) => a.yokEt());
      agirlar.clear();
      sekmeler = []; seciliSekme = null; sekmeleriCiz();
      sureler.clear(); gecmis = []; oncekiImza = null; ilkCizim = true;
    },
  };
}
