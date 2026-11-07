// Lonca Android köprüsü. Web'de hiçbir şey yapmaz; Capacitor içinde açıldığında uygulamayı "gerçek uygulama" yapar:
//
//  - Aynı Wi-Fi'deki Lonca sunucusunu bulur (son adres → APK'ya gömülü bilgisayar IP'leri → emülatör → /24 ağ taraması).
//    Bulunca bütün /api istekleri canlı sunucuya gider (Studio'da canlıya alınan modüller ve dalışlar hemen görünür),
//    pakette olmayan medya da native tarafta sunucudan getirilir. Bulamazsa paketteki anlık görüntüyle çevrimdışı çalışır.
//  - Android geri tuşu: açık pencere → modülün kendi geri düğmesi → modülü kapat → profil → uygulamayı arka plana al.
//  - Sistem çubukları temaya uyar; dalış sırasında durum çubuğu gizlenir, her yeni durakta hafif titreşim olur.
//  - Konum izni native sorulur, Türkçe sesli okuma Android'in metin okuma motoruyla yapılır, eserler paylaşılabilir.
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  const P = C.Plugins ?? {};
  const kok = document.documentElement;
  kok.classList.add("lonca-native", `lonca-${C.getPlatform()}`);

  const YAP = window.LONCA_MOBIL ?? {};
  const PORT = Number(YAP.port) || 3000;
  const SAKLI = "lonca.sunucu", SAKLI_ANAHTAR = "lonca.anahtar";
  const ANAHTAR_BASLIGI = "x-lonca-anahtar";
  const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const yaz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const sessiz = (p) => Promise.resolve(p).catch(() => {});
  const $ = (s) => document.querySelector(s);

  // ---------- Sunucu bulma ----------
  const Http = P.CapacitorHttp;
  const anahtar = () => oku(SAKLI_ANAHTAR) || YAP.anahtar || "";
  function normalAdres(girdi) {
    let s = String(girdi ?? "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
    try {
      const u = new URL(s);
      if (!u.port && u.protocol === "http:") u.port = String(PORT);
      return `${u.protocol}//${u.host}`;
    } catch { return null; }
  }
  // Anahtar yalnızca bulunan Lonca sunucusuna gönderilir (tarama sırasında ağdaki başka cihazlara değil).
  async function istek(url, { method = "GET", headers = {}, data, ms = 8000, metin = true, anahtarli = true } = {}) {
    if (anahtarli && anahtar()) headers = { ...headers, [ANAHTAR_BASLIGI]: anahtar() };
    const r = await Promise.race([
      Http.request({ url, method, headers, data, connectTimeout: ms, readTimeout: ms, responseType: metin ? "text" : "json" }),
      new Promise((_, red) => setTimeout(() => red(new Error("zaman aşımı")), ms + 400)),
    ]);
    return r;
  }
  const coz = (r) => { try { return typeof r.data === "string" ? JSON.parse(r.data) : r.data; } catch { return null; } };
  // Sunucu sözleşmesi: GET /api/merhaba her zaman açık → { lonca: true, anahtarGerekli }.
  // Anahtar isteniyorsa /api/ayarlar anahtarla doğrulanır. /api/merhaba'sı olmayan eski sunucular için /api/ayarlar denenir.
  async function yokla(adres, ms = 1500) {
    try {
      const r = await istek(`${adres}/api/merhaba`, { ms, anahtarli: false });
      const g = coz(r);
      if (r.status === 404) {
        const e = await istek(`${adres}/api/ayarlar`, { ms, anahtarli: false });
        const h = coz(e);
        return e.status === 200 && h && typeof h === "object" && "harita" in h ? adres : null;
      }
      if (r.status !== 200 || !g?.lonca) return null;
      if (!g.anahtarGerekli) return adres;
      if (anahtar()) {
        const k = await istek(`${adres}/api/ayarlar`, { ms: Math.max(ms, 2500) });
        if (k.status === 200) return adres;
      }
      durum.anahtarGerekli = adres;
      return null;
    } catch { return null; }
  }
  // Eşleştirme: sunucuda `node araclar/eslestir.mjs` 6 haneli kod verir; uygulama karşılığında kalıcı anahtar alır.
  async function eslestir(adres, kod) {
    const r = await istek(`${adres}/api/eslestir`, { method: "POST", headers: { "content-type": "application/json" }, data: { kod, ad: "Lonca Android" }, ms: 5000, anahtarli: false });
    const g = coz(r);
    if (r.status !== 200 || !g?.anahtar) throw new Error(g?.hata || "Kod kabul edilmedi");
    yaz(SAKLI_ANAHTAR, g.anahtar);
    return g.anahtar;
  }
  const ilkBulan = (sozler) => new Promise((coz) => {
    let kalan = sozler.length;
    if (!kalan) return coz(null);
    for (const s of sozler) s.then((a) => { if (a) coz(a); else if (--kalan === 0) coz(null); });
  });
  function adaylar() {
    const l = [oku(SAKLI), ...(YAP.sunucular ?? []), `http://10.0.2.2:${PORT}`].map(normalAdres).filter(Boolean);
    return [...new Set(l)];
  }
  const ozelAg = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) && ip !== "10.0.2.2";
  async function agiTara(iptal) {
    const denenen = new Set(adaylar());
    const agler = [...new Set(adaylar().map((a) => new URL(a).hostname).filter(ozelAg).map((ip) => ip.split(".").slice(0, 3).join(".")))];
    const hedefler = [];
    for (const ag of agler) for (let i = 1; i < 255; i++) {
      const a = `http://${ag}.${i}:${PORT}`;
      if (!denenen.has(a)) hedefler.push(a);
    }
    let sira = 0, bulunan = null;
    const isci = async () => {
      while (!bulunan && !iptal.iptal && sira < hedefler.length) {
        const a = await yokla(hedefler[sira++], 900);
        if (a) bulunan ??= a;
      }
    };
    await Promise.all(Array.from({ length: 48 }, isci));
    return bulunan;
  }

  const durum = { canli: null, araniyor: false, tarama: null, anahtarGerekli: null, dinleyiciler: new Set() };
  const durumYayinla = () => durum.dinleyiciler.forEach((f) => sessiz(f()));
  function baglan(adres) {
    durum.canli = adres;
    if (adres) yaz(SAKLI, adres);
    if (adres) durum.anahtarGerekli = null;
    sessiz(P.LoncaSunucu?.ayarla({ adres: adres ?? "", anahtar: anahtar() }));
    durumYayinla();
  }
  async function hizliAra() {
    const a = await ilkBulan(adaylar().map((x) => yokla(x)));
    baglan(a);
    return a;
  }
  // İlk açılışta API, hızlı aramanın bitmesini en fazla ~1,7 sn bekler; sonra çevrimdışı açılır, tarama arkada sürer.
  const hazir = hizliAra();
  const ilkBekleme = Promise.race([hazir, new Promise((c) => setTimeout(c, 1700))]);
  function arkadaTara({ yenile = true } = {}) {
    if (durum.tarama || durum.canli) return durum.tarama;
    const iptal = { iptal: false };
    durum.araniyor = true; durumYayinla();
    durum.tarama = agiTara(iptal).then((a) => {
      durum.araniyor = false; durum.tarama = null;
      if (a && !durum.canli) { baglan(a); canliOldu(yenile); }
      else {
        durumYayinla();
        if (!a && durum.anahtarGerekli) bildir(`${new URL(durum.anahtarGerekli).host} bulundu; bağlanmak için eşleştirme kodu gir (Erişilebilirlik → Bağlantı).`);
      }
      return a;
    });
    return durum.tarama;
  }
  hazir.then((a) => { if (!a) arkadaTara(); });

  const modulAcik = () => $("#modul-ekrani") && !$("#modul-ekrani").hidden;
  function canliOldu(yenile) {
    bildir(`Lonca sunucusuna bağlandı · ${new URL(durum.canli).host}`);
    if (yenile && !modulAcik()) setTimeout(() => location.reload(), 900);
  }
  function koptu() {
    if (!durum.canli) return;
    baglan(null);
    bildir("Sunucuya ulaşılamıyor; paketteki verilerle devam ediliyor.");
    arkadaTara({ yenile: false });
  }

  // ---------- fetch: /api → canlı sunucu ya da çevrimdışı anlık görüntü ----------
  const asilFetch = window.fetch.bind(window);
  let yerel = null;
  const yerelApi = () => (yerel ??= import("/mobil/yerel-api.js"));
  const hataYaniti = (hata, kod = 503) => new Response(JSON.stringify({ hata }), { status: kod, headers: { "content-type": "application/json; charset=utf-8" } });

  async function uzaktan(url, yontem, init) {
    const headers = {};
    new Headers(init?.headers ?? {}).forEach((v, k) => { headers[k] = v; });
    let data;
    if (init?.body != null) {
      const b = typeof init.body === "string" ? init.body : await new Response(init.body).text();
      try { data = JSON.parse(b); } catch { data = b; }
      headers["content-type"] ??= "application/json";
    }
    const r = await istek(`${durum.canli}${url.pathname}${url.search}`, { method: yontem, headers, data, ms: yontem === "GET" ? 8000 : 60000 });
    const govde = typeof r.data === "string" ? r.data : JSON.stringify(r.data ?? null);
    const basliklar = new Headers();
    for (const [k, v] of Object.entries(r.headers ?? {})) { try { basliklar.set(k, String(v)); } catch {} }
    return new Response(r.status === 204 ? null : govde, { status: r.status, headers: basliklar });
  }

  window.fetch = async function (girdi, init = {}) {
    let url;
    try { url = new URL(typeof girdi === "string" || girdi instanceof URL ? girdi : girdi.url, location.href); } catch { return asilFetch(girdi, init); }
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return asilFetch(girdi, init);
    const yontem = String(init.method ?? (girdi instanceof Request ? girdi.method : "GET")).toUpperCase();
    await ilkBekleme;
    if (durum.canli) {
      try { return await uzaktan(url, yontem, init); }
      catch {
        if (yontem !== "GET") return hataYaniti("Lonca sunucusuna ulaşılamadı. Telefon, sunucunun çalıştığı bilgisayarla aynı Wi-Fi'de mi?");
        koptu();
      }
    }
    if (yontem !== "GET") return hataYaniti("Bunu göndermek için Lonca sunucusuna bağlı olmak gerekiyor. Telefonu sunucunun çalıştığı bilgisayarla aynı Wi-Fi'ye bağla.");
    try { return await (await yerelApi()).yanitla(url); }
    catch (h) { return hataYaniti(`Çevrimdışı veri okunamadı: ${h.message}`, 500); }
  };

  // ---------- Konum: Android izin akışıyla ----------
  const Geo = P.Geolocation;
  if (Geo && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = (ok, hata, s = {}) => {
      (async () => {
        let izin = await Geo.checkPermissions().catch(() => null);
        if (izin && String(izin.location).startsWith("prompt")) izin = await Geo.requestPermissions({ permissions: ["location", "coarseLocation"] }).catch(() => null);
        if (izin && izin.location !== "granted" && izin.coarseLocation !== "granted") throw Object.assign(new Error("Konum izni verilmedi"), { code: 1 });
        const p = await Geo.getCurrentPosition({ enableHighAccuracy: !!s.enableHighAccuracy, timeout: Math.max(Number(s.timeout) || 0, 8000), maximumAge: Number(s.maximumAge) || 0 });
        ok({ coords: p.coords, timestamp: p.timestamp });
      })().catch((e) => hata?.({ code: e?.code ?? 2, message: String(e?.message ?? e) }));
    };
  }

  // ---------- Sesli okuma: WebView'da speechSynthesis yok → Android TTS ----------
  const TTS = P.TextToSpeech;
  if (TTS && !("speechSynthesis" in window)) {
    window.SpeechSynthesisUtterance = class { constructor(text = "") { this.text = String(text); this.lang = "tr-TR"; this.rate = 1; this.voice = null; } };
    window.speechSynthesis = {
      getVoices: () => [{ name: "Android Türkçe", lang: "tr-TR", default: true, localService: true, voiceURI: "android-tr" }],
      speak: (u) => sessiz(TTS.speak({ text: u.text, lang: "tr-TR", rate: Math.max(0.5, Math.min(2, u.rate || 1)), category: "playback" })),
      cancel: () => sessiz(TTS.stop()),
      pause() {}, resume() {}, speaking: false, pending: false,
      addEventListener() {}, removeEventListener() {},
    };
  }

  // ---------- Bildirim (uygulamanın kendi kutucuğu) ----------
  function bildir(metin) {
    const kutu = $("#bildirimler");
    if (!kutu) return;
    const b = document.createElement("div");
    b.className = "bildirim bilgi"; b.setAttribute("role", "status");
    const s = document.createElement("span"); s.textContent = metin; b.append(s);
    kutu.append(b);
    setTimeout(() => { b.classList.add("gidiyor"); setTimeout(() => b.remove(), 400); }, 3200);
  }

  // ---------- Titreşim ----------
  const H = P.Haptics;
  const titret = (tur) => {
    if (!H || kok.classList.contains("hareket-az")) return;
    if (tur === "basari") sessiz(H.notification({ type: "SUCCESS" }));
    else if (tur === "secim") sessiz(H.selectionChanged?.() ?? H.impact({ style: "LIGHT" }));
    else sessiz(H.impact({ style: tur === "orta" ? "MEDIUM" : "LIGHT" }));
  };

  // ---------- Sistem çubukları ----------
  const Bar = P.SystemBars;
  let sonStil = null, durumGizli = false;
  function cubukStili() {
    // Modül açıksa modülün zemini, değilse Lonca'nın beyaz/siyah teması belirler.
    const modul = $("#modul-ekrani");
    const koyu = modul && !modul.hidden ? ["koyu", "gece"].includes(modul.dataset.zemin) || kok.classList.contains("kontrast")
      : kok.dataset.tema === "koyu" || kok.classList.contains("kontrast");
    const stil = koyu ? "DARK" : "LIGHT";
    if (stil !== sonStil) { sonStil = stil; sessiz(Bar?.setStyle({ style: stil })); }
  }
  function dalisDurumu() {
    const dalista = !!document.querySelector(".s-dalis-sahne");
    if (dalista === durumGizli || !Bar) return;
    durumGizli = dalista;
    sessiz(dalista ? Bar.hide({ bar: "StatusBar" }) : Bar.show({ bar: "StatusBar" }));
  }

  // ---------- Geri tuşu ----------
  const acik = (s) => { const e = $(s); return !!e && !e.hidden; };
  const gorunurMu = (e) => !!e && e.getClientRects().length > 0;
  function geri() {
    if (acik("#ayarlar")) return $("#ayar-kapat")?.click();
    if (acik("#katki")) return $("#katki-vazgec")?.click();
    if (acik("#tanisma")) return $("#tanisma-gec")?.click();
    const dlg = document.querySelector("dialog[open]");
    if (dlg) return dlg.close();
    if (acik("#katman")) return $("#katman-kapat")?.click();
    if (acik("#modul-ekrani")) {
      const ic = [...document.querySelectorAll("#sahne .s-ust-geri")].find(gorunurMu);
      return (ic ?? $("#geri"))?.click();
    }
    if (acik("#profil-ekrani")) return $("#profil-geri")?.click();
    sessiz(P.App?.minimizeApp());
  }

  // ---------- Bağlantı ayarı (Erişilebilirlik penceresine eklenir) ----------
  function baglantiBolumu() {
    const kutu = $("#ayarlar .erisim-kutu");
    if (!kutu || kutu.querySelector(".mobil-baglanti")) return;
    const f = document.createElement("fieldset");
    f.className = "erisim-grup mobil-baglanti";
    f.innerHTML = `<legend>Bağlantı</legend>
      <p class="baglanti-durum" role="status"><span class="baglanti-nokta" aria-hidden="true"></span><span class="baglanti-metin"></span></p>
      <label class="katki-alan">Sunucu adresi
        <input class="baglanti-girdi" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="192.168.1.20:${PORT}">
      </label>
      <label class="katki-alan">Eşleştirme kodu ya da API anahtarı <small>(sunucu istiyorsa)</small>
        <input class="baglanti-anahtar" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="6 haneli kod">
      </label>
      <p class="baglanti-ipucu">Bilgisayarında <code>npm run dev</code> çalışırken telefon aynı Wi-Fi'deyse sunucu kendiliğinden bulunur.</p>
      <div class="baglanti-dugmeler">
        <button type="button" class="dugme ikincil kucuk baglanti-ara">Ağda ara</button>
        <button type="button" class="dugme kucuk baglanti-bagla">Bağlan</button>
      </div>`;
    kutu.insertBefore(f, $("#ayar-kapat"));
    const metin = f.querySelector(".baglanti-metin"), girdi = f.querySelector(".baglanti-girdi");
    const ciz = async () => {
      f.dataset.durum = durum.canli ? "canli" : durum.araniyor ? "araniyor" : "cevrimdisi";
      if (durum.canli) metin.textContent = `Canlı: ${new URL(durum.canli).host}`;
      else if (durum.araniyor) metin.textContent = "Ağda Lonca sunucusu aranıyor…";
      else if (durum.anahtarGerekli) metin.textContent = `${new URL(durum.anahtarGerekli).host} bulundu, eşleştirme kodu gerekli`;
      else {
        let tarih = "";
        try { tarih = new Date(await (await yerelApi()).anlikTarihi()).toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); } catch {}
        metin.textContent = `Çevrimdışı: paketteki veriler${tarih ? ` (${tarih})` : ""}`;
      }
      if (document.activeElement !== girdi) girdi.value = durum.canli ? new URL(durum.canli).host : (oku(SAKLI) ? new URL(oku(SAKLI)).host : "");
    };
    durum.dinleyiciler.add(ciz);
    ciz();
    f.querySelector(".baglanti-ara").addEventListener("click", async () => {
      titret("secim");
      if (durum.canli) { const a = await yokla(durum.canli); if (a) return bildir("Bağlantı yerinde."); baglan(null); }
      const a = await hizliAra();
      if (a) return canliOldu(true);
      const b = await arkadaTara();
      if (!b) bildir("Aynı ağda Lonca sunucusu bulunamadı.");
    });
    f.querySelector(".baglanti-bagla").addEventListener("click", async () => {
      const a = normalAdres(girdi.value) ?? durum.anahtarGerekli;
      const alan = f.querySelector(".baglanti-anahtar");
      const k = alan.value.trim();
      if (!a) return bildir("Adres anlaşılamadı. Örnek: 192.168.1.20:3000");
      titret("secim");
      metin.textContent = "Deneniyor…";
      if (/^\d{6}$/.test(k)) {
        try { await eslestir(a, k); alan.value = ""; bildir("Eşleşti; bu telefon artık sunucuya bağlanabilir."); }
        catch (h) { bildir(`Eşleştirme olmadı: ${h.message}`); return ciz(); }
      } else if (k) { yaz(SAKLI_ANAHTAR, k); alan.value = ""; }
      if (await yokla(a, 3000)) { baglan(a); canliOldu(true); }
      else { bildir(durum.anahtarGerekli === a ? "Sunucu bulundu ama anahtar gerekiyor ya da geçersiz. Sunucuda eşleştirme kodu üret." : `${new URL(a).host} adresinde Lonca sunucusu yok.`); ciz(); }
    });
  }

  // ---------- Paylaş (eser penceresi) ----------
  function paylasDugmesi() {
    const eylem = $("#eser-penceresi .ep-eylemler");
    if (!eylem || !P.Share || eylem.querySelector(".ep-paylas")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "dugme ikincil kucuk ep-paylas"; b.textContent = "Paylaş";
    b.addEventListener("click", () => {
      const ad = $("#ep-ad")?.textContent ?? "";
      const ust = $("#ep-ust")?.textContent ?? "";
      const ilk = $("#ep-tarihce p")?.textContent ?? "";
      const ozet = ilk.length > 400 ? `${ilk.slice(0, 400).replace(/\s+\S*$/, "")}…` : ilk;
      titret("secim");
      sessiz(P.Share.share({ title: ad, text: [ad, ust, ozet, "Lonca ile keşfet: Bursa'nın vakıf eserleri."].filter(Boolean).join("\n\n"), dialogTitle: "Eseri paylaş" }));
    });
    eylem.prepend(b);
  }

  // ---------- Sayfa hazır olunca ----------
  function kur() {
    cubukStili();
    const gozle = new MutationObserver(cubukStili);
    gozle.observe(kok, { attributes: true, attributeFilter: ["data-tema", "class"] });
    for (const s of ["#modul-ekrani", "#ana-ekran", "#profil-ekrani"]) if ($(s)) gozle.observe($(s), { attributes: true, attributeFilter: ["hidden", "data-zemin"] });
    baglantiBolumu();
    paylasDugmesi();

    // Açılış ekranı: vitrin dolunca (en geç 4 sn) kapanır.
    let kapandi = false;
    const splashKapat = () => { if (kapandi) return; kapandi = true; sessiz(P.SplashScreen?.hide({ fadeOutDuration: 250 })); };
    const liste = $("#moduller");
    if (liste) new MutationObserver((_, o) => { if (liste.childElementCount) { o.disconnect(); requestAnimationFrame(splashKapat); } }).observe(liste, { childList: true });
    setTimeout(splashKapat, 4000);

    // Dalış ve başarımlar: DOM'u izleyerek (uygulama koduna dokunmadan) native tepki ver.
    let durakGozcu = null, bekliyor = false;
    new MutationObserver((kayitlar) => {
      for (const k of kayitlar) for (const n of k.addedNodes) {
        if (n.nodeType === 1 && n.matches?.(".bildirim.basarim")) titret("basari");
      }
      if (bekliyor) return;
      bekliyor = true;
      requestAnimationFrame(() => {
        bekliyor = false;
        dalisDurumu();
        const durak = document.querySelector(".s-dalis-durak");
        if (durak && durakGozcu?.el !== durak) {
          durakGozcu?.o.disconnect();
          let ilk = true;
          const o = new MutationObserver(() => { if (ilk) { ilk = false; return; } titret("hafif"); });
          o.observe(durak, { childList: true, characterData: true, subtree: true });
          durakGozcu = { el: durak, o };
        } else if (!durak && durakGozcu) { durakGozcu.o.disconnect(); durakGozcu = null; }
      });
    }).observe(document.body, { childList: true, subtree: true });

    // Telefonlarda dikey kilit (tablette serbest).
    if (Math.min(screen.width, screen.height) < 600) sessiz(P.ScreenOrientation?.lock({ orientation: "portrait" }));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kur, { once: true }); else kur();

  // ---------- Uygulama yaşam döngüsü ----------
  sessiz(P.App?.addListener("backButton", geri));
  sessiz(P.App?.addListener("pause", () => { try { window.speechSynthesis?.cancel(); } catch {} }));
  sessiz(P.App?.addListener("resume", async () => {
    if (durum.canli) { if (!(await yokla(durum.canli, 2000))) koptu(); }
    else if (await hizliAra()) canliOldu(true);
  }));
  sessiz(P.Network?.addListener("networkStatusChange", async (s) => {
    if (!s.connected) { if (durum.canli) { baglan(null); bildir("İnternet bağlantısı yok; paketteki verilerle devam ediliyor."); } return; }
    if (!durum.canli && (await hizliAra())) canliOldu(!modulAcik());
  }));

  window.loncaMobil = { durum, hizliAra, arkadaTara, titret };
})();
