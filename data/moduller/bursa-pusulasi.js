import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

// Bursa Pusulası: Bursa'yı yürüyüş rotalarıyla gezdiren cep rehberi.
// Her rota birbirine yürüme mesafesindeki gerçek vakıf eserlerinden oluşur; durak durak ilerlenir,
// her durakta eserin fotoğrafları, envanter kaydındaki tarihçesi ve bir sonraki durağa uzaklık görünür.
// Uzaklık ve süreler eserlerin kayıtlı konumlarından hesaplanır (kuş uçuşu, yürüyüş ≈ 75 m/dk).

const SEKMELER = [
  { id: "rotalar", ad: "Rotalar", ikon: "pusula" },
  { id: "harita", ad: "Harita", ikon: "harita" },
  { id: "yakin", ad: "Yakınımda", ikon: "konum" },
  { id: "defter", ad: "Defterim", ikon: "kitap" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };

// Rotalar: yalnızca eser kimlikleri. Sıra açılışta en yakın komşu yöntemiyle kurulur.
const ROTALAR = [
  { id: "carsi", ad: "Hanlar ve Çarşı", alt: "Ulucami'nin çevresindeki hanlar, bedesten ve çarşı", renk: "altin",
    eserler: ["ulucami", "emir-han", "koza-hani", "koza-han-mescidi", "ic-koza-hani", "fidan-hani", "fidan-mahmudpasa-hani-mescidi", "geyve-hani", "ipek-hani", "pirinc-hani", "yildirim-bayezid-bedesteni", "orhan-bey-kulliyesi", "orhan-bey-hamami-aynali-carsi"] },
  { id: "tophane", ad: "Hisar ve Tophane", alt: "Osman Gazi ve Orhan Gazi türbeleri, hisar içindeki camiler", renk: "kobalt",
    eserler: ["osman-gazi-turbesi", "orhan-gazi-turbesi", "sehadet-kale-saray-camii", "kavakli-camii", "hz-uftade-camii", "hz-uftade-turbesi", "molla-gurani-yesil-guranli-turbesi", "sehabettin-pasa-camii", "veled-i-sarayi-mescidi", "sehrekustu-pars-bey-camii", "tavukcu-mescidi"] },
  { id: "muradiye", ad: "Muradiye", alt: "II. Murad Külliyesi ve çevresindeki türbeler", renk: "zumrut",
    eserler: ["ii-murad-kulliyesi", "muradiye-cesmesi", "sehzade-mustafa-turbesi", "besikciler-sinan-dede-camii-ve-haziresi", "azeb-bey-turbesi", "hamza-bey-kulliyesi", "sair-ahmet-pasa-geyikli-medresesi"] },
  { id: "yesil", ad: "Yeşil", alt: "Çelebi Mehmed Külliyesi ve komşu mahalleler", renk: "firuze",
    eserler: ["yesil-celebi-mehmed-kulliyesi", "yesil-turbe", "yesil-sultaniye-medresesi", "yesil-imareti", "sible-camii", "meydancik-camii", "haci-sevindik-camii", "beyazit-pasa-catalcesme-camii", "haci-sevki-efendi-sabaniye-tekkesi", "umur-bey-kulliyesi"] },
  { id: "yildirim", ad: "Emir Sultan ve Yıldırım", alt: "Emir Sultan'dan Yıldırım Bayezid Külliyesi'ne", renk: "murdum",
    eserler: ["emir-sultan-kulliyesi", "mucelliddin-omer-aga-resulzade-camii", "abdullatif-kudsi-turbesi", "davut-kadi-eski-ortayol-camii", "yildirim-medresesi", "yildirim-bayezid-kulliyesi", "yildirim-bayezid-turbesi", "yildirim-darussifasi"] },
  { id: "iznik", ad: "İznik", alt: "Surlar içindeki erken Osmanlı yapıları", renk: "mercan",
    eserler: ["ayasofya-orhan-camii", "haci-ozbek-camii", "esrefzade-camii-minaresi-ve-haziresi", "yesil-imaret-candarli-halil-pasa-camii", "nilufer-hatun-imareti", "suleyman-pasa-medresesi", "haci-hamza-ii-murad-hamami"] },
  { id: "inegol", ad: "İnegöl", alt: "İshak Paşa Külliyesi ve kent merkezindeki camiler", renk: "altin",
    eserler: ["ishak-pasa-kulliyesi", "yildirim-bayezid-cuma-camii", "osmaniye-camasirlik-camii", "hamidiye-altinbas-camii", "hurriyet-sari-camii"] },
  { id: "yenisehir", ad: "Yenişehir", alt: "Sinan Paşa Külliyesi ve çevresi", renk: "zumrut",
    eserler: ["sinan-pasa-kulliyesi", "sinan-pasa-kulliyesi-nde-medrese", "haci-hasan-camii", "murat-pasa-kumluk-camii"] },
];

const BASARIMLAR = [
  { id: "ilk-durak", ad: "İlk Durak", aciklama: "Bir rotada ilk durağı işaretle." },
  { id: "rota-bitti", ad: "Rota Tamam", aciklama: "Bir rotanın bütün duraklarını işaretle." },
  { id: "uc-rota", ad: "Şehir Yürüyücüsü", aciklama: "Üç rotayı bitir." },
  { id: "on-eser", ad: "Gezgin", aciklama: "10 eseri işaretle." },
  { id: "yakin", ad: "Pusulam Yanımda", aciklama: "Yakınındaki eserlere bak." },
  { id: "kartograf", ad: "Kartograf", aciklama: "Haritadan bir esere git." },
];

const YURUYUS_M_DK = 75;
const ADRES_DESENI = /(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/;

export default async function basla() {
  // ---------- Veri ----------
  const bursa = await eserler.liste({ il: "Bursa" });
  const kimlikle = new Map(bursa.map((e) => [e.id, e]));
  const iliskiler = await eserler.iliskiler();
  const rotalar = ROTALAR.map((r) => {
    const liste = r.eserler.map((k) => kimlikle.get(`bursa-${k}`)).filter((e) => e && e.konum);
    const duraklar = enYakinSira(liste);
    let metre = 0;
    for (let i = 1; i < duraklar.length; i++) metre += mesafe(duraklar[i - 1], duraklar[i]);
    const kapak = duraklar.find((e) => e.fotograflar.length) ?? duraklar[0];
    return { ...r, duraklar, metre, kapak };
  }).filter((r) => r.duraklar.length >= 3);
  const konumlu = bursa.filter((e) => e.konum);
  await basarim.tanimla(BASARIMLAR);

  // ---------- Kalıcı kayıt ----------
  const ziyaret = new Set((await depo.oku("ziyaret")) ?? []);
  const kaydet = () => depo.yaz("ziyaret", [...ziyaret]);

  // ---------- Durum ----------
  /** @type {any} */
  const d = { acildi: false, sekme: "rotalar", yigin: [{ ad: "rotalar" }], haritaTur: "hepsi", haritaSecili: null, yakin: null, tamOku: false, rozetler: [] };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => { d.tamOku = false; d.yigin.push({ ad, ...ek }); };

  await sahne.ayarla({ baslik: "Bursa Pusulası", tema: { zemin: "koyu", renk: "altin", yazi: "serif" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    try {
      await isle(olay);
    } catch {
      await sahne.bildir("Bir şeyler ters gitti, tekrar dene.");
    }
    await ciz();
  }

  // ======================================================================
  // Olaylar
  // ======================================================================
  async function isle(olay) {
    if (olay.tur === "sekme") return sekmeyeGec(olay.id);
    if (olay.tur === "sec") {
      if (olay.id === "harita-tur") { d.haritaTur = olay.deger; d.haritaSecili = null; }
      return;
    }
    if (olay.tur !== "dokun") return;
    const id = olay.id;

    if (id === "kapak-rotalar") return sekmeyeGec("rotalar");
    if (id === "kapak-yakin") { await sekmeyeGec("yakin"); return yakinimdakiler(); }
    if (id === "kapak-defter") return sekmeyeGec("defter");
    if (id === "geri") { if (d.yigin.length > 1) d.yigin.pop(); d.tamOku = false; return; }

    if (id.startsWith("rota-")) return git("rota", { rota: rotalar.find((r) => r.id === id.slice(5)) });
    if (id === "rotaya-basla") { const r = ust().rota; return git("durak", { rota: r, sira: ilkZiyaretsiz(r) }); }
    if (id.startsWith("durak-")) { const r = ust().rota; return git("durak", { rota: r, sira: Number(id.slice(6)) }); }
    if (id === "sonraki" || id === "onceki") {
      const u = ust();
      u.sira = Math.max(0, Math.min(u.rota.duraklar.length - 1, u.sira + (id === "sonraki" ? 1 : -1)));
      d.tamOku = false;
      return;
    }
    if (id === "rota-bitir") { d.yigin.pop(); return; }
    if (id === "devam") { d.tamOku = !d.tamOku; return; }
    if (id === "isaretle") return isaretle(simdikiEser());
    if (id === "rota-harita") { const r = ust().rota; await ekran.harita(r.duraklar, { baslik: r.ad, rota: true }); return; }

    if (id === "rota-pin" && olay.eser) { const e = kimlikle.get(olay.eser.id); if (e) git("eser", { eser: e }); return; }
    if (id === "harita") { if (olay.eser) d.haritaSecili = kimlikle.get(olay.eser.id) ?? olay.eser; return; }
    if (id === "secili-ac" && d.haritaSecili) { await basarim.kazan("kartograf"); return git("eser", { eser: d.haritaSecili }); }
    if (id === "yakinim") return yakinimdakiler();
    if (id.startsWith("yakin-")) return git("eser", { eser: kimlikle.get(id.slice(6)) });
    if (id.startsWith("eser:") || id === "eser") {
      const e = olay.eser ? kimlikle.get(olay.eser.id) ?? olay.eser : kimlikle.get(id.slice(5));
      if (e) git("eser", { eser: e });
      return;
    }
    if (id.startsWith("ziyaret-")) { const e = kimlikle.get(id.slice(8)); if (e) git("eser", { eser: e }); return; }

    const e = simdikiEser();
    if (!e) return;
    if (id === "uc") return ucGezisi(e);
    if (id === "hata") { const r = await ekran.duzeltme(e); if (r?.gonderildi) await sahne.bildir("Teşekkürler, editörlere iletildi."); }
  }

  function simdikiEser() {
    const u = ust();
    if (u.ad === "durak") return u.rota.duraklar[u.sira];
    return u.eser ?? null;
  }

  async function sekmeyeGec(sekme) {
    d.acildi = true;
    d.sekme = sekme;
    d.yigin = [{ ad: sekme }];
    d.tamOku = false;
    if (sekme === "defter") d.rozetler = await basarim.liste();
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  function ilkZiyaretsiz(r) {
    const i = r.duraklar.findIndex((e) => !ziyaret.has(e.id));
    return i < 0 ? 0 : i;
  }

  async function isaretle(e) {
    if (!e) return;
    if (ziyaret.has(e.id)) { ziyaret.delete(e.id); await kaydet(); await sahne.bildir("İşaret kaldırıldı."); return; }
    ziyaret.add(e.id);
    await kaydet();
    await profil.puanEkle(10, "Rota durağı");
    await sahne.efekt("yildiz");
    await basarim.kazan("ilk-durak");
    if (ziyaret.size >= 10) await basarim.kazan("on-eser");
    const biten = rotalar.filter((r) => r.duraklar.every((x) => ziyaret.has(x.id)));
    const u = ust();
    if (u.rota && u.rota.duraklar.every((x) => ziyaret.has(x.id))) {
      await basarim.kazan("rota-bitti");
      await profil.puanEkle(40, "Rota bitti");
      await sahne.efekt("konfeti");
      await sahne.bildir(`${u.rota.ad} rotası tamamlandı!`);
    }
    if (biten.length >= 3) await basarim.kazan("uc-rota");
  }

  async function yakinimdakiler() {
    d.yakin = { durum: "bekliyor", liste: [] };
    await ciz();
    try {
      const liste = await eserler.yakindaki({ limit: 12 });
      d.yakin = { durum: "tamam", liste: liste.filter((e) => e.il === "Bursa"), ornek: liste[0]?.ornek_konum };
      await basarim.kazan("yakin");
    } catch {
      d.yakin = { durum: "hata", liste: [] };
    }
  }

  async function ucGezisi(e) {
    if (!(await ekran.ucVarMi(e))) { await sahne.bildir("Bu eser için gerçek 3B görünüm yok."); return; }
    await ekran.uc({ eser: e, baslik: e.ad, duraklar: [
      { odak: "genel", metin: "Eserin bugünkü hâli ve çevresi. Parmağınla çevir, iki parmakla yaklaş." },
      { odak: "ust", metin: "Kuşbakışı: yapının çevresiyle ilişkisi buradan görülür." },
      { odak: "yakin", metin: "Yakından: giriş cephesi ve duvarlar." },
    ] });
  }

  // ======================================================================
  // Ekranlar
  // ======================================================================
  function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const u = ust();
    if (u.ad === "rota") return sahne.ciz(rotaEkrani(u.rota));
    if (u.ad === "durak") return sahne.ciz(durakEkrani(u.rota, u.sira));
    if (u.ad === "eser") return sahne.ciz(eserEkrani(u.eser));
    if (u.ad === "harita") return sahne.ciz(haritaEkrani());
    if (u.ad === "yakin") return sahne.ciz(yakinEkrani());
    if (u.ad === "defter") return sahne.ciz(defterEkrani());
    return sahne.ciz(rotalarEkrani());
  }

  function kapakEkrani() {
    const toplamDurak = rotalar.reduce((t, r) => t + r.duraklar.length, 0);
    return {
      tip: "kapak", ust: "Bursa · Yürüyüş rehberi", baslik: "Bursa Pusulası", renk: "altin",
      eser: kimlikle.get("bursa-ulucami") ?? rotalar[0]?.kapak,
      alt: `${rotalar.length} rota, ${toplamDurak} durak. Hanlar bölgesinden Muradiye'ye, Yeşil'den İznik'e: vakıf eserlerini durak durak yürü, gördüklerini defterine işle.`,
      cocuklar: [
        { tip: "dugme", id: "kapak-rotalar", metin: "Rota seç", ikon: "pusula" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "kapak-yakin", metin: "Yakınımda", ikon: "konum", tur: "ikincil" },
          { tip: "dugme", id: "kapak-defter", metin: ziyaret.size ? `Defter (${ziyaret.size})` : "Defter", ikon: "kitap", tur: "ikincil" },
        ] },
      ],
    };
  }

  function rotalarEkrani() {
    const devam = rotalar.find((r) => r.duraklar.some((e) => ziyaret.has(e.id)) && !r.duraklar.every((e) => ziyaret.has(e.id)));
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Rotalar", alt: `${rotalar.length} yürüyüş · ${ziyaret.size} durak işaretli` },
        ...(devam ? [{ tip: "kart", id: `rota-${devam.id}`, renk: devam.renk, cocuklar: [
          { tip: "baslik", metin: "Kaldığın yerden devam et", boyut: 3 },
          { tip: "metin", metin: `${devam.ad}: ${devam.duraklar.filter((e) => ziyaret.has(e.id)).length}/${devam.duraklar.length} durak` },
        ] }] : []),
        ...rotalar.map((r) => {
          const biten = r.duraklar.filter((e) => ziyaret.has(e.id)).length;
          return { tip: "kart", id: `rota-${r.id}`, renk: r.renk, cocuklar: [
            { tip: "afis", baslik: r.ad, alt: r.alt, eser: r.kapak, renk: r.renk },
            { tip: "cipler", ogeler: [`${r.duraklar.length} durak`, km(r.metre), `≈ ${dakika(r.metre)} dk yürüyüş`, ...(biten === r.duraklar.length ? ["Tamamlandı ✓"] : [])] },
            { tip: "ilerleme", deger: biten, toplam: r.duraklar.length },
          ] };
        }),
      ],
    };
  }

  function rotaEkrani(r) {
    const biten = r.duraklar.filter((e) => ziyaret.has(e.id)).length;
    const turler = [...new Set(r.duraklar.map((e) => TUR_ADI[e.tur] ?? e.tur))];
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: r.ad, alt: r.alt, geri: "geri" },
        { tip: "afis", baslik: r.ad, alt: `${r.duraklar.length} durak · ${km(r.metre)} · ≈ ${dakika(r.metre)} dk`, eser: r.kapak, renk: r.renk },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: r.duraklar.length, etiket: "durak", ikon: "konum" },
          { tip: "istatistik", deger: km(r.metre), etiket: "yürüyüş", ikon: "pusula" },
          { tip: "istatistik", deger: `${biten}/${r.duraklar.length}`, etiket: "işaretli", ikon: "yildiz" },
        ] },
        { tip: "dugme", id: "rotaya-basla", metin: biten && biten < r.duraklar.length ? "Kaldığın duraktan devam et" : "Rotaya başla", ikon: "ok" },
        { tip: "harita", id: "rota-pin", eserler: r.duraklar, rota: true },
        { tip: "cipler", ogeler: turler },
        { tip: "baslik", metin: "Duraklar", boyut: 2 },
        { tip: "liste", ogeler: r.duraklar.map((e, i) => ({
          id: `durak-${i}`, metin: `${i + 1}. ${e.ad}`, ikon: ziyaret.has(e.id) ? "yildiz" : "konum",
          alt: [TUR_ADI[e.tur], e.yuzyil ? `${e.yuzyil}. yüzyıl` : null].filter(Boolean).join(" · "),
          sag: i < r.duraklar.length - 1 ? `${metre(mesafe(e, r.duraklar[i + 1]))} →` : "son",
        })) },
        { tip: "metin", metin: "Uzaklıklar kayıtlı konumlar arasında kuş uçuşu hesaplanır; bazı konumlar yaklaşıktır.", soluk: true },
      ],
    };
  }

  function durakEkrani(r, sira) {
    const e = r.duraklar[sira];
    const sonraki = r.duraklar[sira + 1];
    const son = sira === r.duraklar.length - 1;
    const isaretli = ziyaret.has(e.id);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Durak ${sira + 1}/${r.duraklar.length}`, alt: r.ad, geri: "geri", sag: [{ id: "rota-harita", ikon: "harita", etiket: "Rotayı haritada gör" }] },
        { tip: "ilerleme", deger: sira + 1, toplam: r.duraklar.length },
        { tip: "fotograflar", eser: e },
        { tip: "baslik", metin: e.ad, boyut: 1 },
        { tip: "cipler", ogeler: [TUR_ADI[e.tur] ?? e.tur, e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor", e.ilce ?? "Bursa"] },
        ...tarihceDugumleri(e),
        ...bagDugumleri(e),
        { tip: "dugme", id: "isaretle", metin: isaretli ? "Defterimde ✓ (kaldır)" : "Burayı gördüm, defterime işle", ikon: isaretli ? "yildiz" : "kitap", tur: isaretli ? "ikincil" : "ana" },
        sonraki
          ? { tip: "kart", id: "sonraki", renk: r.renk, cocuklar: [
            { tip: "metin", metin: "Sıradaki durak", soluk: true },
            { tip: "eser", eser: sonraki, id: "sonraki", boyut: "satir" },
            { tip: "cipler", ogeler: [metre(mesafe(e, sonraki)), `≈ ${dakika(mesafe(e, sonraki))} dk yürüyüş`] },
          ] }
          : { tip: "dugme", id: "rota-bitir", metin: "Rotayı bitir", ikon: "kupa", tur: "ikincil" },
        { tip: "satir", hizala: "yay", cocuklar: [
          { tip: "dugme", id: "onceki", metin: "Önceki", ikon: "geri", tur: "hayalet", devre_disi: sira === 0 },
          { tip: "dugme", id: son ? "rota-bitir" : "sonraki", metin: son ? "Bitir" : "Sonraki", ikon: "ok", tur: "hayalet" },
        ] },
        { tip: "metin", metin: e.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function eserEkrani(e) {
    const isaretli = ziyaret.has(e.id);
    const rota = rotalar.find((r) => r.duraklar.some((x) => x.id === e.id));
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [TUR_ADI[e.tur], e.ilce].filter(Boolean).join(" · "), geri: "geri" },
        { tip: "fotograflar", eser: e },
        { tip: "cipler", ogeler: [TUR_ADI[e.tur] ?? e.tur, e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor", e.ilce ?? "Bursa"] },
        ...tarihceDugumleri(e),
        ...(e.adres ? [{ tip: "metin", metin: `Adres: ${e.adres}`, soluk: true }] : []),
        ...(e.konum ? [{ tip: "harita", id: "eser-konum", eserler: [e], secili: e.id }] : []),
        ...bagDugumleri(e),
        { tip: "dugme", id: "isaretle", metin: isaretli ? "Defterimde ✓ (kaldır)" : "Burayı gördüm, defterime işle", ikon: isaretli ? "yildiz" : "kitap", tur: isaretli ? "ikincil" : "ana" },
        ...(rota ? [{ tip: "dugme", id: `rota-${rota.id}`, metin: `Bu eser "${rota.ad}" rotasında`, ikon: "pusula", tur: "ikincil" }] : []),
        { tip: "dugme", id: "uc", metin: "Gerçek 3B gez", ikon: "kup", tur: "hayalet" },
        { tip: "metin", metin: e.kaynak, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
      ],
    };
  }

  function haritaEkrani() {
    const turler = [...new Set(konumlu.map((e) => e.tur))];
    const sayi = (t) => konumlu.filter((e) => e.tur === t).length;
    const secenekler = [{ id: "hepsi", metin: "Hepsi" }, ...turler.sort((a, b) => sayi(b) - sayi(a)).slice(0, 7).map((t) => ({ id: t, metin: TUR_ADI[t] ?? t }))];
    const liste = d.haritaTur === "hepsi" ? konumlu : konumlu.filter((e) => e.tur === d.haritaTur);
    const s = d.haritaSecili;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Harita", alt: `${liste.length} eser · bir pine dokun` },
        { tip: "secenekler", id: "harita-tur", secenekler, secili: d.haritaTur },
        { tip: "harita", id: "harita", eserler: liste, secili: s?.id },
        s
          ? { tip: "kart", id: "secili-ac", cocuklar: [
            { tip: "eser", eser: s, id: "secili-ac", boyut: "satir" },
            { tip: "metin", metin: ilkCumle(s), soluk: true },
            { tip: "dugme", id: "secili-ac", metin: "Eseri aç", ikon: "ok" },
          ] }
          : { tip: "metin", metin: "Pinlerden birine dokun; eserin kısa bilgisi burada belirir.", soluk: true, ortali: true },
      ],
    };
  }

  function yakinEkrani() {
    const y = d.yakin;
    const ustCubuk = { tip: "ust_cubuk", baslik: "Yakınımda", alt: "Konumun yalnızca bu sorgu için kullanılır" };
    if (!y) return { tip: "sutun", cocuklar: [ustCubuk,
      { tip: "metin", metin: "Bulunduğun yere en yakın vakıf eserlerini ve yürüme mesafelerini gösterir.", ortali: true },
      { tip: "dugme", id: "yakinim", metin: "Yakınımdakileri bul", ikon: "konum" }] };
    if (y.durum === "bekliyor") return { tip: "sutun", cocuklar: [ustCubuk, { tip: "metin", metin: "Konumun alınıyor…", ortali: true }] };
    if (y.durum === "hata" || !y.liste.length) return { tip: "sutun", cocuklar: [ustCubuk,
      { tip: "metin", metin: "Konum alınamadı ya da yakında kayıtlı eser yok.", ortali: true },
      { tip: "dugme", id: "yakinim", metin: "Tekrar dene", ikon: "tekrar" }] };
    return {
      tip: "sutun", cocuklar: [
        ustCubuk,
        ...(y.ornek ? [{ tip: "metin", metin: "Konumuna ulaşılamadı; uzaklıklar Bursa merkezine göre.", soluk: true }] : []),
        { tip: "harita", id: "harita", eserler: y.liste },
        { tip: "liste", ogeler: y.liste.map((e) => ({
          id: `yakin-${e.id}`, metin: e.ad, ikon: ziyaret.has(e.id) ? "yildiz" : "konum",
          alt: [TUR_ADI[e.tur], e.ilce].filter(Boolean).join(" · "), sag: metre(e.mesafe_m ?? 0),
        })) },
        { tip: "dugme", id: "yakinim", metin: "Yenile", ikon: "tekrar", tur: "hayalet" },
      ],
    };
  }

  function defterEkrani() {
    const ziyaretler = [...ziyaret].map((k) => kimlikle.get(k)).filter(Boolean);
    const biten = rotalar.filter((r) => r.duraklar.every((e) => ziyaret.has(e.id))).length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Gezi defterim", alt: "Gördüğün eserler ve rozetlerin" },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: ziyaret.size, etiket: "eser", ikon: "kitap" },
          { tip: "istatistik", deger: `${biten}/${rotalar.length}`, etiket: "rota", ikon: "pusula" },
          { tip: "istatistik", deger: d.rozetler.filter((b) => b.kazanildi).length, etiket: "rozet", ikon: "kupa" },
        ] },
        { tip: "baslik", metin: "Rotalarım", boyut: 2 },
        ...rotalar.map((r) => ({ tip: "ilerleme", deger: r.duraklar.filter((e) => ziyaret.has(e.id)).length, toplam: r.duraklar.length, etiket: r.ad })),
        { tip: "baslik", metin: "Gördüklerim", boyut: 2 },
        ziyaretler.length
          ? { tip: "liste", ogeler: ziyaretler.map((e) => ({ id: `ziyaret-${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], e.ilce].filter(Boolean).join(" · "), ikon: "yildiz" })) }
          : { tip: "metin", metin: "Henüz bir durak işaretlemedin. Bir rota seç, gördüğün eserleri defterine işle.", soluk: true },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
      ],
    };
  }

  // ---------- Parçalar ----------
  function tarihceDugumleri(e) {
    const p = paragraflar(e);
    if (!p.length) return [{ tip: "metin", metin: "Bu eserin kaydında tarihçe yok.", soluk: true }];
    const gorunen = d.tamOku ? p : p.slice(0, 2);
    return [
      ...gorunen.map((m) => ({ tip: "metin", metin: m })),
      ...(p.length > 2 ? [{ tip: "dugme", id: "devam", metin: d.tamOku ? "Daha az göster" : `Devamını oku (${p.length - 2} paragraf)`, tur: "hayalet", ikon: "kitap" }] : []),
    ];
  }

  function bagDugumleri(e) {
    const baglar = iliskiler.filter((i) => i.a === e.id || i.b === e.id)
      .map((i) => ({ i, diger: kimlikle.get(i.a === e.id ? i.b : i.a) })).filter((x) => x.diger);
    if (!baglar.length) return [];
    return [
      { tip: "baslik", metin: "Bağlantılı eserler", boyut: 3 },
      { tip: "graf", id: "bag", merkez: e, iliskiler: baglar.map(({ i, diger }) => ({ eser: diger, tur: i.tur, baslik: i.baslik, aciklama: i.aciklama, kaynak: i.kaynak })) },
    ];
  }
}

