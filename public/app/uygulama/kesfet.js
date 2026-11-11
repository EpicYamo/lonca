// Android uygulaması · Keşfet sayfası (alt gezinmede "Keşfet", data-sekme="moduller").
// Web sitesindeki gibi her şeyi tek yerde arar ve süzer:
//  - Üstte arama kutusu: yazdıkça modül kartları ve eser kartları anında süzülür.
//  - Bölümlü denetim: Modüller (Modüllerim rafı + kategori çipleri + modül kartları) · Eserler.
//  - Eserler: tür çipleri, il / ilçe seçimi, yüzyıl çipleri; fotoğraflı kartlar iki sütun, 24'er 24'er yüklenir.
//    Karta dokununca eser sayfası alttan açılır.
// Modül kartlarını app.js çizer; burada yalnızca süzülür. Eser verisi /api/eserler'den bir kez gelir.
import { TUR_ADI } from "/app/ekranlar.js";

const SAYFA = 24;
const $ = (s) => document.querySelector(s);
const kucuk = (s) => String(s ?? "").toLocaleLowerCase("tr");
const el = (etiket, ozellik = {}, ...cocuklar) => {
  const d = Object.assign(document.createElement(etiket), ozellik);
  d.append(...cocuklar.flat().filter((c) => c != null));
  return d;
};

