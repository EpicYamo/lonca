import { haritaKur, bagTuruAdi } from "./harita.js";
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
        const ic = cocuklar();
        // İçinde düğme varsa kart düğme olamaz (iç içe denetim ekran okuyucuyu şaşırtır); dokunuş yine kartın boş yerinden gelir.
        const icDenetim = ic.some((c) => c.matches?.("button, a, input, select, textarea, [tabindex]") || c.querySelector?.("button, a, input, select, textarea, [tabindex]"));
        const tik = n.id != null;
        const d = el(tik && !icDenetim ? "button" : "div", { className: `s-kart${tik ? " s-tik" : ""} renk-${RENKLER.includes(n.renk) ? n.renk : "yok"}` }, ...ic);
        if (tik && !icDenetim) { d.dataset.odak = `kart:${n.id}`; dokun(d, n.id); }
        else if (tik) d.addEventListener("click", (e) => { if (!e.target.closest("button, a, input, select, textarea, [tabindex]")) gonder({ tur: "dokun", id: metin(n.id) }); });
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
        const svgEl = (ad, ozellik = {}) => {
          const d = document.createElementNS(NS, ad);
          for (const [k, v] of Object.entries(ozellik)) d.setAttribute(k, v);
          return d;
        };
        const turSinifi = (tur) => `s-graf-t-${/^[a-z]+$/.test(metin(tur)) ? tur : "komsu"}`;
        const ilkFoto = (e) => e?.fotograflar?.find?.((f) => typeof f === "string" && f);
        const tekil = Math.random().toString(36).slice(2, 8);
        // Ad iki satıra bölünür; düğüm altındaki yazı dar alana sığsın diye her satır en çok 15 harf.
        // Parantezli diğer adlar çizimde atlanır, tam ad alttaki listede kalır.
        const satirlar = (ad) => {
          const kelimeler = (metin(ad).replace(/\s*\([^)]*\)/g, "").trim() || metin(ad)).split(/\s+/).filter(Boolean), s = [""];
          for (const k of kelimeler) {
            const son = s.length - 1;
            if (!s[son] || (s[son] + " " + k).length <= 15) s[son] = s[son] ? `${s[son]} ${k}` : k;
            else if (s.length < 2) s.push(k);
            else { s[son] += ` ${k}`; break; }
          }
          return s.map((x) => (x.length > 16 ? x.slice(0, 15) + "…" : x));
        };

        kap.append(el("header", { className: "s-graf-ust" },
          el("strong", { textContent: metin(merkez.ad) }),
          el("span", { textContent: `${iliskiler.length} kaynaklı tarihsel bağ` })));

        // Yerleşim: merkez eser ortada, bağlı eserler bir elips üzerinde. Çizgiler yol değil, kaynaklı bağdır.
        const W = 380, H = 336, cx = 190, cy = 162, Rx = 132, Ry = 106, rM = 40, rD = 25;
        const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${metin(merkez.ad)} ve ${iliskiler.length} kaynaklı tarihsel bağ` });
        const defs = svgEl("defs"), cizgiGrubu = svgEl("g"), dugumGrubu = svgEl("g");
        svg.append(defs, cizgiGrubu, dugumGrubu);
        const fotoDaire = (x, y, r, foto, sinif, ad) => {
          const g = svgEl("g");
          g.append(svgEl("circle", { cx: x, cy: y, r, class: `${sinif}-zemin` }));
          if (!foto) {
            const harf = svgEl("text", { x, y: y + r * 0.34, "text-anchor": "middle", class: "s-graf-harf", "font-size": r, "aria-hidden": "true" });
            harf.textContent = metin(ad).trim().slice(0, 1);
            g.append(harf);
          } else {
            const kirpId = `graf-${tekil}-${defs.childNodes.length}`;
            const kirp = svgEl("clipPath", { id: kirpId });
            kirp.append(svgEl("circle", { cx: x, cy: y, r }));
            defs.append(kirp);
            g.append(svgEl("image", { href: foto, x: x - r, y: y - r, width: r * 2, height: r * 2, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${kirpId})`, "aria-hidden": "true" }));
          }
          g.append(svgEl("circle", { cx: x, cy: y, r, class: `${sinif}-halka` }));
          return g;
        };

        const baslangic = iliskiler.length <= 2 ? 0 : -Math.PI / 2;
        iliskiler.forEach((il, i) => {
          const aci = baslangic + (i / iliskiler.length) * Math.PI * 2;
          const x = cx + Math.cos(aci) * Rx, y = cy + Math.sin(aci) * Ry;
          const uz = Math.hypot(x - cx, y - cy) || 1, ux = (x - cx) / uz, uy = (y - cy) / uz;
          const cizgi = svgEl("line", { x1: cx + ux * (rM + 4), y1: cy + uy * (rM + 4), x2: x - ux * (rD + 3), y2: y - uy * (rD + 3), class: `s-graf-cizgi ${turSinifi(il.tur)}` });
          cizgi.style.setProperty("--sira", i);
          cizgiGrubu.append(cizgi);

          // Çizim yalnızca fare/dokunma içindir; klavye ve ekran okuyucu aynı bağları alttaki listeden seçer.
          const g = svgEl("g", { class: `s-graf-dugum ${turSinifi(il.tur)}` });
          g.style.setProperty("--sira", i);
          const ipucu = svgEl("title");
          ipucu.textContent = `${metin(il.eser.ad)}: ${metin(il.baslik || bagTuruAdi(il.tur))}`;
          g.append(ipucu, fotoDaire(x, y, rD, ilkFoto(il.eser), "s-graf-dugum", il.eser.ad));
          // Üst yarıdaki düğümlerin adı düğümün üstüne yazılır, böylece merkeze inen çizginin üstüne binmez.
          const adSatirlari = satirlar(il.eser.ad), ustte = Math.sin(aci) < -0.3;
          adSatirlari.forEach((satir, j) => {
            const ty = ustte ? y - rD - 8 - (adSatirlari.length - 1 - j) * 13 : y + rD + 14 + j * 13;
            const t = svgEl("text", { x, y: ty, "text-anchor": "middle", class: "s-graf-dugum-adi" });
            t.textContent = satir;
            g.append(t);
          });
          const vurgula = (acik) => { svg.classList.toggle("s-graf-odakli", acik); cizgi.classList.toggle("acik", acik); g.classList.toggle("acik", acik); };
          g.addEventListener("pointerenter", () => vurgula(true));
          g.addEventListener("pointerleave", () => vurgula(false));
          g.addEventListener("click", () => gonder({ tur: "dokun", id: `eser:${metin(il.eser.id)}`, eser: il.eser }));
          dugumGrubu.append(g);
        });
        const merkezG = fotoDaire(cx, cy, rM, ilkFoto(merkez), "s-graf-merkez", merkez.ad);
        merkezG.classList.add("s-graf-merkez");
        dugumGrubu.append(merkezG);
        kap.append(svg);

        const turler = [...new Set(iliskiler.map((il) => metin(il.tur)))];
        kap.append(el("ul", { className: "s-graf-lejant", ariaLabel: "Bağ türleri" },
          ...turler.map((t) => el("li", { className: turSinifi(t) }, el("span", { className: "s-graf-nokta", ariaHidden: "true" }), el("span", { textContent: bagTuruAdi(t) })))));

        const liste = el("div", { className: "s-graf-liste" });
        for (const il of iliskiler) {
          const d = el("button", { className: `s-graf-oge ${turSinifi(il.tur)}`, type: "button" });
          const foto = ilkFoto(il.eser);
          d.append(
            foto ? el("img", { className: "s-graf-foto", src: foto, alt: "", loading: "lazy" }) : el("span", { className: "s-graf-foto s-graf-foto-bos", ariaHidden: "true", textContent: metin(il.eser.ad).slice(0, 1) }),
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
        const serit = el("div", { className: "s-fotograflar", role: "group", tabIndex: 0, ariaLabel: `${metin(n.eser?.ad)} fotoğrafları, yana kaydır` },
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
      // Yeni görünümde odak kaybolduysa (silinen düğme ya da gizlenen ana ekran) sahneye taşınır; klavye kaldığı yerden sürer.
      const etkin = document.activeElement;
      if (!ayniGorunum && (!etkin || etkin === document.body || !etkin.isConnected || etkin.checkVisibility?.() === false)) kap.focus({ preventScroll: true });
      return { yeni: !ayniGorunum };
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
