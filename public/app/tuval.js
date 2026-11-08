// Modüllerin oyun alanı: "tuval" düğümü, oyun döngüsü, dokunma/klavye girdisi, ses efekti ve titreşim.
//
// Modül görünmez, yalıtılmış bir çerçevede çalışır; DOM'a erişemez. Tuvali uygulama (bu dosya) çizer:
//   - Modül oyun.ciz(id, kalem => …) ile çizim komutlarını gönderir; burada mantıksal koordinatlarda (tuvalin en × boy'u)
//     yüksek DPI'lı bir <canvas>'a çizilir. Taşma ve kaydırma yok.
//   - Tam ekran tuval (en/boy verilmez): tuval kalan ekranın tamamını doldurur; mantıksal birim CSS pikselidir, en × boy
//     ekranın gerçek boyutudur (telefonda dar ve uzun, masaüstünde geniş). Boyut değişince { tur:"boyut", tuval, en, boy }
//     girdisi gider; her kare de güncel boyutları taşır (modülde oyun.boyut(id)). en/boy verilirse tuval o oranda sabit
//     kalır ve ekrana orantılı sığdırılır (eski modüller).
//   - oyun.dongu(fn) açıksa her ekran karesinde (requestAnimationFrame) çerçeveye { tur:"kare", dt, t } gider. Modül kareyi
//     onaylamadan (kare_tamam) yenisi gönderilmez; sekme gizlenince kare gelmez, modül kapanınca döngü durur.
//   - Dokunma/fare (pointer) ve klavye girdisi tuval koordinatına çevrilip { tur:"girdi" } olarak iletilir.
//   - Ses: WebAudio ile üretilen kısa tonlar (dış dosya yok). Titreşim: Capacitor Haptics → navigator.vibrate → yok.
const MAKS_DPR = 3;
const DT_SINIRI = 0.05;            // uzun duraklamadan sonra top "ışınlanmasın"
const MAKS_TUVAL_KENARI = 4000;    // mantıksal birim
const MAKS_GORSEL = 120;
const AILE = { sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Menlo, Consolas, monospace" };
const HIZA = { sol: "left", orta: "center", sag: "right" };
const TABAN = { ust: "top", orta: "middle", alt: "alphabetic" };
const OK_TUSLARI = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

const sinirla = (x, a, b) => Math.max(a, Math.min(b, x));
const sayi = (x, v = 0) => (Number.isFinite(+x) ? +x : v);
const renkGecerli = (r) => typeof r === "string" && r !== "yok" && r.length <= 60 && /^[#\w\s(),.%+-]+$/.test(r);
// Yalnızca sunucudaki medya (eser fotoğrafları): dış adres, üst dizin ve sorgu yok.
const gorselAdresi = (u) => (typeof u === "string" && /^\/medya\/[\w\-./%]+$/.test(u) && !u.includes("..") && !u.includes("//") ? u : null);

// ---------- Ses ----------
// Hazır efektler: her nota { f: frekans, f2?: bitiş frekansı (kayma), sure, dalga, ses, gecikme }.
const NOTA = (f, sure, dalga = "square", ek = {}) => ({ f, sure, dalga, ses: 0.18, ...ek });
const SESLER = {
  bip: [NOTA(880, 0.08)],
  tik: [NOTA(1200, 0.025, "square", { ses: 0.1 })],
  vurus: [NOTA(560, 0.06, "square", { f2: 380 })],
  duvar: [NOTA(300, 0.05, "triangle", { ses: 0.22 })],
  puan: [NOTA(988, 0.07), NOTA(1319, 0.13, "square", { gecikme: 0.07 })],
  para: [NOTA(988, 0.07), NOTA(1319, 0.13, "square", { gecikme: 0.07 })],
  zipla: [NOTA(300, 0.14, "square", { f2: 760, ses: 0.14 })],
  gol: [523, 659, 784, 1047].map((f, i) => NOTA(f, 0.11, "square", { gecikme: i * 0.09, ses: 0.15 })),
  kazandin: [523, 659, 784, 1047, 1319].map((f, i) => NOTA(f, i === 4 ? 0.35 : 0.12, "square", { gecikme: i * 0.11, ses: 0.15 })),
  kaybettin: [392, 330, 262].map((f, i) => NOTA(f, i === 2 ? 0.4 : 0.16, "triangle", { gecikme: i * 0.17, ses: 0.25 })),
  hata: [NOTA(150, 0.22, "sawtooth", { f2: 110, ses: 0.16 })],
  patlama: [{ gurultu: true, sure: 0.32, ses: 0.35 }],
};
const DALGALAR = new Set(["sine", "square", "triangle", "sawtooth"]);

export function tuvalMotoru({ ham, gonder, el }) {
  const tuvaller = new Map();      // id → tuval kaydı
  const sonKomutlar = new Map();   // id → son çizim (tuval sonra kurulursa da çizilir)
  const gorseller = new Map();     // adres → { img, hazir }
  const parmaklar = new Map();     // pointerId → { tuval, basX, basY, zaman }
  let dongu = false, bekliyor = false, rafId = 0, sonZaman = 0, toplam = 0, olu = false;
  let sesBag = null, anaSes = null, sesSayaci = [], titresimSayaci = [];

  // ---------- Oyun döngüsü ----------
  function kareIste() {
    if (!rafId && dongu && !bekliyor && !olu) rafId = requestAnimationFrame(kare);
  }
  function kare(zaman) {
    rafId = 0;
    if (!dongu || olu) return;
    const dt = sonZaman ? sinirla((zaman - sonZaman) / 1000, 0, DT_SINIRI) : 1 / 60;
    sonZaman = zaman;
    toplam += dt;
    bekliyor = true;
    for (const t of tuvaller.values()) if (!t.sonBoyut) boyutla(t); // ilk kareden önce gerçek boyut bilinsin
    const boyutlar = Object.fromEntries([...tuvaller.values()].map((t) => [t.id, [t.en, t.boy]]));
    if (!ham({ tur: "kare", dt, t: toplam, boyutlar })) yokEt(); // çerçeve kapandı
  }
  const gorunurluk = () => { sonZaman = 0; };
  document.addEventListener("visibilitychange", gorunurluk);

  // ---------- Çizim ----------
  function gorselAl(adres) {
    const u = gorselAdresi(adres);
    if (!u) return null;
    let g = gorseller.get(u);
    if (!g) {
      if (gorseller.size >= MAKS_GORSEL) gorseller.delete(gorseller.keys().next().value);
      const img = new Image();
      img.decoding = "async";
      g = { img, hazir: false };
      img.onload = () => { g.hazir = true; for (const t of tuvaller.values()) ciz(t); };
      img.src = u;
      gorseller.set(u, g);
    }
    return g.hazir ? g.img : null;
  }

  function yolCiz(ctx, x, y, en, boy, r) {
    ctx.beginPath();
    if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, en, boy, Math.min(r, Math.abs(en) / 2, Math.abs(boy) / 2));
    else ctx.rect(x, y, en, boy);
  }

  function komut(ctx, c, t, derinlik) {
    switch (c?.[0]) {
      case "temizle":
        if (renkGecerli(c[1])) { ctx.fillStyle = c[1]; ctx.fillRect(0, 0, t.en, t.boy); } else ctx.clearRect(0, 0, t.en, t.boy);
        break;
      case "dikdortgen": {
        const [, x, y, en, boy, renk, r, cizgi, kalinlik] = c;
        yolCiz(ctx, sayi(x), sayi(y), sayi(en), sayi(boy), sayi(r));
        if (renkGecerli(renk)) { ctx.fillStyle = renk; ctx.fill(); }
        if (renkGecerli(cizgi)) { ctx.strokeStyle = cizgi; ctx.lineWidth = sinirla(sayi(kalinlik, 2), 0.5, 100); ctx.stroke(); }
        break;
      }
      case "daire": {
        const [, x, y, r, renk, cizgi, kalinlik] = c;
        ctx.beginPath();
        ctx.arc(sayi(x), sayi(y), Math.max(0, sayi(r)), 0, Math.PI * 2);
        if (renkGecerli(renk)) { ctx.fillStyle = renk; ctx.fill(); }
        if (renkGecerli(cizgi)) { ctx.strokeStyle = cizgi; ctx.lineWidth = sinirla(sayi(kalinlik, 2), 0.5, 100); ctx.stroke(); }
        break;
      }
      case "cizgi": {
        const [, x1, y1, x2, y2, renk, kalinlik, kesikli] = c;
        if (!renkGecerli(renk)) break;
        ctx.beginPath();
        ctx.moveTo(sayi(x1), sayi(y1));
        ctx.lineTo(sayi(x2), sayi(y2));
        ctx.strokeStyle = renk;
        ctx.lineWidth = sinirla(sayi(kalinlik, 2), 0.5, 100);
        ctx.lineCap = "round";
        ctx.setLineDash(sayi(kesikli) > 0 ? [sayi(kesikli), sayi(kesikli)] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "yol": {
        const [, noktalar, renk, kapali, dolgu, kalinlik] = c;
        if (!Array.isArray(noktalar) || noktalar.length < 2 || !renkGecerli(renk)) break;
        ctx.beginPath();
        noktalar.slice(0, 400).forEach((n, i) => (i ? ctx.lineTo(sayi(n?.[0]), sayi(n?.[1])) : ctx.moveTo(sayi(n?.[0]), sayi(n?.[1]))));
        if (kapali) ctx.closePath();
        if (dolgu) { ctx.fillStyle = renk; ctx.fill(); } else { ctx.strokeStyle = renk; ctx.lineWidth = sinirla(sayi(kalinlik, 2), 0.5, 100); ctx.lineJoin = "round"; ctx.stroke(); }
        break;
      }
      case "yazi": {
        const [, metin, x, y, boyut, renk, hiza, kalin, aile, taban] = c;
        if (!renkGecerli(renk)) break;
        ctx.font = `${kalin ? "700 " : ""}${sinirla(sayi(boyut, 16), 4, 400)}px ${AILE[aile] ?? AILE.sans}`;
        ctx.textAlign = HIZA[hiza] ?? "left";
        ctx.textBaseline = TABAN[taban] ?? "middle";
        ctx.fillStyle = renk;
        ctx.fillText(String(metin ?? "").slice(0, 300), sayi(x), sayi(y));
        break;
      }
      case "gorsel": {
        const [, adres, x, y, en, boy, r, kirp] = c;
        const img = gorselAl(adres);
        ctx.save();
        yolCiz(ctx, sayi(x), sayi(y), sayi(en), sayi(boy), sayi(r));
        ctx.clip();
        if (!img) { ctx.fillStyle = "rgba(127,127,127,.25)"; ctx.fillRect(sayi(x), sayi(y), sayi(en), sayi(boy)); }
        else {
          const oran = kirp === "sigdir" ? Math.min(en / img.naturalWidth, boy / img.naturalHeight) : Math.max(en / img.naturalWidth, boy / img.naturalHeight);
          const w = img.naturalWidth * oran, h = img.naturalHeight * oran;
          ctx.drawImage(img, sayi(x) + (en - w) / 2, sayi(y) + (boy - h) / 2, w, h);
        }
        ctx.restore();
        break;
      }
      case "saydamlik": ctx.globalAlpha = sinirla(sayi(c[1], 1), 0, 1); break;
      case "kaydet": if (derinlik.n < 64) { ctx.save(); derinlik.n++; } break;
      case "geri": if (derinlik.n > 0) { ctx.restore(); derinlik.n--; } break;
      case "tasi": ctx.translate(sayi(c[1]), sayi(c[2])); break;
      case "dondur": ctx.rotate(sayi(c[1])); break;
      case "olcekle": ctx.scale(sinirla(sayi(c[1], 1), -100, 100), sinirla(sayi(c[2], 1), -100, 100)); break;
      default: break;
    }
  }

  function ciz(t) {
    const { ctx, canvas } = t;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(t.olcek, 0, 0, t.olcek, 0, 0);
    const derinlik = { n: 0 };
    for (const c of sonKomutlar.get(t.id) ?? []) {
      try { komut(ctx, c, t, derinlik); } catch { /* bozuk komut atlanır */ }
    }
    while (derinlik.n-- > 0) ctx.restore();
    ctx.restore();
  }

  function cizimAl(id, komutlar) {
    if (!Array.isArray(komutlar)) return;
    const k = String(id);
    sonKomutlar.set(k, komutlar.slice(0, 4000));
    const t = tuvaller.get(k);
    if (t) ciz(t);
  }

  // ---------- Yerleşim: tam ekran tuval kalan alanı doldurur; sabit boyutlu tuval ekrana orantılı sığar ----------
  function boyutla(t) {
    if (!t.kutu.isConnected) return;
    const genislik = t.kutu.clientWidth || 360;
    const r = t.kutu.getBoundingClientRect();
    const kaydirici = t.kutu.closest(".sahne");
    const ust = r.top + (kaydirici?.scrollTop ?? 0) + scrollY;
    const vh = window.visualViewport?.height ?? innerHeight;
    const sekme = document.getElementById("sekme-cubugu");
    const alt = sekme && !sekme.hidden ? sekme.getBoundingClientRect().height + 8 : t.tam ? 0 : 10;
    const yukseklik = Math.max(220, Math.floor(vh - Math.max(0, ust) - alt));
    const anahtar = `${genislik}x${yukseklik}x${devicePixelRatio}x${t.tam ? "tam" : `${t.en}x${t.boy}`}`;
    if (anahtar === t.sonBoyut) return;
    t.sonBoyut = anahtar;
    let cssEn, cssBoy;
    if (t.tam) {
      cssEn = sinirla(Math.floor(genislik), 50, MAKS_TUVAL_KENARI);
      cssBoy = sinirla(yukseklik, 50, MAKS_TUVAL_KENARI);
      const degisti = cssEn !== t.en || cssBoy !== t.boy || !t.bildirildi;
      t.en = cssEn; t.boy = cssBoy;
      if (degisti) { t.bildirildi = true; girdi({ tur: "boyut", tuval: t.id, en: t.en, boy: t.boy }); }
    } else {
      const oran = Math.min(genislik / t.en, yukseklik / t.boy);
      cssEn = Math.floor(t.en * oran); cssBoy = Math.floor(t.boy * oran);
      if (!t.bildirildi) { t.bildirildi = true; girdi({ tur: "boyut", tuval: t.id, en: t.en, boy: t.boy }); }
    }
    const dpr = Math.min(MAKS_DPR, devicePixelRatio || 1);
    t.cerceve.style.width = `${cssEn}px`;
    t.cerceve.style.height = `${cssBoy}px`;
    t.canvas.width = Math.max(1, Math.round(cssEn * dpr));
    t.canvas.height = Math.max(1, Math.round(cssBoy * dpr));
    t.olcek = t.canvas.width / t.en;
    t.katman.style.setProperty("--tuval-olcek", String(cssEn / t.en));
    ciz(t);
  }
  const hepsiniBoyutla = () => { for (const t of tuvaller.values()) { t.sonBoyut = null; boyutla(t); } };
  addEventListener("resize", hepsiniBoyutla);
  window.visualViewport?.addEventListener("resize", hepsiniBoyutla);

  // ---------- Girdi ----------
  function konum(t, e) {
    const r = t.canvas.getBoundingClientRect();
    return {
      x: Math.round(sinirla(((e.clientX - r.left) / (r.width || 1)) * t.en, 0, t.en) * 10) / 10,
      y: Math.round(sinirla(((e.clientY - r.top) / (r.height || 1)) * t.boy, 0, t.boy) * 10) / 10,
    };
  }
  const girdi = (olay) => ham({ tur: "girdi", olay });

  function pointerDown(t, e) {
    if (e.button > 0) return;
    e.preventDefault();
    sesHazirla(); // tarayıcılar sesi yalnızca kullanıcı dokununca açar
    t.canvas.focus({ preventScroll: true });
    try { t.canvas.setPointerCapture(e.pointerId); } catch {}
    parmaklar.set(e.pointerId, { tuval: t.id, basX: e.clientX, basY: e.clientY, zaman: performance.now() });
    girdi({ tur: "basla", tuval: t.id, parmak: e.pointerId, ...konum(t, e), tip: e.pointerType });
  }
  function pointerMove(e) {
    const p = parmaklar.get(e.pointerId);
    const t = p && tuvaller.get(p.tuval);
    if (!t) return;
    girdi({ tur: "surukle", tuval: t.id, parmak: e.pointerId, ...konum(t, e), tip: e.pointerType });
  }
  function pointerUp(e) {
    const p = parmaklar.get(e.pointerId);
    if (!p) return;
    parmaklar.delete(e.pointerId);
    const t = tuvaller.get(p.tuval);
    if (!t) return;
    const k = konum(t, e);
    girdi({ tur: "birak", tuval: t.id, parmak: e.pointerId, ...k, tip: e.pointerType });
    // Kısa ve kımıldamadan dokunuş: sıra tabanlı oyunlar için sahne olayı da gelir.
    if (e.type === "pointerup" && Math.hypot(e.clientX - p.basX, e.clientY - p.basY) < 12 && performance.now() - p.zaman < 600) {
      gonder({ tur: "dokun", id: t.id, ...k });
    }
  }
  addEventListener("pointermove", pointerMove, { passive: true });
  addEventListener("pointerup", pointerUp);
  addEventListener("pointercancel", pointerUp);

  const tusAdi = (e) => (e.key === " " ? "Space" : e.key.length === 1 ? e.key.toLocaleLowerCase("en") : e.key);
  function klavyeAktif(e) {
    if (!tuvaller.size || olu) return false;
    if (e.target?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true'], dialog[open], #katman:not([hidden])")) return false;
    const ekran = document.getElementById("modul-ekrani");
    return !ekran || !ekran.hidden;
  }
  function tus(e) {
    if (!klavyeAktif(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const ad = tusAdi(e);
    if (OK_TUSLARI.has(ad)) e.preventDefault(); // sayfa kaymasın
    if (e.type === "keydown") { sesHazirla(); if (!e.repeat) girdi({ tur: "tus", tus: ad }); }
    else girdi({ tur: "tus_birak", tus: ad });
  }
  addEventListener("keydown", tus);
  addEventListener("keyup", tus);
  const odakKaybi = () => { parmaklar.clear(); girdi({ tur: "odak_kaybi" }); };
  addEventListener("blur", odakKaybi);

  // ---------- Ses ve titreşim ----------
  function sesHazirla() {
    try {
      if (!sesBag) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        sesBag = new AC();
        anaSes = sesBag.createGain();
        anaSes.gain.value = 0.6;
        anaSes.connect(sesBag.destination);
      }
      if (sesBag.state === "suspended") sesBag.resume().catch(() => {});
      return sesBag;
    } catch { return null; }
  }
  const sikMi = (dizi, sinir) => {
    const simdi = performance.now();
    while (dizi.length && simdi - dizi[0] > 1000) dizi.shift();
    if (dizi.length >= sinir) return true;
    dizi.push(simdi);
    return false;
  };
  function sesCal(ad) {
    const ac = sesHazirla();
    if (!ac || ac.state !== "running" || sikMi(sesSayaci, 24)) return;
    let notalar = SESLER[ad];
    if (!notalar && ad && typeof ad === "object") {
      notalar = [{ f: sinirla(sayi(ad.frekans, 440), 20, 5000), f2: ad.bitis == null ? undefined : sinirla(sayi(ad.bitis), 20, 5000),
        sure: sinirla(sayi(ad.sure, 0.1), 0.01, 2), dalga: DALGALAR.has(ad.dalga) ? ad.dalga : "square", ses: sinirla(sayi(ad.ses, 0.2), 0, 1) }];
    }
    if (!notalar) notalar = SESLER.bip;
    const t0 = ac.currentTime + 0.005;
    for (const n of notalar) {
      const bas = t0 + (n.gecikme ?? 0), bit = bas + n.sure;
      const kazanc = ac.createGain();
      kazanc.gain.setValueAtTime(0.0001, bas);
      kazanc.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.ses), bas + 0.008);
      kazanc.gain.exponentialRampToValueAtTime(0.0001, bit);
      kazanc.connect(anaSes);
      let kaynak;
      if (n.gurultu) {
        const tampon = ac.createBuffer(1, Math.ceil(ac.sampleRate * n.sure), ac.sampleRate);
        const v = tampon.getChannelData(0);
        for (let i = 0; i < v.length; i++) v[i] = (Math.random() * 2 - 1) * (1 - i / v.length);
        kaynak = ac.createBufferSource();
        kaynak.buffer = tampon;
      } else {
        kaynak = ac.createOscillator();
        kaynak.type = n.dalga;
        kaynak.frequency.setValueAtTime(n.f, bas);
        if (n.f2) kaynak.frequency.exponentialRampToValueAtTime(n.f2, bit);
      }
      kaynak.connect(kazanc);
      kaynak.start(bas);
      kaynak.stop(bit + 0.02);
    }
  }
  function titres(tur) {
    if (document.documentElement.classList.contains("hareket-az") || sikMi(titresimSayaci, 12)) return;
    const ms = typeof tur === "number" ? sinirla(Math.round(tur), 1, 400) : ({ hafif: 10, orta: 22, guclu: 45, basari: 30, hata: 60 }[tur] ?? 15);
    const H = window.Capacitor?.Plugins?.Haptics;
    const sessiz = (p) => Promise.resolve(p).catch(() => {});
    try {
      if (H) {
        if (tur === "basari") sessiz(H.notification({ type: "SUCCESS" }));
        else if (tur === "hata") sessiz(H.notification({ type: "ERROR" }));
        else if (typeof tur === "number") sessiz(H.vibrate({ duration: ms }));
        else sessiz(H.impact({ style: tur === "guclu" ? "HEAVY" : tur === "orta" ? "MEDIUM" : "LIGHT" }));
      } else navigator.vibrate?.(ms);
    } catch { /* titreşim yoksa sessizce geç */ }
  }

  // ---------- Çerçeveden gelen akış ----------
  function akis(v) {
    if (olu || !v || typeof v !== "object") return;
    if (v.tur === "ciz") cizimAl(v.id, v.komutlar);
    else if (v.tur === "kare_tamam") {
      for (const [id, k] of Object.entries(v.cizimler ?? {})) cizimAl(id, k);
      bekliyor = false;
      if (!v.devam) dongu = false;
      kareIste();
    } else if (v.tur === "dongu") {
      dongu = !!v.acik;
      if (dongu) { sonZaman = 0; kareIste(); }
      else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    } else if (v.tur === "ses") sesCal(v.ses);
    else if (v.tur === "titres") titres(v.titres);
  }

  // ---------- sahne.js "tuval" düğümü ----------
  function kur(n) {
    const id = String(n.id ?? "oyun");
    const t = { id, en: 360, boy: 640, tam: false, olcek: 1, sonBoyut: null, bildirildi: false };
    const canvas = el("canvas", { className: "s-tuval-cizim", tabIndex: 0, role: "img", ariaLabel: String(n.etiket ?? "Oyun alanı").slice(0, 120) });
    const katman = el("div", { className: "s-tuval-katman" });
    const cerceve = el("div", { className: "s-tuval-cerceve" }, canvas, katman);
    const kutu = el("div", { className: "s-tuval" }, cerceve);
    Object.assign(t, { canvas, katman, cerceve, kutu, ctx: canvas.getContext("2d") });
    canvas.addEventListener("pointerdown", (e) => pointerDown(t, e));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    // touch-action: none her WebView'da yetmiyor: tuvaldeki dokunmatik kaydırma sayfayı/kabuğu kaydırmasın.
    for (const ad of ["touchstart", "touchmove"]) canvas.addEventListener(ad, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const izle = new ResizeObserver(() => boyutla(t));
    izle.observe(kutu);
    const api = {
      kap: kutu,
      katman,
      guncelle(d) {
        // en ve boy verilmediyse (ya da tam: true) tuval tam ekrandır: boyutunu ekran belirler (boyutla).
        const tam = d.tam === true || (d.en == null && d.boy == null);
        if (tam !== t.tam) { t.tam = tam; t.sonBoyut = null; t.bildirildi = false; }
        kutu.classList.toggle("tam", tam);
        if (!tam) {
          const en = sinirla(Math.round(sayi(d.en, 360)), 50, MAKS_TUVAL_KENARI), boy = sinirla(Math.round(sayi(d.boy, 640)), 50, MAKS_TUVAL_KENARI);
          if (en !== t.en || boy !== t.boy) { t.en = en; t.boy = boy; t.sonBoyut = null; t.bildirildi = false; }
        }
        kutu.style.background = renkGecerli(d.arkaplan) ? d.arkaplan : "";
        requestAnimationFrame(() => boyutla(t));
      },
      yokEt() { izle.disconnect(); if (tuvaller.get(id) === t) tuvaller.delete(id); },
    };
    tuvaller.set(id, t);
    api.guncelle(n);
    return api;
  }

  function yokEt() {
    if (olu) return;
    olu = true;
    dongu = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    document.removeEventListener("visibilitychange", gorunurluk);
    removeEventListener("resize", hepsiniBoyutla);
    window.visualViewport?.removeEventListener("resize", hepsiniBoyutla);
    removeEventListener("pointermove", pointerMove);
    removeEventListener("pointerup", pointerUp);
    removeEventListener("pointercancel", pointerUp);
    removeEventListener("keydown", tus);
    removeEventListener("keyup", tus);
    removeEventListener("blur", odakKaybi);
    tuvaller.clear(); sonKomutlar.clear(); gorseller.clear(); parmaklar.clear();
    sesBag?.close?.().catch?.(() => {});
    sesBag = null;
  }

  return {
    akis, kur, yokEt,
    bekle: (sn) => new Promise((coz) => setTimeout(coz, sinirla(sayi(sn), 0, 10) * 1000)),
  };
}
