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
//
// Kaydırma adım adımdır: dalışın içindeyken bir tekerlek hareketi, kaydırma (dokunma) ya da ok/sayfa tuşu kamerayı
// yalnızca BİR sonraki durma noktasına (kartın tam okunur olduğu an) götürür; hızlı kaydırmak metinleri art arda
// geçirmez. Dalışın başında yukarı, sonunda aşağı kaydırınca sayfa normal kaymaya döner.
// Her kartta okuma süresi kadar beklenir: bu sürede ileri kaydırma kartı geçmez, süre bitince ilerler. Altta
// "Devam et" düğmesi her an bir sonraki karta götürür; düğmenin dolan zemini bekleme süresini gösterir.
import { hareketAzalt } from "/ortak/animasyon.js";

const GORSEL_YOLU = /^\/medya\/[a-z0-9\-_/]+\.(?:jpe?g|png|webp)$/i;
const BIRIM_VH = 80;                              // bir "birim" kaydırma mesafesi (ekran yüksekliğinin yüzdesi)
const GIRIS = 0.6, HAREKET = 0.5, OKU = 0.85, DONUS = 0.4, GECIS = 1.35, SON = 0.4; // aşama uzunlukları (birim)
const MAKS_KARE = 40, MAKS_BAKIS = 6;
const GENIS = "(min-width: 1180px) and (min-aspect-ratio: 5/4)"; // web düzeni: görüntü ortada, kart yanda
const YENI_HAREKET_MS = 180;                     // tekerlek olayları arasında bu kadar boşluk yoksa aynı hareket sayılır
const ADIM_MS = [650, 1500], BIRIM_MS = 420;     // bir adımın süresi: mesafeyle uzar, sınırlar içinde kalır
const OKUMA_MS = [900, 2600], HARF_MS = 9;       // kartta bekleme: metin uzunluğuyla uzar, sınırlar içinde kalır
const OK_IKONU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
  // Durma noktaları: başlangıç, her kartın tam göründüğü an (okuma aşamasının ortası) ve son.
  // okumalar[i]: o noktadaki kartın harf sayısı (bekleme süresi için).
  const durmalar = [0], okumalar = [0];
  for (const a of asamalar) {
    const orta = (a.bas + a.son) / 2;
    if (a.tur === "oku" && a.bakis && orta - durmalar.at(-1) > 0.15) {
      durmalar.push(orta);
      okumalar.push(`${a.bakis.ust ?? ""}${a.bakis.baslik ?? ""}${a.bakis.metin ?? ""}`.length);
    }
  }
  if (s - durmalar.at(-1) > 0.15) { durmalar.push(s); okumalar.push(0); } else durmalar[durmalar.length - 1] = s;
  return { asamalar, duraklar, durmalar, okumalar, toplam: s };
}

// Dalışı kaydıran öğe: kaydırılabilir en yakın ata ya da belge.
function kaydiriciBul(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return document.scrollingElement || document.documentElement;
}
const yumusakGecis = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// İki kamera dikdörtgeni arasında "uçuş": boyut logaritmik, konum hedefe yaklaşma oranıyla.
function ara(A, B, e) {
  const g = Math.pow(A[2], 1 - e) * Math.pow(B[2], e);
  const k = Math.abs(A[2] - B[2]) > 1e-4 ? (A[2] - g) / (A[2] - B[2]) : e;
  return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, g];
}

