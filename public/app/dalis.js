// Dalış: kaydırdıkça bir eserin "içine girilen" sahne motoru.
//
// Kareler bir zincir oluşturur. Bir karenin `portal`ı [x, y, g] (0–1, karenin en/boyuna göre; g hem en hem boy
// oranı, kareler aynı en-boy oranındadır) bir SONRAKİ karenin o karede kapladığı bölgedir: geçişte kamera portala
// logaritmik yakınlaşır, sonraki kare portalın içinde kenarları yumuşatılarak belirir ve sonunda ekranı kaplar.
// `cikis` ise tersidir: BU karenin bir sonraki karede kapladığı bölge; kamera geri çekilir (ör. levhadan duvara).
//
// Her kare bir duraktır: önce başlık; sonra "bakışlar". Bir bakışta kamera karenin bir bölgesine (alan) kayar,
// isteğe bağlı bir noktaya (nokta) ok ve atan bir halka çıkar, yanında bilgi kartı belirir; kaydırmaya devam
// edilince kart silinir ve sıradaki bakışa geçilir. Hareketi azalt açıksa canvas kurulmaz; her şey alt alta gösterilir.
import { hareketAzalt } from "/ortak/animasyon.js";

const GORSEL_YOLU = /^\/medya\/[a-z0-9\-_/]+\.(?:jpe?g|png|webp)$/i;
const BIRIM_VH = 80;                              // bir "birim" kaydırma mesafesi (ekran yüksekliğinin yüzdesi)
const GIRIS = 0.6, HAREKET = 0.5, OKU = 0.85, DONUS = 0.4, GECIS = 1.35, SON = 0.4; // aşama uzunlukları (birim)
const MAKS_KARE = 40, MAKS_BAKIS = 6;
const TAM = [0, 0, 1];

export const ETIKETLER = {
  gercek: "Gerçek fotoğraf",
  genisletilmis: "Gerçek fotoğraf · kenarları YZ",
  netlestirilmis: "Gerçek fotoğraf · YZ ile netleştirildi",
  "yeniden-cizim": "Gerçek fotoğraftan · YZ ile yeniden çizildi",
  canlandirma: "Yapay zekâ canlandırması",
  uydu: "Uydu görüntüsü · Esri, Maxar",
};

