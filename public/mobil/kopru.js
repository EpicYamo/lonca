// Lonca Android köprüsü. Web'de hiçbir şey yapmaz; Capacitor içinde açıldığında uygulamayı "gerçek uygulama" yapar:
//
//  - Tek, sabit bir Lonca sunucusuna bağlanır: APK'ya derlenirken gömülen adres (LONCA_SUNUCU_URL, varsayılan
//    https://kozmos.itaskira.com). Ağ taraması ya da IP keşfi yoktur. Bağlanınca bütün /api istekleri bu sunucuya gider
//    (Studio'da canlıya alınan modüller ve dalışlar hemen görünür), pakette olmayan medya da native tarafta oradan
//    getirilir. Sunucuya ulaşılamazsa paketteki anlık görüntüyle çevrimdışı çalışır ve arada bir yeniden dener.
//  - Android geri tuşu: açık pencere → modülün kendi geri düğmesi → modülü kapat → Modüller/Profil sekmesinden Keşfet'e
//    → uygulamayı arka plana al.
//  - Sistem çubukları temaya uyar; dalış sırasında durum çubuğu gizlenir, her yeni durakta hafif titreşim olur.
//  - Konum izni native sorulur, Türkçe sesli okuma Android'in metin okuma motoruyla yapılır, eserler paylaşılabilir.
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  const P = C.Plugins ?? {};
  const kok = document.documentElement;
  // "kabuk": alt gezinmeli, ayrı sayfalı uygulama düzeni (public/app/kabuk.js, kabuk.css).
  kok.classList.add("lonca-native", `lonca-${C.getPlatform()}`, "kabuk");

  const YAP = window.LONCA_MOBIL ?? {};
  const SAKLI_ANAHTAR = "lonca.anahtar";
  const ANAHTAR_BASLIGI = "x-lonca-anahtar";
  const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const yaz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const sessiz = (p) => Promise.resolve(p).catch(() => {});
  const $ = (s) => document.querySelector(s);
  // Eski sürümlerin ağ taramasıyla bulup sakladığı yerel adres artık kullanılmaz.
  yaz("lonca.sunucu", null);

  // ---------- Sabit sunucu ----------
  const Http = P.CapacitorHttp;
  const anahtar = () => oku(SAKLI_ANAHTAR) || YAP.anahtar || "";
  function normalAdres(girdi) {
    const s = String(girdi ?? "").trim();
    if (!/^https?:\/\//i.test(s)) return null;
    try {
      const u = new URL(s);
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
    } catch { return null; }
  }
  const SUNUCU = normalAdres(YAP.sunucu ?? YAP.genel);
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
  // Anahtar isteniyorsa /api/ayarlar anahtarla doğrulanır.
  async function yokla(ms = 4000) {
    if (!SUNUCU) return null;
    durum.anahtarGerekli = false;
    try {
      const r = await istek(`${SUNUCU}/api/merhaba`, { ms, anahtarli: false });
      const g = coz(r);
      if (r.status !== 200 || !g?.lonca) return null;
      if (!g.anahtarGerekli) return SUNUCU;
      if (anahtar()) {
        const k = await istek(`${SUNUCU}/api/ayarlar`, { ms });
        if (k.status === 200) return SUNUCU;
      }
      durum.anahtarGerekli = true;
      return null;
    } catch { return null; }
  }
  // Eşleştirme: sunucuda `node araclar/eslestir.mjs` 6 haneli kod verir; uygulama karşılığında kalıcı anahtar alır.
  async function eslestir(kod) {
    const r = await istek(`${SUNUCU}/api/eslestir`, { method: "POST", headers: { "content-type": "application/json" }, data: { kod, ad: "Lonca Android" }, ms: 5000, anahtarli: false });
    const g = coz(r);
    if (r.status !== 200 || !g?.anahtar) throw new Error(g?.hata || "Kod kabul edilmedi");
    yaz(SAKLI_ANAHTAR, g.anahtar);
    return g.anahtar;
  }
  const gorunen = (a) => String(a).replace(/^https?:\/\//, "");

  const durum = { canli: null, deneniyor: false, anahtarGerekli: false, dinleyiciler: new Set() };
  const durumYayinla = () => durum.dinleyiciler.forEach((f) => sessiz(f()));
  function baglan(adres) {
    durum.canli = adres;
    if (adres) durum.anahtarGerekli = false;
    sessiz(P.LoncaSunucu?.ayarla({ adres: adres ?? "", anahtar: anahtar() }));
    durumYayinla();
  }
  let suren = null;
  function dene(ms) {
    suren ??= (async () => {
      durum.deneniyor = true; durumYayinla();
      const a = await yokla(ms);
      durum.deneniyor = false;
      baglan(a);
      return a;
    })().finally(() => { suren = null; });
    return suren;
  }
  // İlk açılışta API, sunucunun yanıtını en fazla ~4,5 sn bekler; sonra çevrimdışı açılır.
  const hazir = dene();
  const ilkBekleme = Promise.race([hazir, new Promise((c) => setTimeout(c, SUNUCU ? 4500 : 0))]);
  // Çevrimdışıyken dakikada bir yeniden dener; bağlanınca (modül açık değilse) sayfayı canlı veriyle yeniler.
  setInterval(async () => {
    if (durum.canli || !SUNUCU || document.hidden) return;
    if (await dene()) canliOldu(!modulAcik());
  }, 60_000);

  const modulAcik = () => $("#modul-ekrani") && !$("#modul-ekrani").hidden;
  function canliOldu(yenile) {
    bildir(`Lonca sunucusuna bağlandı · ${gorunen(durum.canli)}`);
    if (yenile && !modulAcik()) setTimeout(() => location.reload(), 900);
  }
  function koptu() {
    if (!durum.canli) return;
    baglan(null);
    bildir("Sunucuya ulaşılamıyor; paketteki verilerle devam ediliyor.");
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
        if (yontem !== "GET") return hataYaniti("Lonca sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.");
        koptu();
      }
    }
    if (yontem !== "GET") return hataYaniti("Bunu göndermek için Lonca sunucusuna bağlı olmak gerekiyor. İnternet bağlantını kontrol et.");
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
    // Karşılama ekranında geri, Android alışkanlığıyla uygulamayı arka plana alır.
    if (acik("#karsilama") && !acik("#hesap-penceresi")) return sessiz(P.App?.minimizeApp());
    if (acik("#katki")) return $("#katki-vazgec")?.click();
    if (acik("#tanisma")) return $("#tanisma-gec")?.click();
    if (acik("#hesap-penceresi")) return $("#hesap-vazgec")?.click();
    const dlg = document.querySelector("dialog[open]");
    if (dlg) return dlg.close();
    if (acik("#katman")) return $("#katman-kapat")?.click();
    if (acik("#modul-ekrani")) {
      const ic = [...document.querySelectorAll("#sahne .s-ust-geri")].find(gorunurMu);
      return (ic ?? $("#geri"))?.click();
    }
    if (window.loncaKabuk?.geri()) return;
    if (acik("#profil-ekrani")) return $("#profil-geri")?.click();
    sessiz(P.App?.minimizeApp());
  }

  // ---------- Bağlantı durumu (Erişilebilirlik penceresine eklenir) ----------
  // Sunucu adresi APK'ya gömülüdür, burada değiştirilmez; yalnızca durum, yeniden deneme ve (sunucu isterse) eşleştirme.
  function baglantiBolumu() {
    const kutu = $("#ayarlar .erisim-kutu");
    if (!kutu || kutu.querySelector(".mobil-baglanti")) return;
    const f = document.createElement("fieldset");
    f.className = "erisim-grup mobil-baglanti";
    f.innerHTML = `<legend>Bağlantı</legend>
      <p class="baglanti-durum" role="status"><span class="baglanti-nokta" aria-hidden="true"></span><span class="baglanti-metin"></span></p>
      <label class="katki-alan">Eşleştirme kodu ya da API anahtarı <small>(sunucu istiyorsa)</small>
        <input class="baglanti-anahtar" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="6 haneli kod">
      </label>
      <div class="baglanti-dugmeler">
        <button type="button" class="dugme kucuk baglanti-bagla">Yeniden bağlan</button>
      </div>`;
    kutu.insertBefore(f, $("#ayar-kapat"));
    const metin = f.querySelector(".baglanti-metin");
    const ciz = async () => {
      f.dataset.durum = durum.canli ? "canli" : durum.deneniyor ? "araniyor" : "cevrimdisi";
      if (durum.canli) metin.textContent = `Canlı: ${gorunen(durum.canli)}`;
      else if (!SUNUCU) metin.textContent = "Bu pakette sunucu adresi yok: paketteki verilerle çalışıyor";
      else if (durum.deneniyor) metin.textContent = `${gorunen(SUNUCU)} deneniyor…`;
      else if (durum.anahtarGerekli) metin.textContent = `${gorunen(SUNUCU)} anahtar istiyor: eşleştirme kodu gir`;
      else {
        let tarih = "";
        try { tarih = new Date(await (await yerelApi()).anlikTarihi()).toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); } catch {}
        metin.textContent = `Çevrimdışı: paketteki veriler${tarih ? ` (${tarih})` : ""}`;
      }
    };
    durum.dinleyiciler.add(ciz);
    ciz();
    f.querySelector(".baglanti-bagla").addEventListener("click", async () => {
      if (!SUNUCU) return bildir("Bu pakette sunucu adresi yok.");
      const alan = f.querySelector(".baglanti-anahtar");
      const k = alan.value.trim();
      titret("secim");
      if (/^\d{6}$/.test(k)) {
        try { await eslestir(k); alan.value = ""; bildir("Eşleşti; bu telefon artık sunucuya bağlanabilir."); }
        catch (h) { bildir(`Eşleştirme olmadı: ${h.message}`); return ciz(); }
      } else if (k) { yaz(SAKLI_ANAHTAR, k); alan.value = ""; }
      const onceki = durum.canli;
      if (await dene(5000)) { if (onceki) bildir("Bağlantı yerinde."); else canliOldu(true); }
      else bildir(durum.anahtarGerekli ? "Sunucu anahtar istiyor ya da anahtar geçersiz. Sunucuda eşleştirme kodu üret." : `${gorunen(SUNUCU)} adresine ulaşılamadı. İnternet bağlantını kontrol et.`);
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
      sessiz(P.Share.share({ title: ad, text: [ad, ust, ozet, "Lonca ile keşfet: vakıf eserleri."].filter(Boolean).join("\n\n"), dialogTitle: "Eseri paylaş" }));
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

    // Açılış ekranı: Android'in açılış görselinin yerini aynı logolu web açılış ekranı (kabuk.js) hemen devralır;
    // o, veriler gelince solarak kapanır. Web açılış ekranı yoksa vitrin dolunca (en geç 4 sn) kapanır.
    let kapandi = false;
    const splashKapat = () => { if (kapandi) return; kapandi = true; sessiz(P.SplashScreen?.hide({ fadeOutDuration: 250 })); };
    const liste = $("#moduller");
    if (liste) new MutationObserver((_, o) => { if (liste.childElementCount) { o.disconnect(); requestAnimationFrame(splashKapat); } }).observe(liste, { childList: true });
    setTimeout(splashKapat, 4000);
    if ($("#acilis-ekrani")) requestAnimationFrame(splashKapat);

    // Alt gezinmede dokunuşa hafif titreşim; klavye açıkken alt çubuk gizlenir (Android'de klavyenin üstüne binmesin).
    document.addEventListener("click", (e) => { if (e.target.closest?.("#alt-gezinme button, .pl-anahtar, .pl-satir[role=switch]")) titret("secim"); });
    // Klavye: yazılan alan klavyenin altında kalmasın. Bu kurulumda (SystemBars, insetsHandling: native) WebView
    // klavye açılınca kendiliğinden küçülür; o zaman ek pay gerekmez. Küçülmediyse (tam ekran / kenardan kenara)
    // klavyenin kapladığı yükseklik --klavye olarak CSS'e verilir (alttan sayfalar ve sayfa sonu bu kadar yukarı çıkar).
    // Küçülme klavye olayından önce de sonra da gelebildiği için olaylar arası fark değil, ekran boyuyla kıyas kullanılır;
    // yoksa klavye iki kez düşülür, form ekranın üstüne itilir ve yazılan alan görünmez.
    let klavyeAcik = false, klavyeBoyu = 0;
    const klavyePayi = () => {
      if (!klavyeBoyu) return;
      const ekran = Math.max(innerHeight, Math.round(screen.height || 0));
      const kuculme = ekran - innerHeight; // durum ve gezinme çubukları da dahil; klavye kadar değilse WebView küçülmemiştir
      kok.style.setProperty("--klavye", `${kuculme >= klavyeBoyu * 0.6 ? 0 : klavyeBoyu}px`);
    };
    addEventListener("resize", () => {
      if (!klavyeAcik || !klavyeBoyu) return;
      klavyePayi();
      window.loncaKabuk?.odagiGoster?.();
    });
    sessiz(P.Keyboard?.addListener("keyboardWillShow", () => { klavyeAcik = true; kok.classList.add("klavye-acik"); }));
    sessiz(P.Keyboard?.addListener("keyboardDidShow", (b) => {
      klavyeBoyu = Math.max(1, Math.round(Number(b?.keyboardHeight) || 0));
      klavyePayi();
      window.loncaKabuk?.odagiGoster?.();
    }));
    sessiz(P.Keyboard?.addListener("keyboardWillHide", () => { klavyeAcik = false; klavyeBoyu = 0; kok.classList.remove("klavye-acik"); kok.style.setProperty("--klavye", "0px"); }));

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
  // Paylaşım bağlantısı (https://<alan>/m/<anahtar> ya da lonca://m/<anahtar>) uygulamayı açınca modülü aç.
  // Anahtar window.loncaPaylasim'e de yazılır: uygulama soğuk açılışta olay dinleyicisinden önce gelirse oradan okur.
  const paylasimiIlet = (adres) => {
    const m = String(adres ?? "").match(/^(?:https?:\/\/[^/]+|lonca:\/)\/m\/([A-Za-z0-9_-]{1,64})\/?(?:[?#].*)?$/);
    if (!m) return;
    window.loncaPaylasim = m[1];
    window.dispatchEvent(new CustomEvent("lonca-paylasim", { detail: m[1] }));
  };
  sessiz(P.App?.addListener("appUrlOpen", (o) => paylasimiIlet(o?.url)));
  sessiz(P.App?.getLaunchUrl?.().then((o) => paylasimiIlet(o?.url)));
  sessiz(P.App?.addListener("resume", async () => {
    if (durum.canli) { if (!(await yokla(3000))) koptu(); }
    else if (await dene()) canliOldu(!modulAcik());
  }));
  sessiz(P.Network?.addListener("networkStatusChange", async (s) => {
    if (!s.connected) { if (durum.canli) { baglan(null); bildir("İnternet bağlantısı yok; paketteki verilerle devam ediliyor."); } return; }
    if (!durum.canli && (await dene())) canliOldu(!modulAcik());
  }));

  window.loncaMobil = { durum, sunucu: SUNUCU, dene, titret };
})();