// ---------- Yardımcılar ----------
function paragraflar(e) {
  const p = String(e.tarihce?.tr ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  // İlk paragraf yalnızca adres anlatıyorsa (kart zaten gösteriyor) atla.
  if (p.length > 1 && p[0].length < 220 && ADRES_DESENI.test(p[0])) p.shift();
  return p;
}

function ilkCumle(e) {
  const p = paragraflar(e)[0] ?? "";
  const c = p.split(/(?<=[.!?])\s+/)[0] ?? "";
  return c.length > 200 ? `${c.slice(0, 199)}…` : c;
}

function mesafe(a, b) {
  if (!a?.konum || !b?.konum) return 0;
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.konum.lat - a.konum.lat) * r, dLng = (b.konum.lng - a.konum.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.konum.lat * r) * Math.cos(b.konum.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function enYakinSira(liste) {
  if (!liste.length) return [];
  const kalan = liste.slice(1), sira = [liste[0]];
  while (kalan.length) {
    const son = sira[sira.length - 1];
    let en = 0;
    for (let i = 1; i < kalan.length; i++) if (mesafe(son, kalan[i]) < mesafe(son, kalan[en])) en = i;
    sira.push(kalan.splice(en, 1)[0]);
  }
  return sira;
}

const metre = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const km = (m) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const dakika = (m) => Math.max(1, Math.round(m / YURUYUS_M_DK));