export function dalisKur(kutu, { kareler, etiket, el }) {
  if (hareketAzalt()) return duzKur(kutu, { kareler, etiket, el });

  const N = kareler.length;
  const { asamalar, duraklar, durmalar, okumalar, toplam } = zamanCizelgesi(kareler);
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
  // Devam düğmesi: başta "Dalışa başla", kartlarda "Devam et", sonda "Dalışı bitir".
  const devamYazi = el("span", { className: "s-dalis-devam-yazi", textContent: "Dalışa başla" });
  const devamDolum = el("span", { className: "s-dalis-devam-dolum", ariaHidden: "true" });
  const devamOk = el("span", { className: "s-dalis-devam-ok", ariaHidden: "true" });
  devamOk.innerHTML = OK_IKONU;
  const devam = el("button", { className: "s-dalis-devam", type: "button" }, devamDolum, devamYazi, devamOk);
  const noktalar = el("nav", { className: "s-dalis-noktalar", ariaLabel: "Duraklar" },
    ...kareler.map((k, i) => {
      const d = el("button", { className: "s-dalis-nokta", ariaLabel: `${i + 1}. durak${k.baslik ? `: ${k.baslik}` : ""}` });
      d.addEventListener("click", () => git(durmalar.find((x) => x >= duraklar[i]) ?? duraklar[i]));
      return d;
    }));
  // Geniş ekranda görüntünün iki yanını dolduran bulanık arka plan (o anki karenin kendisi).
  const fon = el("div", { className: "s-dalis-fon", ariaHidden: "true" });
  const sahne = el("div", { className: "s-dalis-sahne" }, fon, tuval, svg, cubuk,
    el("div", { className: "s-dalis-ustler" }, rozet, durakYazisi), kart, devam, noktalar);
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

  // Web (geniş ekran) düzeni: sahne tam genişlik, görüntü ortada dikey sütun, kart sağda. Telefonda ve Android
  // uygulamasında kart görüntünün üstünde durur.
  const genisSorgu = matchMedia(GENIS);
  const genisle = () => { sahne.classList.toggle("genis", genisSorgu.matches); oncekiBakis = undefined; boyutla(); };
  genisSorgu.addEventListener("change", genisle);
  sahne.classList.toggle("genis", genisSorgu.matches);
  let tuvalSol = 0, tuvalUst = 0;

  function boyutla() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = sahne.getBoundingClientRect(), t = tuval.getBoundingClientRect();
    tuvalSol = t.left - r.left; tuvalUst = t.top - r.top;
    cw = Math.max(1, Math.round(t.width * dpr)); ch = Math.max(1, Math.round(t.height * dpr));
    if (tuval.width !== cw || tuval.height !== ch) { tuval.width = ara2.width = cw; tuval.height = ara2.height = ch; }
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    ctx.imageSmoothingQuality = actx.imageSmoothingQuality = "high";
    cizilecek = true;
  }

  // Kaydırıcı ve onun görünen alanı (belge ise pencere).
  let kaydirici = null;
  const kap = () => { if (!kaydirici?.isConnected) kaydirici = kaydiriciBul(iz); return kaydirici; };
  const belgeMi = () => kap() === document.scrollingElement || kaydirici === document.documentElement;
  const pencere = () => (belgeMi() ? { top: 0, height: innerHeight } : kaydirici.getBoundingClientRect());

  function konum() {
    const r = iz.getBoundingClientRect(), p = pencere();
    const yol = r.height - p.height;
    return yol > 0 ? kenet((p.top - r.top) / yol) * toplam : 0;
  }
  // s konumunun kaydırıcıdaki scrollTop karşılığı.
  function hedefUst(s) {
    const r = iz.getBoundingClientRect(), p = pencere();
    return kap().scrollTop + (r.top - p.top) + ((r.height - p.height) * s) / toplam;
  }
  // Dalış ekranı kaplıyor mu (yapışkan sahne görünür)?
  function icinde() {
    const r = iz.getBoundingClientRect(), p = pencere();
    return r.top <= p.top + 2 && r.bottom >= p.top + p.height - 2;
  }

  // Adım animasyonu: kaydırıcıyı yumuşak eğriyle hedefe götürür; sürerken yeni girdi yok sayılır.
  let animasyon = null, sonTekerlek = 0, bekleyenYerlesme = 0;
  let okumaBitis = 0, okumaZamani = 0, bekleyenAdim = false, oncekiPay = -1;
  function kaydir(son, sure, s, bitince) {
    cancelAnimationFrame(animasyon?.kare ?? 0);
    const bas = kap().scrollTop;
    const t0 = performance.now();
    animasyon = { s };
    devam.classList.add("yolda");
    const adim = (t) => {
      const u = kenet((t - t0) / sure);
      kaydirici.scrollTop = bas + (son - bas) * yumusakGecis(u);
      if (u < 1 && calisiyor) { animasyon.kare = requestAnimationFrame(adim); return; }
      animasyon = null;
      devam.classList.remove("yolda");
      bitince?.();
    };
    animasyon.kare = requestAnimationFrame(adim);
  }
  function git(s) {
    const sure = kenet(ADIM_MS[0] + Math.abs(s - konum()) * BIRIM_MS, ...ADIM_MS);
    kaydir(hedefUst(s), sure, s, () => okumaBaslat(s));
  }
  // Kartta bekleme: süre dolana kadar ileri kaydırma bekletilir (süre bitince yapılır); düğmenin zemini dolar.
  function okumaBaslat(s) {
    clearTimeout(okumaZamani);
    const i = durmalar.indexOf(s), harf = okumalar[i] ?? 0;
    const sure = harf ? kenet(OKUMA_MS[0] + harf * HARF_MS, ...OKUMA_MS) : 0;
    okumaBitis = performance.now() + sure;
    devam.classList.remove("hazir");
    devamDolum.style.transition = "none";
    devamDolum.style.transform = "scaleX(0)";
    void devamDolum.offsetWidth;
    devamDolum.style.transition = `transform ${sure}ms linear`;
    devamDolum.style.transform = "scaleX(1)";
    okumaZamani = setTimeout(() => {
      devam.classList.add("hazir");
      if (bekleyenAdim) { bekleyenAdim = false; adimAt(1); }
    }, sure);
  }
  // Dalışın sonundan sayfanın devamına geç.
  function bitir() {
    const r = iz.getBoundingClientRect(), p = pencere();
    kaydir(kap().scrollTop + (r.bottom - (p.top + p.height)) + 2, ADIM_MS[0], toplam);
  }
  devam.addEventListener("click", () => {
    if (animasyon) return;
    bekleyenAdim = false;
    if (konum() >= toplam - 0.02) { bitir(); return; }
    const hedefS = sonrakiDurma(1);
    if (hedefS != null) git(hedefS);
  });
  // Yöndeki bir sonraki durma noktası; yoksa null (dalıştan çıkılıyor).
  function sonrakiDurma(yon) {
    const s = animasyon ? animasyon.s : konum();
    return yon > 0 ? durmalar.find((x) => x > s + 0.02) ?? null : [...durmalar].reverse().find((x) => x < s - 0.02) ?? null;
  }
  function adimAt(yon, olay) {
    if (!icinde()) return false;
    // Hareket sürerken yeni bir ileri isteği: varınca, kart okunduktan sonra yapılır (en çok bir adım bekler).
    if (animasyon) { olay?.preventDefault(); if (yon > 0) bekleyenAdim = true; return true; }
    const hedefS = sonrakiDurma(yon);
    if (hedefS == null) return false;
    olay?.preventDefault();
    // Kart henüz okunuyor: ileri adım bekleme bitince yapılır.
    if (yon > 0 && performance.now() < okumaBitis) { bekleyenAdim = true; return true; }
    bekleyenAdim = false;
    git(hedefS);
    return true;
  }

  function tekerlek(e) {
    if (e.ctrlKey || !icinde()) return;
    const simdi = performance.now(), yeni = simdi - sonTekerlek > YENI_HAREKET_MS;
    sonTekerlek = simdi;
    const yon = Math.sign(e.deltaY);
    if (!yon) return;
    // Aynı hareketin (dokunmatik yüzey ataleti, hızlı çevrilen tekerlek) devamı: yeni adım yok, sayfa da kaymaz.
    if (!yeni || Math.abs(e.deltaY) < 3) { if (animasyon || sonrakiDurma(yon) != null) e.preventDefault(); return; }
    adimAt(yon, e);
  }
  let dokunY = null, dokunmaAdimi = false;
  function dokunBasla(e) { dokunY = e.touches[0]?.clientY ?? null; dokunmaAdimi = false; }
  function dokunHareket(e) {
    if (dokunY == null || !icinde()) return;
    const dy = dokunY - (e.touches[0]?.clientY ?? dokunY);
    if (animasyon) { e.preventDefault(); if (!dokunmaAdimi && dy > 28) { dokunmaAdimi = true; bekleyenAdim = true; } return; }
    if (Math.abs(dy) < 6) return;
    if (sonrakiDurma(Math.sign(dy)) == null) return; // dalıştan çıkış: sayfa doğal kaysın
    e.preventDefault();
    if (!dokunmaAdimi && Math.abs(dy) > 28) { dokunmaAdimi = true; adimAt(Math.sign(dy)); }
  }
  function dokunBitti() { dokunY = null; }
  function tus(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], button, a")) return;
    const yon = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, " ": e.shiftKey ? -1 : 1 }[e.key];
    if (yon) adimAt(yon, e);
  }
  // Kaydırma çubuğu ya da ataletle iki durak arasında kalınırsa en yakın durma noktasına yerleş.
  function kaydirildi() {
    if (animasyon) return;
    clearTimeout(bekleyenYerlesme);
    bekleyenYerlesme = setTimeout(() => {
      if (animasyon || dokunY != null || !icinde()) return;
      const s = konum();
      const yakin = durmalar.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
      if (Math.abs(yakin - s) > 0.02) git(yakin);
    }, 220);
  }
  const dinleyiciler = [
    [window, "wheel", tekerlek, { passive: false }],
    [window, "touchstart", dokunBasla, { passive: true }],
    [window, "touchmove", dokunHareket, { passive: false }],
    [window, "touchend", dokunBitti, { passive: true }],
    [window, "touchcancel", dokunBitti, { passive: true }],
    [window, "keydown", tus, {}],
    [window, "scroll", kaydirildi, { passive: true, capture: true }],
  ];
  for (const [h, ad, f, s] of dinleyiciler) h.addEventListener(ad, f, s);

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
      const x = tuvalSol + ((b.nokta[0] * d.W - d.sx) * d.olcek) / dpr, y = tuvalUst + ((b.nokta[1] * d.H - d.sy) * d.olcek) / dpr;
      const sk = sahne.getBoundingClientRect(), kk = kart.getBoundingClientRect();
      const ust = kart.classList.contains("ust");
      // Kart yandaysa (web düzeni) ok kartın sol kenarından, değilse üst/alt kenarından çıkar.
      const yanda = sahne.classList.contains("genis");
      const kx = yanda ? kk.left - sk.left : kenet(x, kk.left - sk.left + 22, kk.right - sk.left - 22);
      const ky = yanda ? kenet(y, kk.top - sk.top + 22, kk.bottom - sk.top - 22) : ust ? kk.bottom - sk.top : kk.top - sk.top;
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
      fon.style.backgroundImage = `url("${k.gorsel}")`;
      rozet.classList.toggle("canlandirma", k.etiket !== "gercek");
      durakYazisi.textContent = `${gosterilen + 1}/${N}${k.baslik ? ` · ${k.baslik}` : ""}`;
      noktalar.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", j === gosterilen ? "step" : "false"));
      for (const r of resimler.slice(gosterilen, gosterilen + 3)) r.decode?.().catch(() => {});
    }
    const hal = s >= toplam - 0.02 ? "son" : s < (durmalar[1] ?? toplam) - 0.05 ? "basla" : "devam";
    if (devam.dataset.hal !== hal) {
      devam.dataset.hal = hal;
      devamYazi.textContent = { basla: "Dalışa başla", devam: "Devam et", son: "Dalışı bitir" }[hal];
    }
    cubuk.firstChild.style.transform = `scaleX(${s / toplam})`;
  }


  function dongu() {
    if (!calisiyor) return;
    if (iz.isConnected) {
      hedef = konum();
      // Dalış henüz ekranın tepesine yapışmadıysa (üstte modül başlığı varken) sahnenin altı ekran dışında kalır;
      // devam düğmesi o pay kadar yukarıda durur ki "Dalışa başla" baştan görünsün.
      const pay = Math.max(0, Math.round(iz.getBoundingClientRect().top - pencere().top));
      if (pay !== oncekiPay) { oncekiPay = pay; devam.style.setProperty("--ust-pay", `${pay}px`); }
      const fark = hedef - simdiki;
      // Adım animasyonu zaten yumuşak: kamera onu doğrudan izler; serbest kaydırmada hafif gecikmeyle yumuşatılır.
      if (animasyon && fark) { simdiki = hedef; cizilecek = true; }
      else if (Math.abs(fark) > 0.0008) { simdiki += fark * 0.14; cizilecek = true; }
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

  return Promise.resolve({ guncelle() {}, yokEt() {
    calisiyor = false; gozlem.disconnect(); clearTimeout(okumaZamani); genisSorgu.removeEventListener("change", genisle); clearTimeout(bekleyenYerlesme); cancelAnimationFrame(animasyon?.kare ?? 0);
    for (const [h, ad, f, s] of dinleyiciler) h.removeEventListener(ad, f, s);
  } });
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
