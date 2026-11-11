// Sunumun sayfa animasyonları. Her işlev sayfa açılınca gsap.context içinde çağrılır: (el, tl, yardim).
// tl sayfanın giriş zaman çizelgesidir (başlık girişi 0-1 sn arasında oynar); döngüler ayrı zaman çizelgesidir.
const { gsap } = window;
const $ = (el, s) => el.querySelector(s);
const $$ = (el, s) => [...el.querySelectorAll(s)];

// Sayaç: 0'dan hedefe sayar.
function say(tl, oge, hedef, an, sure = 1.4) {
  const o = { v: 0 };
  tl.to(o, { v: hedef, duration: sure, ease: "power2.out", onUpdate: () => { oge.textContent = Math.round(o.v).toLocaleString("tr-TR"); } }, an);
}

// Yazı makinesi: metni harf harf yazar.
function yaz(tl, oge, metin, an, hiz = 0.035) {
  const o = { n: 0 };
  tl.to(o, { n: metin.length, duration: metin.length * hiz, ease: "none", onUpdate: () => { oge.textContent = metin.slice(0, Math.round(o.n)); } }, an);
}

// ── 1 · Kapak ──────────────────────────────────────────────────────────────────────────────────
function kapak(el, tl) {
  const baslik = new window.SplitText($(el, ".kapak-baslik"), { type: "chars" });
  tl.from($(el, ".kapak-perde"), { opacity: 0, duration: 1.2 }, 0)
    .from($$(el, ".kapak-etiket > *"), { y: 20, opacity: 0, stagger: 0.08, duration: 0.6, ease: "power3.out" }, 0.2)
    .from($(el, ".kapak-logo"), { scale: 0, rotate: -40, duration: 1, ease: "back.out(1.8)" }, 0.4)
    .from(baslik.chars, { yPercent: 120, opacity: 0, rotateX: -80, stagger: 0.07, duration: 1, ease: "power4.out" }, 0.5)
    .from($(el, ".kapak-alt"), { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 1.1)
    .from($(el, ".soz-metin"), { opacity: 0, x: -30, duration: 0.8 }, 1.5)
    .from($(el, ".soz-cizgi path"), { drawSVG: "0%", duration: 1, ease: "power2.inOut" }, 1.9)
    .from($$(el, ".kapak-kunye li"), { y: 40, opacity: 0, stagger: 0.12, duration: 0.7, ease: "back.out(1.6)" }, 2.2);
  gsap.to($(el, ".kapak-logo"), { y: -10, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 });
}

// ── 3 · Problem: her zorluk kendi sahnesinde gösterilir, sonra Lonca'nın cevabına dönüşür ─────────
// Sağdaki listede bir satıra tıklanınca o zorluğun sahnesine gidilir (sunum sırasında geri dönmek için).
const PROBLEM_SAHNE = [
  // 1 · Bilgi dağınık: kurumlar dağınık, arayan kurumdan kuruma koşar → hepsi tek şemaya toplanır
  (ps, tl, t) => {
    const k = $$(ps, ".kurum");
    const ar = $(ps, ".arayan");
    tl.from(k, { x: () => gsap.utils.random(-300, 300), y: () => gsap.utils.random(-200, 200), rotate: () => gsap.utils.random(-40, 40), opacity: 0, stagger: 0.1, duration: 0.8, ease: "power3.out" }, t)
      .from(ar, { scale: 0, duration: 0.4, ease: "back.out(2)" }, t + 0.8);
    [[-425, -250], [-220, -60], [-15, -260], [190, -50], [395, -230]].forEach(([x, y], j) => tl.to(ar, { x, y, duration: 0.35, ease: "power2.inOut" }, t + 1.2 + j * 0.4));
    tl.to(ar, { scale: 0, opacity: 0, duration: 0.3 }, t + 3.2)
      .to(k, { x: (j, e) => 492 - (e.offsetLeft + 80), y: (j, e) => 190 - (e.offsetTop + 65), scale: 0.3, opacity: 0, duration: 0.7, ease: "power3.in", stagger: 0.05 }, t + 3.2)
      .from($(ps, ".tek-sema"), { scale: 0.4, opacity: 0, duration: 0.6, ease: "back.out(1.8)" }, t + 3.9);
  },
  // 2 · Kilitli format: arama sonuç vermez, kilit düşer → tarayıcı okur, alanlar çıkar, sonuç bulunur
  (ps, tl, t) => {
    tl.from($(ps, ".tarama"), { y: 40, opacity: 0, duration: 0.6 }, t)
      .from($(ps, ".arama"), { scaleX: 0.3, opacity: 0, transformOrigin: "0% 50%", duration: 0.5 }, t + 0.4);
    yaz(tl, $(ps, ".arama-metin"), "Ulucami", t + 0.9, 0.08);
    tl.from($(ps, ".sonuc-yok"), { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2.5)" }, t + 1.6)
      .from($(ps, ".kilit2"), { y: -200, opacity: 0, duration: 0.7, ease: "bounce.out" }, t + 2)
      .to($(ps, ".kilit2"), { y: -60, x: 60, rotate: 30, opacity: 0, duration: 0.5 }, t + 3.2)
      .to($(ps, ".sonuc-yok"), { opacity: 0, duration: 0.3 }, t + 3.2)
      .fromTo($(ps, ".isin"), { top: 0, opacity: 1 }, { top: 370, duration: 1, ease: "none", immediateRender: false }, t + 3.3)
      .to($(ps, ".isin"), { opacity: 0, duration: 0.2 }, t + 4.3)
      .to($$(ps, ".tarama i"), { filter: "blur(0px)", backgroundColor: "#6b8f7f", stagger: 0.1, duration: 0.3 }, t + 3.3)
      .from($$(ps, ".alanlar span"), { x: -60, opacity: 0, stagger: 0.15, duration: 0.5, ease: "power3.out" }, t + 3.6)
      .from($(ps, ".sonuc-var"), { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(2.5)" }, t + 4.3);
  },
  // 3 · Güven: kaynaksız cümle yazılır, soru işaretleri sallanır → kaynaklı, onaylı kayıt gelir
  (ps, tl, t) => {
    const m = $(ps, ".yanlis-metin");
    const metin = m.dataset.metin ?? (m.dataset.metin = m.textContent);
    m.textContent = "";
    tl.from($(ps, ".yanlis-balon"), { scale: 0.6, opacity: 0, transformOrigin: "0% 100%", duration: 0.5, ease: "back.out(2)" }, t);
    yaz(tl, m, metin, t + 0.4, 0.05);
    tl.from($$(ps, ".soru2"), { scale: 0, rotate: 60, stagger: 0.15, duration: 0.5, ease: "back.out(3)" }, t + 1.8)
      .from($(ps, ".yanlis-balon em"), { opacity: 0, x: -20, duration: 0.4 }, t + 2.3)
      .to($$(ps, ".soru2"), { y: -14, duration: 0.2, yoyo: true, repeat: 3, stagger: 0.08 }, t + 2.5)
      .to($(ps, ".yanlis-balon"), { opacity: 0.35, scale: 0.94, duration: 0.5 }, t + 3.2)
      .to($$(ps, ".soru2"), { scale: 0, opacity: 0, stagger: 0.05, duration: 0.3 }, t + 3.2)
      .from($(ps, ".dogru-kart"), { x: 80, opacity: 0, duration: 0.6, ease: "power3.out" }, t + 3.4)
      .from($$(ps, ".tik"), { scale: 0, opacity: 0, stagger: 0.3, duration: 0.45, ease: "back.out(2.5)" }, t + 4);
  },
  // 4 · Gençler: metin duvarı, ilgi düşer, uyku → satırlar dağılır, oyun karoları çıkar, ilgi dolar
  (ps, tl, t) => {
    const cubuk = $(ps, ".ilgi-cubuk i");
    tl.from($(ps, ".metin-duvari"), { y: 30, opacity: 0, duration: 0.5 }, t)
      .from($$(ps, ".metin-duvari i"), { scaleX: 0, transformOrigin: "0% 50%", stagger: 0.06, duration: 0.3 }, t + 0.2)
      .from($(ps, ".ilgi"), { opacity: 0, duration: 0.4 }, t + 0.6)
      .fromTo(cubuk, { width: "80%", backgroundColor: "#ff5d6c" }, { width: "6%", duration: 1.8, ease: "power2.in" }, t + 1)
      .from($(ps, ".uyku"), { opacity: 0, y: 30, duration: 0.8 }, t + 1.8)
      .to($$(ps, ".metin-duvari i"), { x: 200, opacity: 0, stagger: 0.03, duration: 0.3 }, t + 3.2)
      .to($(ps, ".metin-duvari"), { opacity: 0, duration: 0.3 }, t + 3.5)
      .from($$(ps, ".karolar span"), { scale: 0, rotate: -15, stagger: 0.12, duration: 0.5, ease: "back.out(2)" }, t + 3.6)
      .to($(ps, ".uyku"), { opacity: 0, duration: 0.3 }, t + 3.6)
      .to(cubuk, { width: "96%", backgroundColor: "#3fd497", duration: 1, ease: "power2.out" }, t + 3.8);
  },
  // 5 · Erişim: yazı küçülür, soluklaşır → büyür, netleşir; erişilebilirlik anahtarları açılır
  (ps, tl, t) => {
    const y = $(ps, ".kucuk-yazi");
    tl.from($$(ps, ".anahtarlar span"), { x: 40, opacity: 0, stagger: 0.12, duration: 0.5 }, t + 0.3)
      .fromTo(y, { fontSize: 26, color: "#9fb0d4", opacity: 0 }, { fontSize: 14, color: "#4a5a80", opacity: 1, duration: 1.6, ease: "power2.inOut", immediateRender: false }, t)
      .to(y, { fontSize: 38, color: "#ffffff", duration: 0.9, ease: "power3.inOut" }, t + 3.2)
      .to($$(ps, ".anahtarlar i"), { backgroundColor: "#3fd497", "--k": "34px", stagger: 0.3, duration: 0.35 }, t + 3.4);
  },
  // 6 · Kısa ömür: uygulamalar çıkar ve söner → platform tabanı kurulur, modüller üstüne iner, kalır
  (ps, tl, t) => {
    const app = $$(ps, ".eski-app");
    app.forEach((a, j) => {
      tl.from(a, { y: 60, opacity: 0, duration: 0.5, ease: "back.out(1.6)" }, t + j * 0.7)
        .to(a, { filter: "grayscale(1)", opacity: 0.3, rotate: -8, y: 60, duration: 0.6 }, t + j * 0.7 + 0.9);
    });
    tl.to(app, { opacity: 0, duration: 0.3 }, t + 3.2)
      .from($(ps, ".taban"), { scaleX: 0, transformOrigin: "0% 50%", duration: 0.7, ease: "power3.out" }, t + 3.2)
      .from($$(ps, ".modul-yuva span"), { y: -160, opacity: 0, stagger: 0.12, duration: 0.6, ease: "bounce.out" }, t + 3.7);
  },
];

function problem(el, tl) {
  const sahneler = $$(el, ".ps");
  const satirlar = $$(el, ".p-liste li");
  const S = 6.2, T0 = 0.9;
  tl.from(satirlar, { x: 60, opacity: 0, stagger: 0.08, duration: 0.6, ease: "power3.out" }, 0.3);
  sahneler.forEach((ps, i) => {
    const t = T0 + i * S;
    const li = satirlar[i];
    tl.addLabel(`p${i}`, t)
      .fromTo(ps, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, t)
      .fromTo(li, { borderColor: "rgba(160,190,255,0.16)", backgroundColor: "rgba(15,35,80,0.5)" }, { borderColor: "#e2338a", backgroundColor: "rgba(226,51,138,0.18)", duration: 0.4, immediateRender: false }, t)
      .from($(ps, ".ps-ust"), { x: -40, opacity: 0, duration: 0.5 }, t + 0.1)
      .from($(ps, ".ps-not"), { opacity: 0, duration: 0.5 }, t + 0.3);
    PROBLEM_SAHNE[i](ps, tl, t + 0.4);
    tl.from($(ps, ".ps-cevap"), { y: 40, opacity: 0, duration: 0.6, ease: "back.out(1.8)" }, t + 3.7)
      .to($(ps, ".ps-no"), { backgroundColor: "#3fd497", duration: 0.4 }, t + 3.7)
      .to($(li, "b"), { opacity: 0.55, textDecoration: "line-through", duration: 0.3 }, t + 3.9)
      .fromTo($(li, "span"), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, immediateRender: false }, t + 3.9)
      .to(li, { borderColor: "rgba(63,212,151,0.6)", backgroundColor: "rgba(63,212,151,0.08)", duration: 0.4 }, t + S - 0.4);
    if (i < sahneler.length - 1) tl.to(ps, { autoAlpha: 0, y: -30, duration: 0.4 }, t + S - 0.4);
  });
  // Listeden bir zorluğa tıklayınca o sahneye atla
  $(el, ".p-liste").onclick = (e) => {
    const li = e.target.closest("li");
    if (li) tl.seek(`p${li.dataset.i}`);
  };
}

// ── 4 · Çözümün değeri: aynı soru üç yere sorulur; katalog saklar, sıradan yapay zekâ uydurur, Lonca yaşatır ──
function deger(el, tl) {
  const [kat, yz, lonca] = $$(el, ".dserit");
  tl.from($(el, ".soru-balon"), { scale: 0, opacity: 0, transformOrigin: "100% 100%", duration: 0.7, ease: "back.out(1.8)" }, 0.4)
    .from([kat, yz, lonca], { y: 80, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" }, 0.7);
  // Katalog: kart solar, kilitlenir, tozlanır
  tl.from($(kat, ".tozlu-kart"), { y: 40, opacity: 0, duration: 0.7, ease: "power3.out" }, 1.4)
    .to($(kat, ".tozlu-kart"), { filter: "grayscale(1) brightness(0.6)", duration: 1.2 }, 2.1)
    .from($(kat, ".tk-kilit"), { scale: 2.4, opacity: 0, duration: 0.5, ease: "back.out(2)" }, 2.3)
    .to($(kat, ".tozlar"), { opacity: 1, duration: 0.6 }, 2.2)
    .from($(kat, ".hukum"), { y: 30, opacity: 0, duration: 0.6, ease: "power3.out" }, 2.8);
  for (const t of $$(kat, ".tozlar i")) {
    gsap.set(t, { left: `${gsap.utils.random(5, 95)}%`, top: `${gsap.utils.random(15, 95)}%` });
    gsap.fromTo(t, { y: 0, opacity: 0.8 }, { y: -gsap.utils.random(40, 90), x: gsap.utils.random(-20, 20), opacity: 0, duration: gsap.utils.random(2.5, 4.5), repeat: -1, delay: gsap.utils.random(0, 2), ease: "sine.out" });
  }
  // Sıradan yapay zekâ: kendinden emin yazar, kaynak yok, çizilir
  const cevap = $(yz, ".yz-cevap");
  const metin = cevap.dataset.metin ?? (cevap.dataset.metin = cevap.textContent);
  cevap.textContent = "";
  tl.from($(yz, ".yz-balon"), { scale: 0.6, opacity: 0, transformOrigin: "0% 100%", duration: 0.5, ease: "back.out(2)" }, 3.2);
  yaz(tl, cevap, metin, 3.6, 0.04);
  cevap.classList.remove("yanlis");
  tl.add(() => cevap.classList.add("yanlis"), 5.8)
    .from($(yz, ".damga-x"), { scale: 3, opacity: 0, duration: 0.45, ease: "power4.in" }, 5.9)
    .to($(yz, ".yz-balon"), { x: -8, duration: 0.06, yoyo: true, repeat: 5 }, 6.35)
    .from($(yz, ".hukum"), { y: 30, opacity: 0, duration: 0.6, ease: "power3.out" }, 6.6);
  // Lonca: kaynaklı kayıt gelir, ✓ basılır, aynı bilgi oyun/harita/dalış olur
  const yil = $(lonca, ".l-yil");
  const o = { v: 1200 };
  yil.textContent = "1200";
  tl.from($(lonca, ".l-kayit"), { rotateX: -90, opacity: 0, transformPerspective: 900, transformOrigin: "50% 0%", duration: 0.8, ease: "power3.out" }, 7)
    .to(o, { v: 1399, duration: 1.1, ease: "power2.out", onUpdate: () => { yil.textContent = String(Math.round(o.v)); } }, 7.2)
    .from($(lonca, ".kaynak-cip"), { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(2.5)" }, 8.3)
    .from($$(lonca, ".canli span"), { y: -90, scale: 0.3, opacity: 0, stagger: 0.12, duration: 0.6, ease: "back.out(1.8)" }, 8.8)
    .from($(lonca, ".hukum"), { y: 30, opacity: 0, duration: 0.6, ease: "power3.out" }, 9.4)
    .to([kat, yz], { opacity: 0.45, scale: 0.97, duration: 0.8 }, 10)
    .to(lonca, { scale: 1.03, borderColor: "rgba(63,212,151,.8)", boxShadow: "0 0 0 6px rgba(63,212,151,.2), 0 30px 80px rgba(63,212,151,.22)", duration: 0.8 }, 10)
    .from($$(el, ".d-rozet"), { y: 30, opacity: 0, stagger: 0.12, duration: 0.5, ease: "back.out(2)" }, 10.4)
    .from($(el, ".deger-soz"), { x: 60, opacity: 0, duration: 0.7, ease: "power3.out" }, 10.9);
  $$(lonca, ".canli span").forEach((c, i) => gsap.to(c, { y: -6, duration: 1.4 + i * 0.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 10 }));
}

// ── 4 · Çözüm: modül paketi Studio'dan çıkar, platformda damgalanır, uygulamada belirir ───────────
// Her turda sıradaki gerçek modül çıkar. Sıra, telefondaki ilk üç modülün (Eser Keşfi, Vakıf Dalışları,
// Payitaht Atlası) devamıdır: 7 modül, 4 satırlık listede hiç tekrar etmez.
const CIKAN_MODULLER = [
  { ad: "Hanlarda Hazine Avı", renk: "#e2338a" },
  { ad: "Türbe Dedektifi", renk: "#7a5cd6" },
  { ad: "Bursa Pusulası", renk: "#e07a2f" },
  { ad: "Sisli Vakıf Haritası", renk: "#5b6f8f" },
  { ad: "Payitaht Atlası", renk: "#e6c477" },
  { ad: "Vakıf Dalışları", renk: "#1f3a93" },
  { ad: "Eser Keşfi", renk: "#2bb3ad" },
];
const ILK_LISTE = new WeakMap();
function cozum(el, tl) {
  // Sayfaya her dönüşte telefon listesi ve paket ilk haline döner.
  const liste = $(el, ".mini-liste");
  const paketAd = $(el, ".paket span");
  if (!ILK_LISTE.has(liste)) ILK_LISTE.set(liste, liste.innerHTML);
  liste.innerHTML = ILK_LISTE.get(liste);
  let cikanSira = 0;
  paketAd.textContent = CIKAN_MODULLER[0].ad;
  const paketRenk = $(el, ".paket i");
  paketRenk.style.background = CIKAN_MODULLER[0].renk;
  const ist = $$(el, ".istasyon");
  tl.from(ist, { y: 60, opacity: 0, stagger: 0.2, duration: 0.8, ease: "power3.out" }, 0.3)
    .from($(el, ".hat-yol path"), { drawSVG: "0%", duration: 1.2, ease: "power2.inOut" }, 0.8)
    .from($$(el, ".kisiler li"), { scale: 0, stagger: 0.06, duration: 0.4, ease: "back.out(2)" }, 1.1);
  const paket = $(el, ".paket");
  const damgalar = $$(el, ".damgalar li");
  const yol = $(el, "#hat-yolu");
  const dongu = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 1.8 });
  // Yol SVG'si 1600×300; hat alanı 1700 genişliğinde: konumu oranla eşle.
  gsap.set(paket, { xPercent: -50, yPercent: -50 });
  dongu.set(paket, { opacity: 1, scale: 0.6 })
    .to(paket, { scale: 1, duration: 0.4, ease: "back.out(2)" })
    .to(paket, { motionPath: { path: yol, align: yol, alignOrigin: [0.5, 0.5] }, duration: 4, ease: "power1.inOut" }, "<")
    .to(damgalar, { backgroundColor: "#3fd497", color: "#062b1c", stagger: 0.18, duration: 0.25 }, 1.6)
    .to($(el, ".ist-ikon .kivilcim"), { rotate: 180, scale: 1.3, duration: 0.6, yoyo: true, repeat: 1 }, 0)
    .to(paket, { scale: 0.3, opacity: 0, duration: 0.4 }, 4.1)
    .add(() => {
      const { ad, renk } = CIKAN_MODULLER[cikanSira % CIKAN_MODULLER.length];
      cikanSira++;
      // Bir sonraki turda yola çıkacak paketin adı şimdiden yazılır (paket şu an görünmüyor).
      paketAd.textContent = CIKAN_MODULLER[cikanSira % CIKAN_MODULLER.length].ad;
      paketRenk.style.background = CIKAN_MODULLER[cikanSira % CIKAN_MODULLER.length].renk;
      for (const m of liste.querySelectorAll(".yeni")) m.classList.remove("yeni");
      const yeni = document.createElement("div");
      yeni.className = "mini-modul yeni";
      yeni.innerHTML = `<i style="background:${renk}"></i><span></span>`;
      yeni.querySelector("span").textContent = ad;
      liste.prepend(yeni);
      while (liste.children.length > 4) liste.lastElementChild.remove();
      gsap.from(yeni, { height: 0, opacity: 0, scale: 0.6, duration: 0.6, ease: "back.out(2)" });
    }, 4.2)
    .to(damgalar, { backgroundColor: "rgba(0,0,0,0)", color: "#3fd497", duration: 0.4 }, 5);
}

// ── 5 · Vizyon: katalog satırları solar, tek eser yörüngede altı deneyime açılır ───────────────────
function vizyon(el, tl) {
  const kartlar = $$(el, ".deneyim");
  const svg = $(el, ".yorunge-cizgi");
  const R = { x: 430, y: 205 };
  tl.from($(el, ".katalog"), { x: -80, opacity: 0, duration: 0.7 }, 0.3)
    .from($$(el, ".katalog-satir"), { opacity: 0, x: -20, stagger: 0.08, duration: 0.3 }, 0.6)
    .to($(el, ".katalog"), { filter: "grayscale(1)", opacity: 0.35, scale: 0.9, duration: 1 }, 1.6)
    .from($(el, ".merkez-eser"), { scale: 0, rotate: -10, duration: 0.9, ease: "back.out(1.7)" }, 1.4);
  kartlar.forEach((k, i) => {
    const a = (-180 + i * 60) * Math.PI / 180;
    const x = Math.cos(a) * R.x, y = Math.sin(a) * R.y;
    const cizgi = document.createElementNS("http://www.w3.org/2000/svg", "line");
    cizgi.setAttribute("x1", 500); cizgi.setAttribute("y1", 320); cizgi.setAttribute("x2", 500 + x); cizgi.setAttribute("y2", 320 + y);
    svg.append(cizgi);
    tl.from(cizgi, { drawSVG: "0%", duration: 0.5 }, 2.2 + i * 0.12)
      .fromTo(k, { x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }, { x, y, scale: 1, opacity: 1, rotate: gsap.utils.random(-6, 6), duration: 1, ease: "back.out(1.4)" }, 2.2 + i * 0.12);
  });
  tl.from($$(el, ".rozet"), { x: 80, opacity: 0, stagger: 0.12, duration: 0.6, ease: "back.out(2)" }, 3.4);
  // Yörüngede hafif salınım
  kartlar.forEach((k, i) => gsap.to(k, { yPercent: i % 2 ? 6 : -6, duration: 2 + i * 0.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 3.4 }));
  gsap.to($(el, ".merkez-eser"), { boxShadow: "0 0 0 14px rgba(226,51,138,.35), 0 30px 60px rgba(0,0,0,.5)", duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2.4 });
}

// ── 6 · Veri: tarayıcı kitap sayfasını okur, sözcükler kayda uçar, mühür basılır ─────────────────
function veri(el, tl) {
  const kitap = $(el, ".kitap"), kayit = $(el, ".kayit");
  const satirlar = $$(el, ".kayit dl > div");
  tl.from(kitap, { x: -120, rotate: -8, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.2)
    .from(kayit, { opacity: 0, x: 60, duration: 0.7 }, 0.6)
    .set(satirlar, { opacity: 0.12 }, 0.6)
    .fromTo($(el, ".tarayici"), { top: 0, opacity: 1 }, { top: 590, duration: 2.2, ease: "none" }, 1.1)
    .to($(el, ".tarayici"), { opacity: 0, duration: 0.3 }, 3.3);
  // Kitaptaki alan → kayıttaki satır: ışıklandır, kopyasını uçur.
  const alanlar = ["ad", "il", "ilce", "tur", "yuzyil"];
  alanlar.forEach((ad, i) => {
    const kaynak = $(el, `.kitap-metin [data-alan="${ad}"]`);
    const hedef = $(el, `.kayit [data-alan="${ad}"]`);
    const an = 1.4 + i * 0.38;
    tl.add(() => kaynak.classList.add("isik"), an);
    tl.add(() => {
      const kopya = kaynak.cloneNode(true);
      kopya.className = "ucan";
      Object.assign(kopya.style, { position: "absolute", zIndex: 9, padding: "2px 8px", borderRadius: "6px", background: "#e2338a", color: "#fff", font: "700 22px Figtree, sans-serif", pointerEvents: "none" });
      el.append(kopya);
      const k = konum(el, kaynak), h = konum(el, $(hedef, "dd"));
      gsap.fromTo(kopya, { x: k.x, y: k.y }, { x: h.x, y: h.y, duration: 0.7, ease: "power3.inOut", onComplete: () => { kopya.remove(); gsap.to(hedef, { opacity: 1, backgroundColor: "rgba(63,212,151,.16)", duration: 0.3 }); } });
    }, an + 0.1);
  });
  tl.to($$(el, '.kayit [data-alan="konum"], .kayit [data-alan="foto"], .kayit [data-alan="kaynak"]'), { opacity: 1, backgroundColor: "rgba(63,212,151,.16)", stagger: 0.25, duration: 0.3 }, 3.4)
    .from($$(el, ".kayit-fotolar img"), { scale: 0, stagger: 0.08, duration: 0.35, ease: "back.out(2)" }, 3.6)
    .from($(el, ".muhur"), { scale: 3, opacity: 0, rotate: 20, duration: 0.45, ease: "power4.in" }, 4.3)
    .to(kayit, { x: "+=6", duration: 0.05, yoyo: true, repeat: 5 }, 4.75)
    // Dış kaynak: Vikipedi kaydı doğrulanmamış etiketiyle onay kuyruğuna iner.
    .from($(el, ".dk-kart"), { y: -60, opacity: 0, duration: 0.6, ease: "back.out(1.6)" }, 4.9)
    .from($(el, ".dk-etiket"), { scale: 0, duration: 0.4, ease: "back.out(3)" }, 5.4)
    .from($(el, ".kuyruk"), { opacity: 0, duration: 0.5 }, 5.2)
    .to($(el, ".dk-kart"), { y: 214, scale: 0.92, duration: 0.9, ease: "power2.inOut" }, 5.9)
    .from($(el, ".kuyruk-admin"), { scale: 0, duration: 0.4, ease: "back.out(3)" }, 6.8)
    .to($(el, ".dk-kart"), { boxShadow: "0 0 0 5px #3fd497, 0 20px 40px rgba(0,0,0,.4)", duration: 0.4 }, 7.1)
    .from($$(el, ".sayaclar div"), { y: 40, opacity: 0, stagger: 0.1, duration: 0.6 }, 2)
    .from($(el, ".kural"), { x: 60, opacity: 0, duration: 0.6 }, 5.6);
  $$(el, ".sayaclar b").forEach((b, i) => say(tl, b, Number(b.dataset.say), 2.1 + i * 0.1, 2));
}

function konum(kok, oge) {
  const a = kok.getBoundingClientRect(), b = oge.getBoundingClientRect();
  const k = a.width / kok.offsetWidth || 1;
  return { x: (b.left - a.left) / k, y: (b.top - a.top) / k };
}

// ── 7 · Kullanıcı deneyimi: gerçek eser konumları haritada, süzgeçle süzülür, kart açılır ──────────
function ux(el, tl, { NOKTALAR }) {
  const harita = $(el, ".ux-harita"), kap = $(el, ".ux-noktalar");
  // Bursa merkez (Osmangazi-Yıldırım) çevresindeki gerçek eserler
  const kutu = { lat0: 40.165, lat1: 40.215, lng0: 29.02, lng1: 29.11 };
  const W = 372, H = 560;
  const bursa = NOKTALAR.filter(([la, ln, , il]) => il === "B" && la > kutu.lat0 && la < kutu.lat1 && ln > kutu.lng0 && ln < kutu.lng1);
  const noktalar = bursa.map(([la, ln, t]) => {
    const i = document.createElement("i");
    if (t === 3) i.className = "han";
    i.style.left = `${((ln - kutu.lng0) / (kutu.lng1 - kutu.lng0)) * W}px`;
    i.style.top = `${(1 - (la - kutu.lat0) / (kutu.lat1 - kutu.lat0)) * H}px`;
    kap.append(i);
    return i;
  });
  // Süs: yollar, park, dere
  $(el, ".ux-yollar").innerHTML = '<path class="park" d="M40 330 q60 -40 120 0 t80 60 l-30 80 q-80 20 -170 -40z"/><path class="su" d="M0 90 C 120 120, 220 60, 400 110 L400 128 C 220 80, 120 140, 0 108z"/>' +
    '<path d="M0 260 C 120 250, 260 300, 400 280"/><path d="M180 0 C 170 160, 210 360, 190 520"/><path class="ince" d="M0 400 L400 360"/><path class="ince" d="M60 0 L120 520"/><path class="ince" d="M300 0 C 280 200, 330 300, 300 520"/><path class="ince" d="M0 180 L400 200"/>';
  const hanlar = noktalar.filter((n) => n.classList.contains("han"));
  const hedef = hanlar.sort((a, b) => Math.abs(parseFloat(a.style.left) - 190) - Math.abs(parseFloat(b.style.left) - 190))[0] ?? noktalar[0];
  const parmak = $(el, ".parmak");
  const tel = $(el, ".ux-tel");
  const telEkran = $(el, ".ux-tel .tel-ekran");
  const nerede = (o) => { const p = konum(telEkran, o); return { x: p.x + o.offsetWidth / 2, y: p.y + o.offsetHeight / 2 }; };
  const sayi = $(el, ".ux-sayi i");
  gsap.set(parmak, { opacity: 0 });
  gsap.set($(el, ".ux-kart"), { yPercent: 140 });

  tl.from(tel, { y: 120, opacity: 0, rotate: -4, duration: 1, ease: "power3.out" }, 0.2)
    .from($(el, ".ux-tel2"), { x: 200, opacity: 0, rotate: 20, duration: 1, ease: "power3.out" }, 0.5)
    .from(noktalar, { scale: 0, opacity: 0, duration: 0.4, stagger: { each: 0.008, from: "random" }, ease: "back.out(3)" }, 0.8)
    .from($$(el, ".ux-adimlar li"), { x: 60, opacity: 0, stagger: 0.2, duration: 0.6 }, 1.2);
  const dokun = (oge, an, isle) => {
    tl.add(() => { const p = nerede(oge); gsap.set(parmak, { x: p.x, y: p.y }); }, an - 0.45)
      .to(parmak, { opacity: 1, scale: 1, duration: 0.3 }, an - 0.4)
      .to(parmak, { scale: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, an)
      .add(isle, an + 0.1)
      .to(parmak, { opacity: 0, duration: 0.3 }, an + 0.4);
  };
  const adim = (i) => tl.to($$(el, ".ux-adimlar li")[i], { color: "#e2338a", duration: 0.3 }, "<");
  dokun($(el, '.cip[data-c="il"]'), 2.2, () => $(el, '.cip[data-c="il"]').classList.add("secili")); adim(0);
  tl.add(() => say(gsap.timeline(), sayi, 131, 0, 0.6), 2.3);
  dokun($(el, '.cip[data-c="ilce"]'), 3.2, () => $(el, '.cip[data-c="ilce"]').classList.add("secili")); adim(1);
  dokun($(el, '.cip[data-c="tur"]'), 4.2, () => {
    $(el, '.cip[data-c="tur"]').classList.add("secili");
    gsap.to(noktalar.filter((n) => !n.classList.contains("han")), { scale: 0.3, opacity: 0.12, duration: 0.5, stagger: { each: 0.004, from: "random" } });
    gsap.to(hanlar, { scale: 1.5, duration: 0.5, ease: "back.out(3)" });
    say(gsap.timeline(), sayi, hanlar.length, 0, 0.5);
  });
  tl.add(() => { gsap.to(harita, { scale: 1.6, transformOrigin: `${hedef.style.left} ${hedef.style.top}`, duration: 1.2, ease: "power3.inOut" }); }, 5.1);
  dokun(hedef, 6.4, () => { hedef.classList.add("hedef"); gsap.to($(el, ".ux-kart"), { yPercent: 0, duration: 0.7, ease: "back.out(1.4)" }); }); adim(2);
}

// ── 8 · Modüller: deste yelpaze gibi açılır, kartlar sırayla öne çıkar ───────────────────────────
function moduller(el, tl) {
  const kartlar = $$(el, ".kart-m");
  const n = kartlar.length;
  const yer = (i, one = -1) => {
    const t = i - (n - 1) / 2;
    const ondeMi = i === one;
    return { x: t * 252, y: Math.abs(t) * 22 + (ondeMi ? -40 : 0), rotate: t * 5, scale: ondeMi ? 1.12 : 0.95, zIndex: ondeMi ? 20 : 10 - Math.abs(Math.round(t)) };
  };
  gsap.set(kartlar, { x: 0, y: 400, rotate: 0, opacity: 0 });
  tl.to(kartlar, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "power3.out" }, 0.3);
  kartlar.forEach((k, i) => tl.to(k, { ...yer(i), duration: 1, ease: "power4.out" }, 0.9 + i * 0.05));
  tl.from($(el, ".alt-not"), { y: 20, opacity: 0, duration: 0.5 }, 1.8);
  const dongu = gsap.timeline({ repeat: -1, delay: 2.4 });
  kartlar.forEach((_, one) => {
    dongu.add(() => kartlar.forEach((k, i) => gsap.to(k, { ...yer(i, one), duration: 0.7, ease: "power3.out" })))
      .to({}, { duration: 1.6 });
  });
}

// ── 9 · Dalış: 4 fotoğraf → yapay zekâ çoğaltır → klasörler → film şeridi → dalış ──────────────────
const KOK = "/medya/dalis/bursa-ulucami/";
const ORIJINAL = [1, 2, 3, 4].map((n) => `/medya/eserler/bursa-ulucami-${n}.jpg`);
// Dalışın gerçek kareleri (public/medya/dalis/bursa-ulucami/kunye.json); kaynak: hangi orijinalden üretildi.
const KARELER = [
  ["u6", "uydu"], ["u9", "uydu"], ["u12", "uydu"], ["u14", "uydu"], ["u16", "uydu"], ["u18", "uydu"],
  ["k1", "netlestirilmis", 2], ["k3", "netlestirilmis", 3], ["k2", "genisletilmis", 0], ["k7", "genisletilmis", 1],
  ["k2b", "canlandirma"], ["k4", "canlandirma"], ["k5", "canlandirma"], ["H", "canlandirma"], ["S", "canlandirma"],
  ["L", "canlandirma"], ["M", "canlandirma"], ["R", "canlandirma"], ["K", "canlandirma"],
];
// Zincir: her karenin portalı [x, y, g] bir sonraki karenin bu karede kapladığı bölge (data/dalislar/bursa-ulucami.json).
const ZINCIR = [
  ["u6", [0.4375, 0.4375, 0.125], "Uzaydan iniş"], ["u9", [0.4375, 0.4375, 0.125], "Uzaydan iniş"], ["u12", [0.375, 0.375, 0.25], "Bursa"],
  ["u14", [0.375, 0.375, 0.25], "Bursa"], ["u16", [0.375, 0.375, 0.25], "Şehrin ortası"], ["u18", [0.3, 0.3, 0.4], "Ulucami'nin üstünde"],
  ["k1", [0.262, 0.134, 0.4], "Bursa'nın ortasında"], ["k2", [0.29, 0.58, 0.42], "Kuzey cephesi"], ["k2b", [0.045, 0.1, 0.9], "Kubbelerin üstünde"],
  ["k3", [0.345, 0.238, 0.32], "Çatıdan bakış"], ["k4", [0.3, 0.3, 0.4], "Camın üstünde"], ["k5", [0.25, 0.35, 0.5], "Işıkla birlikte içeri"],
  ["H", [0.25, 0.5, 0.5], "Caminin içinde"], ["S", null, "Şadırvan"],
];

function dalis(el, tl) {
  const masa = $(el, ".dalis-masa");
  const orj = $(el, ".masa-orijinal"), izgara = $(el, ".masa-izgara"), serit = $(el, ".serit");
  const sayac = $(el, ".dalis-sayac b"), sayacYazi = $(el, ".dalis-sayac span");
  const MW = masa.offsetWidth, MH = masa.offsetHeight;
  orj.innerHTML = ""; izgara.innerHTML = ""; serit.innerHTML = "";
  $$(el, ".klasor-ic").forEach((k) => (k.innerHTML = ""));
  $$(el, ".klasor-sayi").forEach((k) => (k.textContent = "0"));

  // a) Masaya 4 orijinal fotoğraf düşer
  const fotoYer = [[MW / 2 - 640, 40, -6], [MW / 2 - 310, 10, 3], [MW / 2 + 20, 50, -2], [MW / 2 + 350, 20, 5]];
  const fotolar = ORIJINAL.map((src, i) => {
    const f = document.createElement("div");
    f.className = "foto-kart";
    f.innerHTML = `<img src="${src}" alt=""><span>Fotoğraf ${i + 1} · envanter</span>`;
    gsap.set(f, { x: fotoYer[i][0], y: fotoYer[i][1], rotate: fotoYer[i][2] });
    orj.append(f);
    return f;
  });
  const db = $$(el, ".db");
  gsap.set(db, { opacity: 0.18 });
  tl.to(db[0], { opacity: 1, duration: 0.4 }, 0.3)
    .from(fotolar, { y: -500, rotate: () => gsap.utils.random(-40, 40), opacity: 0, stagger: 0.15, duration: 0.8, ease: "bounce.out" }, 0.3)
    .from($(el, ".dalis-sayac"), { opacity: 0, x: 40, duration: 0.5 }, 0.8);

  // b) Yapay zekâ ışını geçer
  tl.to(db[1], { opacity: 1, duration: 0.4 }, 2)
    .fromTo($(el, ".ai-isin"), { x: -200, opacity: 0 }, { x: MW + 40, opacity: 1, duration: 1.6, ease: "power1.inOut" }, 2)
    .to($(el, ".ai-isin"), { opacity: 0, duration: 0.3 }, 3.5)
    .to(fotolar, { filter: "saturate(1.6) brightness(1.15)", stagger: 0.3, duration: 0.3, yoyo: true, repeat: 1 }, 2.2);

  // c) Kareler fotoğraflardan (uydu kareleri yukarıdan) fışkırır ve ızgaraya dizilir
  const sutun = 10, aw = 108, ah = 158;
  const solBas = (MW - sutun * aw) / 2;
  const kareler = KARELER.map(([ad, tur, kaynak], i) => {
    const k = document.createElement("div");
    k.className = "kare"; k.dataset.tur = tur; k.dataset.ad = ad;
    k.innerHTML = `<img src="${KOK}${ad}.jpg" alt="">`;
    izgara.append(k);
    const hx = solBas + (i % sutun) * aw, hy = 250 + Math.floor(i / sutun) * ah;
    const bas = kaynak != null ? { x: fotoYer[kaynak][0] + 100, y: fotoYer[kaynak][1] + 30 } : tur === "uydu" ? { x: hx, y: -400 } : { x: MW / 2 - 48, y: 60 };
    gsap.set(k, { x: bas.x, y: bas.y, scale: 0.2, opacity: 0 });
    tl.to(k, { x: hx, y: hy, scale: 1, opacity: 1, rotate: gsap.utils.random(-4, 4), duration: 0.8, ease: "back.out(1.4)" }, 3.6 + i * 0.07);
    return k;
  });
  tl.to(fotolar, { scale: 0.62, y: -30, duration: 0.8, ease: "power2.inOut" }, 3.5);
  tl.add(() => { sayacYazi.textContent = "kare"; say(gsap.timeline(), sayac, kareler.length, 0, 1.3); }, 3.7);

  // d) Kareler türlerine göre klasörlere uçar (Flip)
  tl.to(db[2], { opacity: 1, duration: 0.4 }, 5.6)
    .to(fotolar, { opacity: 0, y: -80, duration: 0.5 }, 5.6)
    .to($(el, ".klasorler"), { opacity: 1, duration: 0.5 }, 5.6)
    .from($$(el, ".klasor"), { y: 120, stagger: 0.1, duration: 0.6, ease: "back.out(1.5)" }, 5.6)
    .add(() => {
      const durum = window.Flip.getState(kareler);
      kareler.forEach((k) => { gsap.set(k, { clearProps: "transform" }); $(el, `.klasor[data-k="${k.dataset.tur}"] .klasor-ic`).append(k); });
      window.Flip.from(durum, { duration: 1.1, ease: "power3.inOut", stagger: 0.03, absolute: true, scale: true });
      $$(el, ".klasor").forEach((kl) => {
        const s = kl.querySelectorAll(".kare").length;
        say(gsap.timeline({ delay: 0.6 }), $(kl, ".klasor-sayi"), s, 0, 0.6);
      });
    }, 6.3);

  // e) Klasörlerden zincir sırasıyla film şeridine: her karede bir sonrakinin portalı pembe çerçeve
  tl.to(db[3], { opacity: 1, duration: 0.4 }, 8.4)
    .add(() => {
      const zincirKareleri = ZINCIR.map(([ad, p]) => {
        const k = kareler.find((x) => x.dataset.ad === ad);
        if (p) {
          const pr = document.createElement("span");
          pr.className = "portal";
          Object.assign(pr.style, { left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, width: `${p[2] * 100}%`, height: `${p[2] * 100}%` });
          k.append(pr);
        }
        return k;
      });
      const durum = window.Flip.getState(zincirKareleri);
      const genis = Math.min(110, (MW - 40) / zincirKareleri.length);
      zincirKareleri.forEach((k, i) => {
        serit.append(k);
        Object.assign(k.style, { position: "absolute", left: `${20 + i * genis}px`, top: "-100px", width: `${genis - 10}px`, height: `${(genis - 10) * 1.5}px` });
      });
      window.Flip.from(durum, { duration: 1.2, ease: "power3.inOut", stagger: 0.04, absolute: true });
      el._zincir = zincirKareleri;
      gsap.to($(el, ".klasorler"), { opacity: 0, y: 80, duration: 0.6, delay: 0.5 });
      gsap.to(zincirKareleri.map((k) => k.querySelector(".portal")).filter(Boolean), { opacity: 1, stagger: 0.08, duration: 0.3, delay: 1.3 });
      sayacYazi.textContent = "karelik zincir";
      say(gsap.timeline({ delay: 0.3 }), sayac, zincirKareleri.length, 0, 0.6);
    }, 8.4)
    .to(izgara, { opacity: 0, duration: 0.4 }, 10.6);

  // f) Şerit telefona akar, dalış oynar
  tl.add(() => {
    // Şerit telefonun soluna 3 sütunluk zincir olarak yerleşir; dalış sırasında o anki kare vurgulanır.
    const z = el._zincir ?? [];
    const durum = window.Flip.getState(z);
    const kw = 78, kh = 117, sutunSay = 3;
    const sag = MW / 2 - 200;
    z.forEach((k, i) => Object.assign(k.style, { left: `${sag - (sutunSay - (i % sutunSay)) * (kw + 12)}px`, top: `${-MH / 2 + 10 + Math.floor(i / sutunSay) * (kh + 9)}px`, width: `${kw}px`, height: `${kh}px` }));
    window.Flip.from(durum, { duration: 1, ease: "power3.inOut", stagger: 0.03 });
  }, 11.2)
    .to($(el, ".dalis-tel"), { opacity: 1, scale: 0.74, duration: 0.8, ease: "back.out(1.4)" }, 11.4)
    .to($(el, ".dalis-sayac"), { opacity: 0, duration: 0.4 }, 11.4)
    .to($(el, ".dalis-ozet"), { opacity: 1, duration: 0.3 }, 11.8)
    .from($$(el, ".dalis-ozet li"), { x: 60, opacity: 0, stagger: 0.2, duration: 0.5, ease: "back.out(1.6)" }, 11.8)
    .add(() => dalisOynat(el), 12);
}

// Dalış oynatıcı (public/app/dalis.js ile aynı ilke): kamera portala logaritmik yakınlaşır, sonraki kare portalda belirir.
function dalisOynat(el) {
  const pencere = $(el, ".dalis-pencere"), yazi = $(el, ".dalis-yazi"), cubuk = $(el, ".dalis-ilerleme i");
  const EW = pencere.offsetWidth, EH = pencere.offsetHeight;
  const H = EH, W = H / 1.5, sol = (EW - W) / 2; // kare 2:3, ekranın yüksekliğini kaplar
  const dongu = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
  const kur = (i) => {
    pencere.innerHTML = "";
    const dunya = document.createElement("div");
    dunya.className = "dalis-dunya";
    Object.assign(dunya.style, { width: `${W}px`, height: `${H}px`, left: `${sol}px` });
    const [ad, p] = ZINCIR[i];
    const a = new Image(); a.src = `${KOK}${ad}.jpg`; Object.assign(a.style, { left: 0, top: 0, width: `${W}px`, height: `${H}px` });
    dunya.append(a);
    let b = null;
    if (p && ZINCIR[i + 1]) {
      b = new Image(); b.src = `${KOK}${ZINCIR[i + 1][0]}.jpg`;
      Object.assign(b.style, { left: `${p[0] * W}px`, top: `${p[1] * H}px`, width: `${p[2] * W}px`, height: `${p[2] * H}px`, opacity: 0, borderRadius: "4px" });
      dunya.append(b);
    }
    pencere.append(dunya);
    return { dunya, b, p };
  };
  // Görüntüler önceden yüklensin
  ZINCIR.forEach(([ad]) => { new Image().src = `${KOK}${ad}.jpg`; });
  ZINCIR.forEach(([, p, baslik], i) => {
    dongu.add(() => { yazi.textContent = baslik; (el._zincir ?? []).forEach((k, j) => k.classList.toggle("simdi", j === i)); }, i * 1.25);
    dongu.fromTo(yazi, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, i * 1.25);
    if (!p || !ZINCIR[i + 1]) { dongu.add(() => kur(i), i * 1.25); return; }
    const o = { t: 0 };
    let sahne = null;
    dongu.add(() => { sahne = kur(i); }, i * 1.25);
    dongu.to(o, {
      t: 1, duration: 1.25, ease: "power1.inOut",
      onStart: () => { o.t = 0; },
      onUpdate: () => {
        if (!sahne) return;
        const [x, y, g] = sahne.p;
        const s = Math.pow(1 / g, o.t);
        const fx = (x * W) / (1 - g), fy = (y * H) / (1 - g); // sabit nokta
        sahne.dunya.style.transform = `translate(${fx - s * fx}px, ${fy - s * fy}px) scale(${s})`;
        sahne.b.style.opacity = Math.min(1, Math.max(0, (o.t - 0.25) / 0.55));
        cubuk.style.width = `${((i + o.t) / (ZINCIR.length - 1)) * 100}%`;
      },
    }, i * 1.25);
  });
  dongu.add(() => gsap.fromTo($(el, ".dalis-onay"), { opacity: 0, x: 60, scale: 0.8 }, { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: "back.out(2)" }), (ZINCIR.length - 1) * 1.25 + 0.2);
  dongu.to({}, { duration: 2.4 });
  dongu.add(() => gsap.to($(el, ".dalis-onay"), { opacity: 0, duration: 0.3 }));
}

// ── 10 · Kalfa ─────────────────────────────────────────────────────────────────────────────────
// Gerçek modülden (data/moduller/hanlarda-hazine-avi.js) satırlar.
const KOD = [
  ['<span class="a">import</span> { sahne, eserler, basarim, depo } <span class="a">from</span> <span class="s">"@lonca/sdk"</span>;', 0],
  ["", 0],
  ['<span class="y">// İpuçları yalnızca eser kaydından gelir.</span>', 0],
  ['<span class="a">const</span> TUR_SAYISI = <span class="n">5</span>;', 0],
  ['<span class="a">const</span> SURE_SANIYE = <span class="n">30</span>;', 0],
  ["", 0],
  ['<span class="a">export default async function</span> basla() {', 0],
  ['  <span class="a">const</span> hanlar = (<span class="a">await</span> eserler.liste({', 0],
  ['    il: <span class="s">"Bursa"</span>, tur: <span class="s">"han"</span> }))', 0],
  ['    .filter((e) =&gt; e.fotograflar.length);', 0],
  ['  <span class="a">await</span> basarim.tanimla(BASARIMLAR);', 0],
  ['  <span class="a">await</span> sahne.ayarla({ baslik: <span class="s">"Hanlarda Hazine Avı"</span>,', 0],
  ['    tema: { zemin: <span class="s">"parsomen"</span>, renk: <span class="s">"altin"</span> } });', 0],
  ['  <span class="a">await</span> sahne.ciz(arayuz());', 0],
  ["", 0],
  ['  <span class="a">for await</span> (<span class="a">const</span> olay <span class="a">of</span> sahne.olaylar()) {', 0],
  ['    <span class="a">if</span> (olay.id === <span class="s">"basla"</span>) avKur();', 0],
  ['    <span class="a">await</span> sahne.ciz(arayuz());', 0],
  ["  }", 0],
  ["}", 0],
];

function kalfa(el, tl) {
  const studio = $(el, ".studio");
  const imlec = $(el, ".imlec");
  const kod = $(el, ".kod code");
  kod.innerHTML = "";
  const usta = $(el, ".mesaj.usta .yaziyor");
  usta.textContent = "";
  const git = (oge, an, tikla) => {
    tl.add(() => {
      const p = konum(studio, oge);
      gsap.to(imlec, { x: p.x + oge.offsetWidth * 0.4, y: p.y + oge.offsetHeight * 0.5, opacity: 1, duration: 0.6, ease: "power2.inOut" });
    }, an - 0.7);
    if (tikla) tl.to(imlec, { scale: 0.7, duration: 0.1, yoyo: true, repeat: 1 }, an).add(tikla, an + 0.1);
  };
  gsap.set($$(el, ".mesaj.kalfa, .araclar, .izin-kart, .arac"), { opacity: 0, y: 14 });
  gsap.set($(el, ".imlec"), { x: 300, y: 600 });
  tl.from($$(el, ".st-panel"), { y: 80, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" }, 0.3);
  yaz(tl, usta, "Çocuklar için hanlarda süreli bir hazine avı yap.", 1.1, 0.03);
  tl.to($(el, ".mesaj.k1"), { opacity: 1, y: 0, duration: 0.4 }, 2.8)
    .to($(el, ".araclar"), { opacity: 1, y: 0, duration: 0.2 }, 3.1)
    .to($$(el, ".arac"), { opacity: 1, y: 0, stagger: 0.35, duration: 0.35, ease: "back.out(2)" }, 3.1)
    .to($(el, ".izin-kart"), { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.6)" }, 4.4);
  git($(el, ".d-birincil"), 5.6, () => $(el, ".d-birincil").classList.add("basildi"));
  // Kod satır satır yazılır
  KOD.forEach(([satir], i) => {
    tl.add(() => { const d = document.createElement("div"); d.innerHTML = satir || "&nbsp;"; kod.append(d); gsap.from(d, { opacity: 0, x: -10, duration: 0.2 }); }, 6 + i * 0.12);
  });
  $$(el, ".denetimler span").forEach((s, i) => tl.add(() => s.classList.add("tamam"), 8.6 + i * 0.3).from(s, { scale: 0.8, duration: 0.3, ease: "back.out(3)" }, 8.6 + i * 0.3));
  tl.to($(el, ".mesaj.k2"), { opacity: 1, y: 0, duration: 0.4 }, 9.4)
    .to($(el, ".st-tel .on2"), { opacity: 1, duration: 0.6 }, 10.6)
    .from($(el, ".st-tel"), { scale: 0.8, duration: 0.6, ease: "back.out(1.6)" }, 9.6);
  git($(el, ".gonder"), 11.6, () => $(el, ".gonder").style.background = "#1f7a5c");
  $$(el, ".oa-adim").forEach((a, i) => tl.to(a, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 12 + i * 0.7).from(a, { y: 20, duration: 0.4 }, 12 + i * 0.7));
  tl.to(imlec, { opacity: 0, duration: 0.3 }, 12.4);
}

// ── 11 · Erişilebilirlik: her anahtar açılınca telefondaki sayfa değişir ──────────────────────────
function erisim(el, tl) {
  const sayfa = $(el, ".er-sayfa"), ekran = $(el, ".er-tel .tel-ekran");
  const ayar = (a) => $(el, `.ayarlar [data-a="${a}"]`);
  tl.from($(el, ".er-tel"), { x: -100, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.2)
    .from($$(el, ".ayarlar li"), { x: 80, opacity: 0, stagger: 0.1, duration: 0.5 }, 0.5)
    .from($(el, ".er-not"), { opacity: 0, duration: 0.6 }, 1.4);
  const ac = (a, an, isle) => tl.add(() => ayar(a).classList.add("acik"), an).to(ayar(a), { backgroundColor: "rgba(226,51,138,.25)", duration: 0.3, yoyo: true, repeat: 1 }, an).add(isle, an + 0.1);
  ac("yazi", 2, () => gsap.to(sayfa, { "--b": 1.35, duration: 1, ease: "power2.inOut" }));
  ac("font", 3.3, () => sayfa.classList.add("atkinson"));
  ac("kontrast", 4.4, () => ekran.classList.add("kontrast"));
  ac("odak", 5.5, () => {
    const d = $$(el, ".er-d");
    const t = gsap.timeline({ repeat: 2 });
    d.forEach((x, i) => t.add(() => { d.forEach((y) => y.classList.remove("odak")); x.classList.add("odak"); }, i * 0.45));
    t.add(() => d.forEach((y) => y.classList.remove("odak")), d.length * 0.45);
  });
  ac("ses", 7.4, () => {
    gsap.to($(el, ".ses-dalga"), { opacity: 1, duration: 0.3 });
    gsap.to($$(el, ".ses-dalga i"), { height: () => `${gsap.utils.random(20, 100)}%`, duration: 0.18, repeat: -1, repeatRefresh: true, yoyo: true, stagger: 0.03 });
    const k = $$(el, ".er-metin span");
    const t = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    k.forEach((x, i) => t.add(() => { k.forEach((y) => y.classList.remove("okunan")); x.classList.add("okunan"); }, i * 0.32));
  });
  ac("okuyucu", 9.4, () => {
    $(el, ".er-d").classList.add("odak");
    gsap.fromTo($(el, ".okuyucu"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
  });
}

// ── 12 · Mimari: kutular kurulur, çizgiler çizilir, veri paketleri akar ─────────────────────────
function mimari(el, tl) {
  const cizgiler = $$(el, ".mc");
  const kutular = $$(el, ".mk");
  tl.from(kutular, { scale: 0.5, opacity: 0, stagger: 0.12, duration: 0.6, ease: "back.out(1.8)" }, 0.4)
    .from(cizgiler, { drawSVG: "0%", stagger: 0.1, duration: 0.7, ease: "power2.inOut" }, 1.2)
    .from($$(el, ".mk-alt span"), { y: 10, opacity: 0, stagger: 0.07, duration: 0.3 }, 1.6);
  const noktalar = $$(el, ".mim-akis i");
  const svg = $(el, ".mim-cizgiler");
  // Paketler SVG koordinatında akar: SVG içine daire olarak kopyala.
  noktalar.forEach((_, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", 8); c.setAttribute("fill", i % 2 ? "#3fd497" : "#e2338a");
    c.style.filter = "drop-shadow(0 0 8px currentColor)";
    svg.append(c);
    const yol = cizgiler[i % cizgiler.length];
    gsap.set(c, { opacity: 0 });
    gsap.timeline({ repeat: -1, delay: 2.2 + i * 0.35, repeatDelay: 0.4 })
      .set(c, { opacity: 1 })
      .to(c, { motionPath: { path: yol, align: yol, alignOrigin: [0.5, 0.5] }, duration: 1.6, ease: "power1.inOut" })
      .to(c, { opacity: 0, duration: 0.2 });
  });
}

// ── 13 · Ölçek: Three.js harita, il sütunları yükselir, İzmir ve Manisa beliriyor ──────────────────
function olcek(el, tl, { uc }) {
  const satirlar = $$(el, ".il-satir");
  const enCok = 263;
  tl.from(satirlar, { x: 60, opacity: 0, stagger: 0.12, duration: 0.5 }, 0.4);
  satirlar.forEach((s, i) => {
    const n = Number($(s, "em").textContent) || 0;
    tl.to($(s, ".il-bar i"), { width: `${(n / enCok) * 100}%`, duration: 1, ease: "power3.out" }, 0.8 + i * 0.15);
  });
  tl.from($$(el, ".boru span"), { x: -30, opacity: 0, stagger: 0.15, duration: 0.4 }, 2.4)
    .from($(el, ".olcek-not"), { opacity: 0, duration: 0.5 }, 3);
  tl.add(() => uc.olcekOyna?.(), 0.2);
  gsap.to($$(el, ".il-satir.hayalet .il-bar"), { borderColor: "rgba(63,212,151,.9)", duration: 0.8, yoyo: true, repeat: -1, delay: 3 });
}

// ── 14 · Güvenlik ──────────────────────────────────────────────────────────────────────────────
function guven(el, tl) {
  tl.from($(el, ".kum-kalkan"), { scale: 0.6, opacity: 0, duration: 0.8, ease: "back.out(1.6)" }, 0.3)
    .from($(el, ".kum-modul"), { scale: 0, duration: 0.5, ease: "back.out(2)" }, 0.6)
    .from($(el, ".kum-alt"), { opacity: 0, duration: 0.4 }, 1.2)
    .from($$(el, ".kontrol li"), { x: 60, opacity: 0, stagger: 0.15, duration: 0.5 }, 0.8);
  say(tl, $(el, ".sayac-test"), 150, 1.2, 1.4);
  // Engellenen erişimler kalkana çarpıp geri seker; SDK içeri girer.
  const kalkan = $(el, ".kum-kalkan");
  const dongu = gsap.timeline({ repeat: -1, delay: 1.4, repeatDelay: 0.4 });
  [[".s1", 80, 50], [".s2", -70, 40], [".s3", 90, -60]].forEach(([s, dx, dy], i) => {
    dongu.fromTo($(el, `.saldiri${s}`), { x: 0, y: 0, opacity: 1 }, { x: dx, y: dy, duration: 0.45, ease: "power2.in" }, i * 0.7)
      .to(kalkan, { boxShadow: "0 0 90px rgba(255,93,108,.6)", borderColor: "#ff5d6c", duration: 0.1, yoyo: true, repeat: 1 }, i * 0.7 + 0.45)
      .to($(el, `.saldiri${s}`), { x: 0, y: 0, duration: 0.6, ease: "back.out(2)" }, i * 0.7 + 0.5);
  });
  dongu.fromTo($(el, ".izinli"), { x: 0, y: 0 }, { x: -170, y: -110, duration: 0.8, ease: "power2.inOut" }, 2.2)
    .to($(el, ".kum-modul"), { backgroundColor: "#1f7a5c", duration: 0.2, yoyo: true, repeat: 1 }, 3)
    .to($(el, ".izinli"), { x: 0, y: 0, duration: 0.6 }, 3.4);
}

// ── 16 · Gelecek: ışık ufuk çizgisinde ilerler; geçtiği her ufukta o dönemin özellikleri canlanır ─
function gelecek(el, tl) {
  const kartlar = $$(el, ".fk");
  const etiketler = $$(el, ".ufuk-etiket");
  const sure = 4.8;
  tl.to($(el, ".ufuk-cizgi i"), { width: "100%", duration: sure, ease: "none" }, 0.6)
    .fromTo($(el, ".ufuk-isik"), { left: "0%" }, { left: "100%", duration: sure, ease: "none" }, 0.6);
  // Etiketler ışık üstlerinden geçerken belirir (konumları: 0, 16.7, 50, 83.3 %)
  [0, 0.167, 0.5, 0.833].forEach((oran, i) => tl.from(etiketler[i], { y: 16, opacity: 0, duration: 0.4, ease: "back.out(2)" }, 0.6 + oran * sure));
  // Her sütun (yakın, orta, uzak) kendi ufkunda açılır
  [0.167, 0.5, 0.833].forEach((oran, s) => {
    tl.from(kartlar.slice(s * 2, s * 2 + 2), { y: 90, rotateX: -35, opacity: 0, transformOrigin: "50% 0%", stagger: 0.2, duration: 0.8, ease: "power3.out" }, 0.3 + oran * sure);
  });
  tl.from($$(el, ".hedef-serit span"), { y: 30, opacity: 0, stagger: 0.15, duration: 0.5, ease: "back.out(1.8)" }, 0.8 + sure);

  // Sahada keşif: pin düşer, halka nabız atar, bildirim gelir
  const saha = $(el, ".f-saha");
  tl.from($(saha, ".pin"), { y: -70, opacity: 0, duration: 0.7, ease: "bounce.out" }, 1.6)
    .from($(saha, ".bildirim"), { x: 80, opacity: 0, duration: 0.5, ease: "back.out(2)" }, 2.1);
  gsap.fromTo($(saha, ".halka"), { scale: 0.4, opacity: 1 }, { scale: 1.8, opacity: 0, duration: 1.4, repeat: -1, ease: "power1.out", delay: 2 });
  // Sesli rehber: ses dalgası oynar, diller sırayla yanar
  const ses = $(el, ".f-ses");
  gsap.to($$(ses, ".dalga i"), { scaleY: () => gsap.utils.random(0.15, 1), duration: 0.28, ease: "sine.inOut", repeat: -1, repeatRefresh: true, stagger: 0.04, delay: 1.8 });
  tl.from($$(ses, ".dil"), { scale: 0, stagger: 0.15, duration: 0.4, ease: "back.out(2.5)" }, 2.1);
  const dilDongu = gsap.timeline({ repeat: -1, delay: 2.8 });
  $$(ses, ".dil").forEach((d, i) => dilDongu.to(d, { backgroundColor: "#e6c477", color: "#2a1d05", duration: 0.25, yoyo: true, repeat: 1, repeatDelay: 0.6 }, i * 1.1));
  // Okul modu: öğretmenden öğrencilere modül gider, ilerleme çubukları dolar
  const okul = $(el, ".f-okul");
  tl.from($(okul, ".ogretmen"), { scale: 0, duration: 0.5, ease: "back.out(2)" }, 3)
    .from($$(okul, ".ogrenci"), { scale: 0, stagger: 0.12, duration: 0.4, ease: "back.out(2.5)" }, 3.2);
  gsap.timeline({ repeat: -1, repeatDelay: 0.8, delay: 3.8 })
    .fromTo($$(okul, ".ogrenci i"), { "--d": "0%" }, { "--d": "100%", stagger: 0.35, duration: 1.4, ease: "power1.inOut" })
    .to($$(okul, ".ogrenci"), { backgroundColor: "#3fd497", stagger: 0.35, duration: 0.3 }, 1.2)
    .to($$(okul, ".ogrenci"), { backgroundColor: "#8fb4ff", duration: 0.3 }, 3.2);
  // Topluluk: fotoğraf editöre gider, onaylanır
  const top = $(el, ".f-topluluk");
  tl.from($(top, ".foto"), { scale: 0, rotate: -20, duration: 0.5, ease: "back.out(2)" }, 3.2)
    .from($(top, ".editor"), { opacity: 0, x: 40, duration: 0.5 }, 3.5);
  gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 4 })
    .fromTo($(top, ".foto"), { x: 0, scale: 1, opacity: 1 }, { x: 250, scale: 0.5, opacity: 0, duration: 1.2, ease: "power2.in" })
    .to($(top, ".editor"), { scale: 1.15, backgroundColor: "rgba(63,212,151,.45)", duration: 0.2, yoyo: true, repeat: 1 })
    .set($(top, ".foto"), { x: 0, scale: 1, opacity: 1 }, "+=0.4");
  // AR: vizör açılır, tarama çizgisi gezer, eski hali üstüne gelir
  const ar = $(el, ".f-ar");
  tl.from($$(ar, ".vizor i"), { scale: 2, opacity: 0, stagger: 0.08, duration: 0.5 }, 4.4)
    .from($(ar, ".kubbe"), { y: 40, opacity: 0, duration: 0.6 }, 4.4);
  gsap.fromTo($(ar, ".tara"), { y: 0 }, { y: 112, duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 4.8 });
  gsap.fromTo($(ar, ".eski-cizim"), { opacity: 0 }, { opacity: 1, duration: 1, yoyo: true, repeat: -1, repeatDelay: 0.8, delay: 5.2 });
  // 3B: küp döner, API çağrısı çıkar
  const ucb = $(el, ".f-3b");
  gsap.to($(ucb, ".kup"), { rotationY: 360, rotationX: 360, duration: 7, repeat: -1, ease: "none" });
  tl.from($(ucb, ".kup"), { scale: 0, duration: 0.6, ease: "back.out(2)" }, 4.6)
    .from($(ucb, ".api"), { x: 60, opacity: 0, duration: 0.5 }, 4.9);
}

// ── 16 · Akademik kullanım: eser kaydından dört yola veri akar, her satır kendi işini gösterir ─
function akademik(el, tl) {
  const yollar = $$(el, ".ak-yollar path");
  const noktalar = $$(el, ".ak-nokta");
  const satirlar = $$(el, ".ak-satir");
  tl.from($(el, ".ak-kayit"), { x: -80, rotate: -4, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.4)
    .from($$(el, ".ak-kayit dt, .ak-kayit dd"), { x: -20, opacity: 0, stagger: 0.06, duration: 0.35 }, 0.9)
    .from(yollar, { drawSVG: 0, stagger: 0.15, duration: 0.6, ease: "power1.inOut" }, 1.3)
    .from(satirlar, { x: 80, opacity: 0, stagger: 0.25, duration: 0.6, ease: "power3.out" }, 1.5);
  // Altın noktalar kayıttan her satıra sürekli veri taşır
  noktalar.forEach((n, i) => {
    gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 2.4 + i * 0.35 })
      .set(n, { opacity: 1, scale: 1 })
      .to(n, { duration: 1, ease: "power1.inOut", motionPath: { path: yollar[i], align: yollar[i], alignOrigin: [0.5, 0.5] } })
      .to(n, { opacity: 0, scale: 2, duration: 0.3 })
      .to(satirlar[i], { borderColor: "rgba(230,196,119,.8)", duration: 0.2, yoyo: true, repeat: 1 }, "<");
  });
  // Atıf: metin yazılır gibi belirir
  const atif = new window.SplitText($(el, ".atif-metin"), { type: "words,chars" });
  tl.from(atif.chars, { opacity: 0, stagger: 0.025, duration: 0.01 }, 2);
  // API: istek gider, yanıt gelir (döngü)
  gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 2.4 })
    .fromTo($(el, ".istek"), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 })
    .fromTo($(el, ".yanit"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.5)" }, "+=0.5")
    .to($$(el, ".istek, .yanit"), { opacity: 0, duration: 0.3 }, "+=1.6");
  // Ders: öğrenci ilerlemeleri dolar
  gsap.timeline({ repeat: -1, repeatDelay: 0.8, delay: 2.8 })
    .fromTo($$(el, ".ders-cubuk i"), { "--d": "0%" }, { "--d": (i) => ["100%", "75%", "90%"][i], stagger: 0.3, duration: 1.4, ease: "power1.inOut" })
    .to($$(el, ".ders-cubuk i"), { backgroundColor: "#3fd497", duration: 0.3 }, ">-0.2")
    .to($$(el, ".ders-cubuk i"), { backgroundColor: "#8fb4ff", duration: 0.3 }, "+=1.2");
  // Analiz: sütunlar yükselir, sonra canlı veri gibi dalgalanır
  const sutun = $$(el, ".sutunlar i");
  tl.from(sutun, { scaleY: 0, stagger: 0.08, duration: 0.6, ease: "back.out(1.6)" }, 2.6);
  gsap.to(sutun, { scaleY: () => gsap.utils.random(0.25, 1), duration: 0.9, ease: "sine.inOut", repeat: -1, repeatRefresh: true, stagger: 0.08, delay: 3.6 });
  tl.from($$(el, ".ak-serit span"), { y: 30, opacity: 0, stagger: 0.15, duration: 0.5, ease: "back.out(1.8)" }, 3.2);
}

// ── 18 · Kapanış: ekip önde, "Teşekkürler" arkada; fare hareketiyle hafif derinlik ───────────────
function kapanis(el, tl) {
  const dev = $(el, ".kapanis-dev");
  const uyeler = $$(el, ".uye");
  const b = new window.SplitText(dev, { type: "chars" });
  tl.from($(el, ".kapak-perde"), { opacity: 0, duration: 1 }, 0)
    .from(b.chars, { yPercent: 60, opacity: 0, stagger: 0.05, duration: 1.2, ease: "power3.out" }, 0.2)
    .from(uyeler, { y: 160, opacity: 0, rotateX: -30, transformOrigin: "50% 100%", stagger: 0.2, duration: 1, ease: "power4.out" }, 0.6)
    .from($$(el, ".uye-foto img"), { scale: 0.4, opacity: 0, stagger: 0.2, duration: 0.8, ease: "back.out(1.6)" }, 0.8)
    .from($$(el, ".uye-halka"), { rotate: -270, opacity: 0, stagger: 0.2, duration: 1.4, ease: "power3.out" }, 0.9)
    .from($$(el, ".uye-rol"), { scale: 0, opacity: 0, stagger: 0.2, duration: 0.6, ease: "back.out(2.4)" }, 1.6)
    .from($(el, ".kapanis-kunye"), { x: -40, opacity: 0, duration: 0.7 }, 2.2)
    .from($(el, ".qr-kutu"), { x: 80, opacity: 0, rotateY: -50, transformPerspective: 1000, duration: 0.9, ease: "power3.out" }, 2.3);
  gsap.to($$(el, ".uye-halka"), { rotate: 360, duration: 8, ease: "none", repeat: -1, delay: 2.4 });
  gsap.to(dev, { scale: 1.04, duration: 6, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.5 });
  // Fare: kartlar fareye, arkadaki yazı ters yöne kayar (sunumda canlı his)
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.onpointermove = null; return; }
  const kartX = uyeler.map((u) => gsap.quickTo(u, "x", { duration: 0.8, ease: "power3.out" }));
  const kartD = uyeler.map((u) => gsap.quickTo(u, "rotationY", { duration: 0.8, ease: "power3.out" }));
  const devX = gsap.quickTo(dev, "x", { duration: 1.2, ease: "power3.out" });
  el.onpointermove = (e) => {
    if (!el.classList.contains("etkin")) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    uyeler.forEach((_, i) => { kartX[i](nx * (24 + i * 6)); kartD[i](nx * 10); });
    devX(-nx * 80);
  };
}

export const SAHNELER = [kapak, problem, deger, cozum, vizyon, veri, ux, moduller, dalis, kalfa, erisim, mimari, olcek, guven, gelecek, akademik, kapanis];