export function kesfetKur() {
  const ana = $("#ana-ekran");
  const hedef = $("#modullerim-bolum");
  if (!ana || !hedef || $("#kesfet-ust")) return;

  // ---------- Arama ve bölümlü denetim ----------
  const ara = el("input", { type: "search", id: "kesfet-ara", placeholder: "Modül ya da eser ara", autocomplete: "off", enterKeyHint: "search", maxLength: 60 });
  ara.setAttribute("aria-label", "Modül ya da eser ara");
  const temizle = el("button", { type: "button", className: "kesfet-temizle", hidden: true, textContent: "×" });
  temizle.setAttribute("aria-label", "Aramayı temizle");
  const kutu = el("label", { className: "kesfet-ara-kutu" }, ara, temizle);
  kutu.insertAdjacentHTML("afterbegin", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
  const bolumDugme = (id, ad) => {
    const b = el("button", { type: "button", textContent: ad });
    b.dataset.bolum = id;
    b.setAttribute("role", "tab");
    return b;
  };
  const bolumler = el("div", { className: "kesfet-bolumler", role: "tablist" }, bolumDugme("moduller", "Modüller"), bolumDugme("eserler", "Eserler"));
  bolumler.setAttribute("aria-label", "Keşfet bölümleri");
  const ust = el("section", { id: "kesfet-ust", className: "kesfet-ust" }, kutu, bolumler);
  ust.dataset.sekme = "moduller";
  ust.setAttribute("aria-label", "Ara ve süz");

  // ---------- Eserler bölümü ----------
  const sayac = el("p", { className: "kesfet-sayac", role: "status" });
  const turCipleri = el("div", { className: "kesfet-cipler", role: "group" });
  turCipleri.setAttribute("aria-label", "Türe göre süz");
  const ilSec = el("select", { className: "kesfet-sec" });
  ilSec.setAttribute("aria-label", "İl seç");
  const ilceSec = el("select", { className: "kesfet-sec" });
  ilceSec.setAttribute("aria-label", "İlçe seç");
  const yuzyilCipleri = el("div", { className: "kesfet-cipler", role: "group" });
  yuzyilCipleri.setAttribute("aria-label", "Yüzyıla göre süz");
  const duvar = el("ul", { className: "kesfet-duvar" });
  const dahaFazla = el("button", { type: "button", className: "dugme ikincil kesfet-daha", hidden: true, textContent: "Daha fazla göster" });
  const eserBolum = el("section", { id: "kesfet-eserler", className: "kesfet-eserler" },
    el("div", { className: "kesfet-suzgec" }, turCipleri, el("div", { className: "kesfet-secimler" }, ilSec, ilceSec), yuzyilCipleri),
    sayac, duvar, dahaFazla);
  eserBolum.dataset.sekme = "moduller";
  eserBolum.setAttribute("aria-label", "Eserler");

  hedef.before(ust);
  $("#uygulamalar-baslik")?.closest("section")?.after(eserBolum);

  let bolum = "moduller", eserler = null, gosterilen = SAYFA;
  const suzgec = { tur: "", il: "", ilce: "", yuzyil: "" };

  function bolumSec(id, { odak = false } = {}) {
    bolum = id;
    ana.dataset.kesfet = id;
    for (const b of bolumler.children) {
      const secili = b.dataset.bolum === id;
      b.setAttribute("aria-selected", String(secili));
      b.tabIndex = secili ? 0 : -1;
    }
    if (odak) bolumler.querySelector(`[data-bolum="${id}"]`)?.focus();
    if (id === "eserler") eserleriHazirla();
    aramaUygula();
  }
  bolumler.addEventListener("click", (o) => {
    const b = o.target.closest("[data-bolum]");
    if (b && b.dataset.bolum !== bolum) { window.loncaMobil?.titret?.("secim"); bolumSec(b.dataset.bolum); }
  });
  bolumler.addEventListener("keydown", (o) => {
    if (o.key !== "ArrowLeft" && o.key !== "ArrowRight") return;
    o.preventDefault();
    bolumSec(bolum === "moduller" ? "eserler" : "moduller", { odak: true });
  });

  // ---------- Arama ----------
  function aramaUygula() {
    const q = kucuk(ara.value.trim());
    temizle.hidden = !ara.value;
    // Modül kartları: ad, kategori ve açıklama içinde arar.
    let gorunenModul = 0;
    for (const li of document.querySelectorAll("#moduller > li[data-id]")) {
      const uygun = !q || kucuk(li.textContent).includes(q);
      li.hidden = !uygun;
      if (uygun) gorunenModul++;
    }
    let bos = $("#kesfet-modul-bos");
    if (q && !gorunenModul) {
      if (!bos) {
        bos = el("li", { id: "kesfet-modul-bos", className: "bos" });
        $("#moduller")?.append(bos);
      }
      bos.textContent = `"${ara.value.trim()}" için modül bulunamadı. Eserler bölümüne bak.`;
    } else bos?.remove();
    if (eserler) { gosterilen = SAYFA; eserleriCiz(); }
  }
  let zaman = null;
  ara.addEventListener("input", () => { clearTimeout(zaman); zaman = setTimeout(aramaUygula, 120); });
  ara.addEventListener("keydown", (o) => { if (o.key === "Enter") ara.blur(); if (o.key === "Escape" && ara.value) { o.stopPropagation(); ara.value = ""; aramaUygula(); } });
  temizle.addEventListener("click", (o) => { o.preventDefault(); ara.value = ""; aramaUygula(); ara.focus(); });
  // Modül listesi yeniden çizilince (sıralama, kategori, rafa ekleme) arama yeniden uygulanır.
  new MutationObserver(() => { if (ara.value) requestAnimationFrame(aramaUygula); }).observe($("#moduller"), { childList: true });

  // ---------- Eserler ----------
  function cip(kap, deger, ad, adet, anahtar) {
    const b = el("button", { type: "button", className: "kesfet-cip" }, ad, adet != null ? el("small", { textContent: String(adet) }) : null);
    const secili = suzgec[anahtar] === deger;
    b.classList.toggle("secili", secili);
    b.setAttribute("aria-pressed", String(secili));
    b.addEventListener("click", () => { suzgec[anahtar] = deger; gosterilen = SAYFA; suzgecCiz(); eserleriCiz(); });
    kap.append(b);
  }
  const sayim = (liste, alan) => {
    const s = new Map();
    for (const e of liste) if (e[alan] != null && e[alan] !== "") s.set(e[alan], (s.get(e[alan]) ?? 0) + 1);
    return s;
  };
  function suzgecCiz() {
    turCipleri.replaceChildren();
    cip(turCipleri, "", "Tümü", eserler.length, "tur");
    for (const [tur, n] of [...sayim(eserler, "tur")].sort((a, b) => b[1] - a[1])) cip(turCipleri, tur, TUR_ADI[tur] ?? tur, n, "tur");
    const iller = [...sayim(eserler, "il").keys()].sort((a, b) => a.localeCompare(b, "tr"));
    ilSec.replaceChildren(el("option", { value: "", textContent: "Tüm iller" }), ...iller.map((il) => el("option", { value: il, textContent: il })));
    ilSec.value = suzgec.il;
    // İlçe listesi seçili il ve türde eseri olan ilçelerden oluşur; boş sonuç veren seçim sunulmaz.
    const ilceler = [...sayim(eserler.filter((e) => (!suzgec.il || e.il === suzgec.il) && (!suzgec.tur || e.tur === suzgec.tur)), "ilce").keys()].sort((a, b) => a.localeCompare(b, "tr"));
    if (!ilceler.includes(suzgec.ilce)) suzgec.ilce = "";
    ilceSec.replaceChildren(el("option", { value: "", textContent: "Tüm ilçeler" }), ...ilceler.map((x) => el("option", { value: x, textContent: x })));
    ilceSec.value = suzgec.ilce;
    yuzyilCipleri.replaceChildren();
    cip(yuzyilCipleri, "", "Her yüzyıl", null, "yuzyil");
    for (const y of [...sayim(eserler, "yuzyil").keys()].sort((a, b) => a - b)) cip(yuzyilCipleri, String(y), `${y}. yüzyıl`, null, "yuzyil");
  }
  ilSec.addEventListener("change", () => { suzgec.il = ilSec.value; suzgec.ilce = ""; gosterilen = SAYFA; suzgecCiz(); eserleriCiz(); });
  ilceSec.addEventListener("change", () => { suzgec.ilce = ilceSec.value; gosterilen = SAYFA; eserleriCiz(); });

  const uyanlar = () => {
    const q = kucuk(ara.value.trim());
    return eserler.filter((e) => (!suzgec.tur || e.tur === suzgec.tur) && (!suzgec.il || e.il === suzgec.il) && (!suzgec.ilce || e.ilce === suzgec.ilce)
      && (!suzgec.yuzyil || String(e.yuzyil) === suzgec.yuzyil)
      && (!q || kucuk(`${e.ad} ${e.ilce ?? ""} ${e.il ?? ""} ${TUR_ADI[e.tur] ?? ""}`).includes(q)));
  };
  function eserleriCiz() {
    const liste = uyanlar();
    sayac.textContent = liste.length ? `${liste.length} eser` : "Bu süzgeçle eşleşen eser yok.";
    duvar.replaceChildren(...liste.slice(0, gosterilen).map((e, i) => {
      const foto = el("span", { className: "kesfet-foto" });
      foto.setAttribute("aria-hidden", "true");
      if (e.fotograflar?.[0]) foto.style.backgroundImage = `url("${e.fotograflar[0]}")`;
      else foto.classList.add("bos");
      const b = el("button", { type: "button", className: "kesfet-kart" }, foto,
        el("span", { className: "kesfet-kart-metin" },
          el("span", { className: "kesfet-kart-tur", textContent: [TUR_ADI[e.tur] ?? "Eser", e.yuzyil ? `${e.yuzyil}. yüzyıl` : null].filter(Boolean).join(" · ") }),
          el("strong", { textContent: e.ad }),
          el("span", { className: "kesfet-kart-yer", textContent: [e.ilce, e.il].filter(Boolean).join(", ") })));
      b.addEventListener("click", () => window.loncaUygulama?.eserAc(e.id));
      const li = el("li", {}, b);
      li.style.setProperty("--i", String(i % SAYFA));
      return li;
    }));
    dahaFazla.hidden = liste.length <= gosterilen;
  }
  dahaFazla.addEventListener("click", () => { gosterilen += SAYFA; eserleriCiz(); });

  let yukleniyor = null;
  function eserleriHazirla() {
    if (eserler || yukleniyor) return;
    sayac.textContent = "Eserler yükleniyor…";
    yukleniyor = fetch("/api/eserler").then((y) => (y.ok ? y.json() : Promise.reject(new Error(`İstek başarısız (${y.status})`))))
      .then((liste) => { eserler = Array.isArray(liste) ? liste : []; suzgecCiz(); eserleriCiz(); })
      .catch((h) => { sayac.textContent = `Eserler yüklenemedi: ${h.message}. Bağlantını kontrol et.`; })
      .finally(() => { yukleniyor = null; });
  }

  bolumSec("moduller");
  return { bolumSec };
}