const kenet = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const yumusak = (a, b, x) => { const t = kenet((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const yazi = (x, n) => (x == null ? "" : String(x).slice(0, n));

function dortgen(p, varsayilan = null) {
  const d = Array.isArray(p) ? p.map(Number) : null;
  if (!d || d.length < 3 || !d.every(Number.isFinite) || !(d[2] > 0.02 && d[2] <= 1)) return varsayilan;
  return [kenet(d[0], 0, 1 - d[2]), kenet(d[1], 0, 1 - d[2]), d[2]];
}
function nokta(p) {
  const d = Array.isArray(p) ? p.map(Number) : null;
  return d && d.length >= 2 && d.every(Number.isFinite) ? [kenet(d[0]), kenet(d[1])] : null;
}

export function dalisKareleri(ham) {
  return (Array.isArray(ham) ? ham : []).slice(0, MAKS_KARE).map((k) => {
    const gorsel = String(k?.gorsel ?? "");
    if (!GORSEL_YOLU.test(gorsel) || gorsel.includes("..")) return null;
    const etiket = Object.hasOwn(ETIKETLER, k?.etiket) ? k.etiket : k?.canlandirma ? "canlandirma" : "gercek";
    const hamBakislar = [...(Array.isArray(k?.bakislar) ? k.bakislar : []), ...(Array.isArray(k?.notlar) ? k.notlar : [])];
    const bakislar = hamBakislar.slice(0, MAKS_BAKIS).map((b) => {
      const n = nokta(b?.nokta);
      // Nokta verilip alan verilmezse kamera noktaya doğru hafifçe yaklaşır.
      const alan = dortgen(b?.alan) ?? (n ? dortgen([n[0] - 0.36, n[1] - 0.36, 0.72]) : null);
      return { alan, nokta: n, ust: yazi(b?.ust, 40), baslik: yazi(b?.baslik, 80), metin: yazi(b?.metin, 360), kaynak: yazi(b?.kaynak, 80) };
    }).filter((b) => b.baslik || b.metin);
    return {
      gorsel, etiket, bakislar,
      portal: dortgen(k?.portal, [0.3, 0.3, 0.4]), cikis: dortgen(k?.cikis),
      baslik: yazi(k?.baslik, 80), metin: yazi(k?.metin, 360), yazi: k?.yazi === "ust" ? "ust" : "alt",
    };
  }).filter(Boolean);
}

// Kaydırma ekseni boyunca aşamalar: { bas, son, tur, kare, A, B, bakis }
function zamanCizelgesi(kareler) {
  const asamalar = [], duraklar = [];
  let s = 0;
  const ekle = (a) => { asamalar.push({ ...a, bas: s, son: s + a.uzunluk }); s += a.uzunluk; };
  kareler.forEach((k, i) => {
    duraklar.push(s);
    let su = TAM;
    ekle({ tur: "oku", kare: i, A: su, B: su, bakis: (k.baslik || k.metin) ? { baslik: k.baslik, metin: k.metin, buyuk: true } : null, uzunluk: GIRIS });
    for (const b of k.bakislar) {
      const hedef = b.alan ?? su;
      if (hedef !== su) ekle({ tur: "hareket", kare: i, A: su, B: hedef, uzunluk: HAREKET });
      ekle({ tur: "oku", kare: i, A: hedef, B: hedef, bakis: b, uzunluk: OKU });
      su = hedef;
    }
    if (i === kareler.length - 1) {
      if (su !== TAM) ekle({ tur: "hareket", kare: i, A: su, B: TAM, uzunluk: DONUS });
      ekle({ tur: "oku", kare: i, A: TAM, B: TAM, bakis: null, uzunluk: SON });
      return;
    }
    if (k.cikis) {
      if (su !== TAM) ekle({ tur: "hareket", kare: i, A: su, B: TAM, uzunluk: DONUS });
      ekle({ tur: "dis", kare: i, uzunluk: GECIS });
    } else ekle({ tur: "ic", kare: i, A: su, uzunluk: GECIS });
  });
  return { asamalar, duraklar, toplam: s };
}

// İki kamera dikdörtgeni arasında "uçuş": boyut logaritmik, konum hedefe yaklaşma oranıyla.
function ara(A, B, e) {
  const g = Math.pow(A[2], 1 - e) * Math.pow(B[2], e);
  const k = Math.abs(A[2] - B[2]) > 1e-4 ? (A[2] - g) / (A[2] - B[2]) : e;
  return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, g];
}

export function dalisKur(kutu, { kareler, etiket, el }) {
  if (hareketAzalt()) return duzKur(kutu, { kareler, etiket, el });

  const N = kareler.length;
  const { asamalar, duraklar, toplam } = zamanCizelgesi(kareler);
  const NS = "http://www.w3.org/2000/svg";
  const iz = el("div", { className: "s-dalis-iz" });
  iz.style.height = `calc(${toplam * BIRIM_VH}vh + 100dvh)`;
  const tuval = el("canvas", { className: "s-dalis-tuval", role: "img", ariaLabel: etiket });
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "s-dalis-isaret");
  svg.setAttribute("aria-hidden", "true");
  const cizgi = document.createElementNS(NS, "line");
  const halka = document.createElementNS(NS, "circle");
  const nok = document.createElementNS(NS, "circle");
  halka.setAttribute("r", "16"); halka.setAttribute("class", "halka");
  nok.setAttribute("r", "5.5"); nok.setAttribute("class", "nokta");
  svg.append(cizgi, halka, nok);
  const kart = el("div", { className: "s-dalis-kart", ariaLive: "polite" });
  const rozet = el("span", { className: "s-dalis-rozet" });
  const durakYazisi = el("span", { className: "s-dalis-durak" });
  const cubuk = el("div", { className: "s-dalis-cubuk", ariaHidden: "true" }, el("span", {}));
  const ipucu = el("div", { className: "s-dalis-ipucu", ariaHidden: "true", textContent: "Kaydır" });
  const noktalar = el("nav", { className: "s-dalis-noktalar", ariaLabel: "Duraklar" },
    ...kareler.map((k, i) => {
      const d = el("button", { className: "s-dalis-nokta", ariaLabel: `${i + 1}. durak${k.baslik ? `: ${k.baslik}` : ""}` });
      d.addEventListener("click", () => git(duraklar[i] + 0.3));
      return d;
    }));
  const sahne = el("div", { className: "s-dalis-sahne" }, tuval, svg, cubuk,
    el("div", { className: "s-dalis-ustler" }, rozet, durakYazisi), kart, ipucu, noktalar);
  iz.append(sahne);
  kutu.append(iz);

  const ctx = tuval.getContext("2d");
  const ara2 = document.createElement("canvas");
  const actx = ara2.getContext("2d");
  const resimler = kareler.map((k, i) => {
    const r = new Image();
    r.decoding = "async";
    if (i < 3) r.fetchPriority = "high";
    r.src = k.gorsel;
    r.onload = () => { cizilecek = true; };
    return r;
  });

  let hedef = 0, simdiki = 0, cizilecek = true, oncekiBakis, oncekiKare = -1, calisiyor = true, cw = 0, ch = 0, dpr = 1;

  function boyutla() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = sahne.getBoundingClientRect();
    cw = Math.max(1, Math.round(r.width * dpr)); ch = Math.max(1, Math.round(r.height * dpr));
    if (tuval.width !== cw || tuval.height !== ch) { tuval.width = ara2.width = cw; tuval.height = ara2.height = ch; }
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    ctx.imageSmoothingQuality = actx.imageSmoothingQuality = "high";
    cizilecek = true;
  }

  function konum() {
    const r = iz.getBoundingClientRect();
    const yol = r.height - innerHeight;
    return yol > 0 ? kenet(-r.top / yol) * toplam : 0;
  }

  function git(s) {
    const r = iz.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + ((r.height - innerHeight) * s) / toplam, behavior: "smooth" });
  }

  // Görüntünün normalleştirilmiş bölgesini (x, y, g) tuvale "cover" olarak yerleştiren dönüşüm.
  function donusum(resim, [x, y, g]) {
    const W = resim.naturalWidth, H = resim.naturalHeight;
    let sw = g * W, sh = g * H, sx = x * W, sy = y * H;
    const A = cw / ch;
    if (sw / sh > A) { const yeni = sh * A; sx += (sw - yeni) / 2; sw = yeni; }
    else { const yeni = sw / A; sy += (sh - yeni) / 2; sh = yeni; }
    return { sx, sy, sw, sh, olcek: cw / sw, W, H };
  }
  const hazir = (r) => r?.complete && r.naturalWidth;
  const resimCiz = (r, d) => ctx.drawImage(r, d.sx, d.sy, d.sw, d.sh, 0, 0, cw, ch);

  // İç resmi, dış resmin d dönüşümünde [x,y,g] bölgesine, kenarları yumuşatılmış ve alfa ile çizer.
  function icCiz(ic, d, [px, py, pg], alfa, tuyOran) {
    const rx = (px * d.W - d.sx) * d.olcek, ry = (py * d.H - d.sy) * d.olcek;
    const rw = pg * d.W * d.olcek, rh = pg * d.H * d.olcek;
    const tuy = Math.min(rw, rh) * tuyOran;
    actx.globalCompositeOperation = "source-over";
    actx.clearRect(0, 0, cw, ch);
    actx.drawImage(ic, rx, ry, rw, rh);
    if (tuy > 0.5) {
      actx.globalCompositeOperation = "destination-in";
      for (const [bas, uz, yatay] of [[rx, rw, true], [ry, rh, false]]) {
        const gr = yatay ? actx.createLinearGradient(bas, 0, bas + uz, 0) : actx.createLinearGradient(0, bas, 0, bas + uz);
        const f = kenet(tuy / uz, 0, 0.49);
        gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(f, "#000"); gr.addColorStop(1 - f, "#000"); gr.addColorStop(1, "rgba(0,0,0,0)");
        actx.fillStyle = gr; actx.fillRect(0, 0, cw, ch);
      }
    }
    ctx.globalAlpha = alfa;
    ctx.drawImage(ara2, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Bir aşamayı çizer; bakış noktasını ekrana taşımak için o anki dönüşümü döndürür.
  function ciz(a, s) {
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, cw, ch);
    const u = kenet((s - a.bas) / (a.son - a.bas));
    const e = yumusak(0, 1, u);
    const i = a.kare, r = resimler[i], sonraki = resimler[i + 1];
    if (a.tur === "dis") {
      // Geri çekilme: kamera sonraki karenin içinde, bu karenin bölgesinden tam görünüme açılır.
      const Q = kareler[i].cikis;
      if (!hazir(sonraki)) { if (hazir(r)) resimCiz(r, donusum(r, TAM)); return { d: null, kare: i }; }
      const d = donusum(sonraki, ara(Q, TAM, e));
      resimCiz(sonraki, d);
      if (hazir(r) && u < 0.999) icCiz(r, d, Q, 1 - yumusak(0.15, 0.75, u), 0.22 * yumusak(0, 0.45, u));
      return { d: null, kare: u > 0.5 ? i + 1 : i };
    }
    if (!hazir(r)) return { d: null, kare: i };
    const R = a.tur === "ic" ? ara(a.A, kareler[i].portal, e) : ara(a.A, a.B, a.tur === "hareket" ? e : 0);
    const d = donusum(r, R);
    resimCiz(r, d);
    if (a.tur === "ic" && hazir(sonraki) && u > 0.1) {
      icCiz(sonraki, d, kareler[i].portal, yumusak(0.25, 0.85, u), 0.22 * (1 - yumusak(0.55, 1, u)));
    }
    return { d, kare: a.tur === "ic" && u > 0.5 ? i + 1 : i };
  }

  function kartGuncelle(a, s, sonuc) {
    const u = kenet((s - a.bas) / (a.son - a.bas));
    const b = a.tur === "oku" ? a.bakis : null;
    const kenar = 0.16;
    const gorunur = b ? Math.min(yumusak(0, kenar, u), 1 - yumusak(1 - kenar, 1, u)) : 0;
    if (b !== oncekiBakis) {
      oncekiBakis = b;
      if (b) {
        const k = kareler[a.kare];
        kart.className = `s-dalis-kart${b.buyuk ? " buyuk" : ""}`;
        kart.replaceChildren(...[
          b.ust ? el("span", { className: "s-dalis-ust", textContent: b.ust }) : null,
          b.baslik ? el("strong", { textContent: b.baslik }) : null,
          b.metin ? el("p", { textContent: b.metin }) : null,
          b.kaynak ? el("span", { className: "s-dalis-kaynak", textContent: `Kaynak · ${b.kaynak}` }) : null].filter(Boolean));
        // Kart, işaret noktasının karşı yarısına yerleşir; noktasız kartlar karenin tercihine uyar.
        const alan = b.alan ?? TAM;
        const ust = b.nokta ? b.nokta[1] > alan[1] + alan[2] / 2 : k.yazi === "ust";
        kart.classList.toggle("ust", ust);
      }
    }
    kart.style.opacity = String(gorunur);
    kart.style.transform = `translateY(${(1 - gorunur) * (kart.classList.contains("ust") ? -12 : 12)}px)`;

    // Ok: kartın kenarından işaret noktasına doğru çizilir.
    const d = sonuc?.d;
    if (b?.nokta && d && gorunur > 0.01) {
      const x = ((b.nokta[0] * d.W - d.sx) * d.olcek) / dpr, y = ((b.nokta[1] * d.H - d.sy) * d.olcek) / dpr;
      const sk = sahne.getBoundingClientRect(), kk = kart.getBoundingClientRect();
      const ust = kart.classList.contains("ust");
      const kx = kenet(x, kk.left - sk.left + 22, kk.right - sk.left - 22);
      const ky = ust ? kk.bottom - sk.top : kk.top - sk.top;
      const cizim = yumusak(0.04, 0.3, u);
      cizgi.setAttribute("x1", kx); cizgi.setAttribute("y1", ky);
      cizgi.setAttribute("x2", kx + (x - kx) * cizim); cizgi.setAttribute("y2", ky + (y - ky) * cizim);
      for (const c of [halka, nok]) { c.setAttribute("cx", x); c.setAttribute("cy", y); }
      nok.style.opacity = halka.style.opacity = String(yumusak(0.2, 0.32, u));
      svg.style.opacity = String(gorunur);
    } else svg.style.opacity = "0";
  }

  function genelGuncelle(s, sonuc) {
    const gosterilen = sonuc?.kare ?? 0;
    if (gosterilen !== oncekiKare) {
      oncekiKare = gosterilen;
      const k = kareler[gosterilen];
      rozet.textContent = ETIKETLER[k.etiket];
      rozet.classList.toggle("canlandirma", k.etiket !== "gercek");
      durakYazisi.textContent = `${gosterilen + 1}/${N}${k.baslik ? ` · ${k.baslik}` : ""}`;
      noktalar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", j === gosterilen ? "step" : "false"));
      for (const r of resimler.slice(gosterilen, gosterilen + 3)) r.decode?.().catch(() => {});
    }
    ipucu.style.opacity = String(1 - kenet(s / 0.3));
    cubuk.firstChild.style.transform = `scaleX(${s / toplam})`;
  }

  function dongu() {
    if (!calisiyor) return;
    if (iz.isConnected) {
      hedef = konum();
      const fark = hedef - simdiki;
      if (Math.abs(fark) > 0.0008) { simdiki += fark * 0.14; cizilecek = true; }
      else if (simdiki !== hedef) { simdiki = hedef; cizilecek = true; }
      if (cizilecek) {
        cizilecek = false;
        const a = asamalar.find((x) => simdiki < x.son) ?? asamalar[asamalar.length - 1];
        const sonuc = ciz(a, simdiki);
        kartGuncelle(a, simdiki, sonuc);
        genelGuncelle(simdiki, sonuc);
      }
    }
    requestAnimationFrame(dongu);
  }

  const gozlem = new ResizeObserver(boyutla);
  gozlem.observe(sahne);
  boyutla();
  simdiki = hedef = konum();
  requestAnimationFrame(dongu);

  return Promise.resolve({ guncelle() {}, yokEt() { calisiyor = false; gozlem.disconnect(); } });
}

function duzKur(kutu, { kareler, etiket, el }) {
  kutu.classList.add("s-dalis-duz");
  kutu.append(el("ol", { className: "s-dalis-liste", ariaLabel: etiket },
    ...kareler.map((k, i) => el("li", {},
      el("figure", {},
        el("img", { src: k.gorsel, alt: `${i + 1}. durak${k.baslik ? `: ${k.baslik}` : ""}`, loading: i < 2 ? "eager" : "lazy", decoding: "async" }),
        el("figcaption", {},
          el("span", { className: `s-dalis-rozet${k.etiket !== "gercek" ? " canlandirma" : ""}`, textContent: ETIKETLER[k.etiket] }),
          k.baslik ? el("strong", { textContent: k.baslik }) : null,
          k.metin ? el("p", { textContent: k.metin }) : null)),
      ...k.bakislar.map((b) => el("div", { className: "s-dalis-duz-not" },
        b.ust ? el("span", { className: "s-dalis-ust", textContent: b.ust }) : null,
        b.baslik ? el("strong", { textContent: b.baslik }) : null,
        b.metin ? el("p", { textContent: b.metin }) : null,
        b.kaynak ? el("span", { className: "s-dalis-kaynak", textContent: `Kaynak · ${b.kaynak}` }) : null))))));
  return Promise.resolve({ guncelle() {}, yokEt() {} });
}
