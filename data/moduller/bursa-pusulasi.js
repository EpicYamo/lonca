import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";

// ============================================================================
// ============================================================================

const SEKMELER = [
  { id: "kesfet", ad: "Keşfet", ikon: "pusula" },
  { id: "harita", ad: "Harita", ikon: "harita" },
  { id: "oyun", ad: "Oyun", ikon: "oyun" },
  { id: "koleksiyon", ad: "Koleksiyon", ikon: "kupa" },
];

const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil", diger: "Diğer" };
const ALAN_ADI = { ad: "Ad", tur: "Tür", il: "İl", ilce: "İlçe", yuzyil: "Yüzyıl", konum: "Konum", adres: "Adres", tarihce: "Tarihçe" };

const SOZLUK = [
  { id: "s-kubbe", metin: "Kubbe", alt: "Yapının üstünü örten yarım küre biçimli örtü." },
  { id: "s-revak", metin: "Revak", alt: "Kemerli, üstü örtülü, bir yanı açık geçit." },
  { id: "s-kitabe", metin: "Kitabe", alt: "Yapıyı kimin, ne zaman yaptırdığını anlatan yazıt." },
  { id: "s-hazire", metin: "Hazire", alt: "Cami ya da türbe yanındaki küçük mezarlık." },
  { id: "s-kulliye", metin: "Külliye", alt: "Cami çevresinde medrese, imaret, hamam gibi yapılardan oluşan bütün." },
  { id: "s-vakif", metin: "Vakıf", alt: "Bir malın gelirinin kalıcı olarak hayra ayrılması; bu eserlerin çoğu vakıfla yaşamıştır." },
];

const BASARIMLAR = [
  { id: "ilk-adim", ad: "İlk Adım", aciklama: "Bir eserin sayfasını aç." },
  { id: "gezgin-10", ad: "Şehir Gezgini", aciklama: "10 farklı eser incele." },
  { id: "favori", ad: "Gönül Bağı", aciklama: "Bir eseri favorilerine ekle." },
  { id: "kartograf", ad: "Kartograf", aciklama: "Haritadan bir eser seç." },
  { id: "komsu", ad: "Komşu", aciklama: "Yakınındaki eserlere bak." },
  { id: "sozlukcu", ad: "Kavram Avcısı", aciklama: "Mimari sözlüğü aç." },
  { id: "bilge", ad: "Bilge", aciklama: "Bir eserin yüzyılını ilk denemede bil." },
  { id: "seri-5", ad: "Alev Serisi", aciklama: "Oyunda üst üste 5 doğru." },
  { id: "kusursuz", ad: "Kusursuz", aciklama: "Bir oyunu hatasız bitir." },
  { id: "katki", ad: "Gönüllü Editör", aciklama: "Bir eser için hata bildir." },
];

const SAYFA_BOYU = 12;
const OYUN_TUR = 6;
const OYUN_SURE = { yuzyil: 15, eski: 10 };

export default async function basla() {
  const hepsi = await eserler.liste({ il: "Bursa" });
  const fotografli = hepsi.filter((e) => e.fotograflar.length);
  const konumlu = hepsi.filter((e) => e.konum);
  const yuzyilli = hepsi.filter((e) => e.yuzyil && e.fotograflar.length);
  const tamSayisi = (await eserler.liste({ il: "Bursa", tam: true })).length;
  const turSayilari = {};
  for (const e of hepsi) turSayilari[e.tur] = (turSayilari[e.tur] ?? 0) + 1;
  const TUR_SECENEKLERI = [{ id: "hepsi", metin: "Hepsi" },
    ...Object.entries(turSayilari).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => ({ id: t, metin: `${TUR_ADI[t] ?? t} (${n})` }))];
  const haritaTurleri = [{ id: "hepsi", metin: "Hepsi" },
    ...[...new Set(konumlu.map((e) => e.tur))].map((t) => ({ id: t, metin: TUR_ADI[t] ?? t }))];
  const gun = Math.floor(Date.now() / 86_400_000);
  const oneCikanlar = Object.keys(turSayilari).map((t) => {
    const aday = fotografli.filter((e) => e.tur === t && e.yuzyil);
    return aday.length ? aday[gun % aday.length] : null;
  }).filter(Boolean).slice(0, 8);
  await basarim.tanimla(BASARIMLAR);

  const incelenen = new Set((await depo.oku("incelenen")) ?? []);
  const favoriler = new Set((await depo.oku("favoriler")) ?? []);
  const rekorlar = (await depo.oku("rekorlar")) ?? { yuzyil: 0, eski: 0 };
  const tahminEdilen = new Set((await depo.oku("tahmin")) ?? []); // "Bilge": her esere tek ilk deneme
  const kaydet = async () => {
    await depo.yaz("tahmin", [...tahminEdilen]);
    await depo.yaz("incelenen", [...incelenen]);
    await depo.yaz("favoriler", [...favoriler]);
    await depo.yaz("rekorlar", rekorlar);
  };

  // ---------- Durum ----------
  /** @type {any} */
  const d = {
    acildi: false,                 
    sekme: "kesfet",
    yigin: [{ ad: "kesfet" }],      
    arama: "", tur: "hepsi", sadeceTam: false, sayfa: 1, sonuclar: hepsi,
    haritaTur: "hepsi", haritaSecili: null,
    yakin: null,                   // { durum: "bekliyor" | "tamam" | "hata", liste: Eser[] }
    oyun: null,                    // { mod, sorular, sira, puan, dogru, seri, enUzun, cevap, bitti, yeniRekor }
    rozetler: await basarim.liste(),
    profil: await profil.bilgi(),
  };
  const ust = () => d.yigin[d.yigin.length - 1];
  const git = (ad, ek = {}) => d.yigin.push({ ad, ...ek });
  const geri = () => { if (d.yigin.length > 1) d.yigin.pop(); };

  await sahne.ayarla({ baslik: "Bursa Pusulası", tema: { zemin: "koyu", renk: "altin", yazi: "serif" } });
  await ciz();

  // ======================================================================
  // ======================================================================
  for await (const olay of sahne.olaylar()) {
    try {
      await isle(olay);
    } catch (h) {
      await sahne.bildir("Bir şeyler ters gitti, tekrar dene.");
    }
    await ciz();
  }

  async function isle(olay) {
    if (olay.tur === "sekme") { d.sekme = olay.id; d.yigin = [{ ad: olay.id }]; if (olay.id === "koleksiyon") await koleksiyonuTazele(); return; }
    if (olay.tur === "sure") { if (d.oyun && !d.oyun.cevap) await oyunCevap(-1); return; }
    if (olay.tur === "gonder" && olay.id === "ara") { d.arama = olay.deger.trim(); d.sayfa = 1; await sonuclariGuncelle(); return; }
    if (olay.tur === "sec") {
      if (olay.id === "tur") { d.tur = olay.deger; d.sayfa = 1; await sonuclariGuncelle(); }
      if (olay.id === "tamlik") { d.sadeceTam = olay.deger === "tam"; d.sayfa = 1; await sonuclariGuncelle(); }
      if (olay.id === "harita-tur") { d.haritaTur = olay.deger; d.haritaSecili = null; }
      return;
    }
    if (olay.tur !== "dokun") return;

    const id = olay.id;
    // Kapak
    if (id === "basla") return acil("kesfet");
    if (id === "gunun-eseri") { await acil("kesfet"); return eserAc(gununEseri()); }
    if (id === "meydan") return acil("oyun");
    // Genel gezinme
    if (id === "geri") { geri(); return; }
    if (id === "eser" && olay.eser) return eserAc(olay.eser);
    if (id === "daha") { d.sayfa++; return; }
    if (id === "sozluk") { await kazan("sozlukcu"); return git("sozluk"); }
    if (id.startsWith("s-")) return;
    if (id.startsWith("yakin-")) return eserAc(d.yakin?.liste.find((x) => `yakin-${x.id}` === id));
    const e = ust().eser;
    if (id === "favori" && e) return favoriDegistir(e);
    if (id === "uc" && e) return ucGezisi(e);
    if (id === "soru" && e) return eserSorusu(e);
    if (id === "hata" && e) { const r = await ekran.duzeltme(e); if (r?.gonderildi) await kazan("katki"); return; }
    if (id === "haritada" && e) { d.haritaSecili = e; d.haritaTur = "hepsi"; return sekmeyeGec("harita"); }
    if (id === "harita") { if (olay.eser) { d.haritaSecili = olay.eser; await kazan("kartograf"); } return; }
    if (id === "yakinim") return yakinimdakiler();
    if (id === "secili-ac" && d.haritaSecili) return eserAc(d.haritaSecili);
    // Oyun
    if (id === "oyun-yuzyil") return oyunKur("yuzyil");
    if (id === "oyun-eski") return oyunKur("eski");
    if (id.startsWith("sik-") && d.oyun && !d.oyun.cevap) return oyunCevap(Number(id.slice(4)));
    if (id === "sonraki" && d.oyun) return oyunIlerle();
    if (id === "oyun-cik") { d.oyun = null; d.yigin = [{ ad: "oyun" }]; return; }
  }

  async function acil(sekme) {
    d.acildi = true;
    await sekmeyeGec(sekme);
  }
  async function sekmeyeGec(sekme) {
    d.sekme = sekme;
    d.yigin = [{ ad: sekme }];
    await sahne.ayarla({ sekmeler: SEKMELER, sekme });
  }

  // ======================================================================
  // Eylemler
  // ======================================================================
  async function sonuclariGuncelle() {
    const secenek = { il: "Bursa" };
    if (d.tur !== "hepsi") secenek.tur = d.tur;
    if (d.arama) secenek.ad = d.arama;
    if (d.sadeceTam) secenek.tam = true;
    d.sonuclar = await eserler.liste(secenek);
  }

  async function eserAc(e) {
    if (!e) return;
    git("eser", { eser: e, foto: 0, uc: await ekran.ucVarMi(e) });
    const yeni = !incelenen.has(e.id);
    incelenen.delete(e.id); incelenen.add(e.id); 
    await kaydet();
    if (yeni) await profil.puanEkle(5, "Yeni eser");
    await kazan("ilk-adim");
    if (incelenen.size >= 10) await kazan("gezgin-10");
  }

  async function favoriDegistir(e) {
    if (favoriler.has(e.id)) { favoriler.delete(e.id); await sahne.bildir("Favorilerden çıkarıldı"); }
    else { favoriler.add(e.id); await sahne.efekt("yildiz"); await kazan("favori"); }
    await kaydet();
  }

  async function ucGezisi(e) {
    await ekran.uc({
      eser: e, baslik: e.ad,
      duraklar: [
        { odak: "genel", metin: "Eserin bugünkü hâli ve çevresi. Parmağınla çevir, iki parmakla yaklaş." },
        { odak: "yakin", metin: "Yakından: cephe ve çatı örtüsü." },
        { odak: "ust", baslik: "Kuşbakışı", metin: "Yukarıdan bakınca yapının planı ve çevresiyle ilişkisi görünür." },
      ],
    });
  }

  async function eserSorusu(e) {
    const secenekler = eserler.yuzyilSecenekleri(e, 4);
    if (!secenekler.length) return sahne.bildir("Bu eserin yapım yüzyılı kayıtlarda yok.");
    const ilkDeneme = !tahminEdilen.has(e.id);
    const c = await ekran.soru(`${e.ad} kaçıncı yüzyılda yapılmış olabilir?`, secenekler);
    if (c.dogru == null) return; 
    tahminEdilen.add(e.id); await kaydet();
    if (c.dogru) {
      await sahne.efekt("konfeti");
      if (ilkDeneme) { await kazan("bilge"); await profil.puanEkle(10, "Doğru tahmin"); }
      else await sahne.bildir("Doğru! Puan yalnızca ilk denemede verilir.");
    } else await sahne.efekt("titre");
  }

  async function kazan(id) {
    if (await basarim.kazan(id)) d.rozetler = await basarim.liste();
  }
  async function koleksiyonuTazele() {
    d.rozetler = await basarim.liste();
    d.profil = await profil.bilgi();
  }

  function gununEseri() {
    const tam = fotografli.filter((e) => e.yuzyil && e.tarihce?.tr);
    const havuz = tam.length ? tam : fotografli;
    return havuz[gun % Math.max(1, havuz.length)];
  }

  async function yakinimdakiler() {
    d.yakin = { durum: "bekliyor", liste: [] };
    git("yakin");
    await ciz();
    try {
      d.yakin = { durum: "tamam", liste: await eserler.yakindaki({ limit: 8 }) };
      await kazan("komsu");
    } catch {
      d.yakin = { durum: "hata", liste: [] };
    }
  }
  function mesafeYazi(m) {
    return m == null ? "" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  }

  function benzerler(e) {
    return fotografli.filter((x) => x.id !== e.id && x.tur === e.tur)
      .sort((a, b) => Number(b.ilce === e.ilce) - Number(a.ilce === e.ilce)).slice(0, 8);
  }

  // ---------- Oyunlar ----------
  async function oyunKur(mod) {
    let sorular;
    if (mod === "yuzyil") {
      sorular = eserler.karistir(yuzyilli).slice(0, OYUN_TUR).map((eser) => ({ eser, secenekler: eserler.yuzyilSecenekleri(eser, 4) }));
    } else {
      const havuz = eserler.karistir(yuzyilli);
      sorular = [];
      for (let i = 0; i + 1 < havuz.length && sorular.length < OYUN_TUR; i += 2) {
        const [a, b] = [havuz[i], havuz[i + 1]];
        if (a.yuzyil === b.yuzyil) continue;
        sorular.push({ ikili: [a, b], dogruIndeks: a.yuzyil < b.yuzyil ? 0 : 1 });
      }
    }
    d.oyun = { mod, sorular, sira: 0, puan: 0, dogru: 0, seri: 0, enUzun: 0, cevap: null, bitti: false, yeniRekor: false };
    git("oyun-tur");
  }

  async function oyunCevap(i) {
    const o = d.oyun, s = o.sorular[o.sira];
    const dogru = i >= 0 && (o.mod === "yuzyil" ? !!s.secenekler[i]?.dogru : i === s.dogruIndeks);
    o.cevap = { secim: i, dogru };
    if (dogru) {
      o.dogru++; o.seri++; o.enUzun = Math.max(o.enUzun, o.seri);
      o.puan += 10 + Math.min(o.seri - 1, 4) * 3;
      await sahne.efekt("yildiz");
      if (o.seri === 5) await kazan("seri-5");
    } else {
      o.seri = 0;
      await sahne.efekt("titre");
    }
  }

  async function oyunIlerle() {
    const o = d.oyun;
    o.sira++; o.cevap = null;
    if (o.sira < o.sorular.length) return;
    o.bitti = true;
    o.yeniRekor = o.puan > (rekorlar[o.mod] ?? 0);
    if (o.yeniRekor) rekorlar[o.mod] = o.puan;
    await kaydet();
    await profil.puanEkle(Math.round(o.puan / 3), "Oyun");
    if (o.dogru === o.sorular.length) { await kazan("kusursuz"); await sahne.efekt("konfeti"); }
    d.yigin = [{ ad: "oyun" }, { ad: "oyun-sonuc" }];
  }

  // ======================================================================
  // ======================================================================
  async function ciz() {
    if (!d.acildi) return sahne.ciz(kapakEkrani());
    const ekranlar = {
      kesfet: kesfetEkrani, eser: () => eserEkrani(ust().eser), sozluk: sozlukEkrani,
      harita: haritaEkrani, yakin: yakinEkrani,
      oyun: oyunLobisi, "oyun-tur": oyunTurEkrani, "oyun-sonuc": oyunSonucEkrani,
      koleksiyon: koleksiyonEkrani,
    };
    return sahne.ciz((ekranlar[ust().ad] ?? kesfetEkrani)());
  }

  function kapakEkrani() {
    const kapak = hepsi.find((e) => /ulucami/i.test(e.ad) && e.fotograflar.length) ?? fotografli[0];
    return {
      tip: "kapak", ust: "Lonca · Bursa", baslik: "Bursa Pusulası", eser: kapak, renk: "altin",
      alt: `${hepsi.length} vakıf eseri, ${fotografli.length} tanesi fotoğraflı. Keşfet, yakınındakileri bul, yarış; gördüğün her eser koleksiyonuna eklensin.`,
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Keşfe başla", ikon: "pusula" },
        { tip: "satir", cocuklar: [
          { tip: "dugme", id: "gunun-eseri", metin: "Günün eseri", ikon: "yildiz", tur: "ikincil" },
          { tip: "dugme", id: "meydan", metin: "Meydan oku", ikon: "oyun", tur: "ikincil" },
        ] },
      ],
    };
  }

  function kesfetEkrani() {
    const gosterilen = d.sonuclar.slice(0, d.sayfa * SAYFA_BOYU);
    const gun = gununEseri();
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Keşfet", alt: `${incelenen.size} eser incelendi`, sag: [{ id: "sozluk", ikon: "kitap", etiket: "Mimari sözlük" }] },
        { tip: "kart", id: "eser-gun", renk: "altin", cocuklar: [
          { tip: "satir", hizala: "yay", cocuklar: [{ tip: "baslik", metin: "Günün eseri", boyut: 3 }, { tip: "cipler", ogeler: [TUR_ADI[gun.tur] ?? "Eser"] }] },
          { tip: "eser", eser: gun, id: "eser", boyut: "satir" },
        ] },
        { tip: "baslik", metin: "Öne çıkanlar", boyut: 2 },
        { tip: "kaydirma", cocuklar: oneCikanlar.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "buyuk" })) },
        { tip: "baslik", metin: "Bütün eserler", boyut: 2 },
        { tip: "girdi", id: "ara", ipucu: "Eser adı ara (ör. han, Yeşil)", deger: d.arama, dugme: "Ara" },
        { tip: "secenekler", id: "tur", secenekler: TUR_SECENEKLERI, secili: d.tur },
        { tip: "secenekler", id: "tamlik", secili: d.sadeceTam ? "tam" : "hepsi", secenekler: [
          { id: "hepsi", metin: `Hepsi` }, { id: "tam", metin: `Bilgisi tam (${tamSayisi})` }] },
        d.sonuclar.length
          ? { tip: "izgara", sutun: 2, cocuklar: gosterilen.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) }
          : { tip: "kart", cocuklar: [{ tip: "metin", metin: "Bu süzgeçlere uyan eser yok. Aramayı ya da türü değiştirmeyi dene.", ortali: true }] },
        gosterilen.length < d.sonuclar.length
          ? { tip: "dugme", id: "daha", metin: `Daha fazla göster (${d.sonuclar.length - gosterilen.length})`, tur: "ikincil" }
          : { tip: "metin", metin: `${d.sonuclar.length} eser`, soluk: true, ortali: true },
      ],
    };
  }

  function eserEkrani(e) {
    const t = eserler.tamlik(e);
    const paragraflar = e.tarihce.tr.split(/\n+/).filter(Boolean)
      .filter((p, i) => !(i === 0 && e.adres && p.length < 220 && /(Caddesi|Sokak|Mahallesi|No:|yer almaktadır|bulunmaktadır)/.test(p)));
    const benzer = benzerler(e);
    const bilinen = eserler.TEMEL_ALANLAR.filter((a) => !t.eksikler.includes(a));
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: e.ad, alt: [TUR_ADI[e.tur], e.ilce].filter(Boolean).join(" · "), geri: "geri",
          sag: [{ id: "favori", ikon: "kalp", etiket: favoriler.has(e.id) ? "Favorilerden çıkar" : "Favorilere ekle" }] },
        { tip: "fotograflar", eser: e },
        { tip: "cipler", ogeler: [
          e.yuzyil ? `${e.yuzyil}. yüzyıl` : "Yapım tarihi bilinmiyor",
          favoriler.has(e.id) ? "♥ Favori" : null,
          e.konum ? (e.konum.yaklasik ? "Konum yaklaşık" : "Konum biliniyor") : "Konum yok",
        ].filter(Boolean) },
        ...(ust().uc ? [{ tip: "dugme", id: "uc", metin: "Gerçek 3B'de gez", ikon: "kup" }] : []),
        { tip: "izgara", sutun: 2, cocuklar: [
          { tip: "dugme", id: "soru", metin: "Yüzyılı tahmin et", ikon: "soru", tur: "ikincil", devre_disi: !e.yuzyil },
          { tip: "dugme", id: "haritada", metin: "Haritada gör", ikon: "konum", tur: "ikincil", devre_disi: !e.konum },
        ] },
        ...paragraflar.slice(0, 5).map((p) => ({ tip: "metin", metin: p })),
        { tip: "kart", cocuklar: [
          { tip: "baslik", metin: "Bilgi kartı", boyut: 3 },
          { tip: "ilerleme", deger: bilinen.length, toplam: eserler.TEMEL_ALANLAR.length, etiket: "Kayıtlı bilgiler" },
          { tip: "metin", metin: t.tam ? "Bu eserin bütün temel bilgileri kayıtlı." : `Eksik: ${t.eksikler.map((a) => ALAN_ADI[a] ?? a).join(", ")}. Biliyorsan editörlere bildirebilirsin.`, soluk: true },
          e.adres ? { tip: "metin", metin: `Adres: ${e.adres}` } : { tip: "bosluk" },
        ] },
        { tip: "metin", metin: `Kaynak: ${e.kaynak}`, soluk: true },
        { tip: "dugme", id: "hata", metin: "Bir hata mı gördün? Bildir", ikon: "bilgi", tur: "hayalet" },
        ...(benzer.length ? [
          { tip: "baslik", metin: `Benzer eserler · ${TUR_ADI[e.tur] ?? "Eser"}`, boyut: 3 },
          { tip: "kaydirma", cocuklar: benzer.map((x) => ({ tip: "eser", eser: x, id: "eser", boyut: "kucuk" })) },
        ] : []),
      ],
    };
  }

  function sozlukEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Mimari sözlük", alt: "Eserleri okurken işe yarar", geri: "geri" },
        { tip: "liste", ogeler: SOZLUK.map((s) => ({ ...s, ikon: "kitap" })) },
      ],
    };
  }

  function haritaEkrani() {
    const liste = konumlu.filter((e) => d.haritaTur === "hepsi" || e.tur === d.haritaTur);
    const s = d.haritaSecili;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Harita", alt: `${liste.length} eser · konumlar yaklaşık olabilir` },
        { tip: "dugme", id: "yakinim", metin: "Yakınımdaki eserler", ikon: "konum" },
        { tip: "secenekler", id: "harita-tur", secenekler: haritaTurleri, secili: d.haritaTur },
        { tip: "harita", id: "harita", eserler: liste, secili: s?.id },
        s
          ? { tip: "kart", renk: "altin", cocuklar: [
              { tip: "eser", eser: s, id: "eser", boyut: "satir" },
              { tip: "dugme", id: "secili-ac", metin: "Eserin sayfasını aç", ikon: "bilgi", tur: "ikincil" },
            ] }
          : { tip: "kart", cocuklar: [{ tip: "metin", metin: "Bir pine dokun, eserin özeti burada belirsin.", ortali: true }] },
        { tip: "metin", metin: `Haritada yalnızca konumu kayıtlı eserler var (${konumlu.length}/${hepsi.length}). Konumu bilinen bir eseri editörlere bildirebilirsin.`, soluk: true },
      ],
    };
  }

  function yakinEkrani() {
    const y = d.yakin ?? { durum: "bekliyor", liste: [] };
    const ust = { tip: "ust_cubuk", baslik: "Yakınımdakiler", alt: "Konumun yalnızca bu sorgu için kullanılır", geri: "geri" };
    if (y.durum === "bekliyor") return { tip: "sutun", cocuklar: [ust, { tip: "kart", cocuklar: [{ tip: "metin", metin: "Konumun soruluyor…", ortali: true }] }] };
    if (y.durum === "hata" || !y.liste.length) return { tip: "sutun", cocuklar: [ust,
      { tip: "kart", cocuklar: [
        { tip: "baslik", metin: "Konumuna ulaşılamadı", boyut: 3 },
        { tip: "metin", metin: "Konum izni vermediysen ya da cihazın konumu bilmiyorsa yakındaki eserler gösterilemez. Haritadan da gezebilirsin." },
        { tip: "dugme", id: "yakinim", metin: "Tekrar dene", ikon: "tekrar", tur: "ikincil" },
      ] }] };
    const ornek = y.liste[0]?.ornek_konum;
    return {
      tip: "sutun", cocuklar: [
        ust,
        ornek ? { tip: "kart", renk: "mercan", cocuklar: [{ tip: "metin", metin: "Konumuna ulaşılamadı (izin verilmedi ya da cihaz bilmiyor). Uzaklıklar Bursa merkezine göre gösteriliyor." }] } : { tip: "bosluk" },
        { tip: "harita", id: "harita", eserler: y.liste },
        { tip: "liste", ogeler: y.liste.map((e) => ({ id: `yakin-${e.id}`, metin: e.ad, alt: [TUR_ADI[e.tur], e.yuzyil ? `${e.yuzyil}. yüzyıl` : null].filter(Boolean).join(" · "), ikon: "konum", sag: mesafeYazi(e.mesafe_m) })) },
        { tip: "metin", metin: "Uzaklıklar kuş uçuşudur; eser konumları yaklaşık olabilir.", soluk: true },
      ],
    };
  }

  // ---------- Oyun ----------
  function oyunLobisi() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "kapak", ust: "Meydan okuma", baslik: "Zaman Arenası", desen: "zaman-arenasi", renk: "murdum",
          alt: `${OYUN_TUR} tur, her biri birkaç saniye. Seri yaptıkça puanın katlanır.`,
          cocuklar: [
            { tip: "dugme", id: "oyun-yuzyil", metin: `Yüzyıl Avı · rekor ${rekorlar.yuzyil ?? 0}`, ikon: "zaman" },
            { tip: "dugme", id: "oyun-eski", metin: `Hangisi daha eski? · rekor ${rekorlar.eski ?? 0}`, ikon: "tekrar", tur: "ikincil" },
          ] },
        { tip: "kart", cocuklar: [
          { tip: "baslik", metin: "Nasıl oynanır?", boyut: 3 },
          { tip: "metin", metin: `Yüzyıl Avı: eserin fotoğrafına bak, yapıldığı yüzyılı ${OYUN_SURE.yuzyil} saniyede bul.` },
          { tip: "metin", metin: `Hangisi daha eski?: iki eserden önce yapılmış olanı ${OYUN_SURE.eski} saniyede seç.` },
          { tip: "metin", metin: "Sorular yalnızca yapım yüzyılı kayıtlı eserlerden seçilir.", soluk: true },
        ] },
      ],
    };
  }

  function oyunTurEkrani() {
    const o = d.oyun, s = o.sorular[o.sira], c = o.cevap;
    if (!s) return oyunLobisi();
    const ust = { tip: "ust_cubuk", baslik: `Tur ${o.sira + 1}/${o.sorular.length}`, alt: `${o.puan} puan${o.seri >= 2 ? ` · ${o.seri} seri` : ""}`, geri: "oyun-cik" };
    const sure = c ? { tip: "ilerleme", deger: o.sira + 1, toplam: o.sorular.length } : { tip: "sure", id: `tur-${o.mod}-${o.sira}`, saniye: OYUN_SURE[o.mod] };
    const sonucMetni = !c ? null : c.dogru ? "Doğru!" : c.secim < 0 ? "Süre doldu." : "Bu sefer olmadı.";
    const devam = c ? [{ tip: "dugme", id: "sonraki", metin: o.sira + 1 < o.sorular.length ? "Sonraki tur" : "Sonucu gör", ikon: "ok" }] : [];

    if (o.mod === "yuzyil") {
      const siklar = s.secenekler.map((x, i) => {
        let tur = "ikincil", metin = x.metin;
        if (c && x.dogru) { tur = "ana"; metin = `✓ ${x.metin}`; } else if (c && i === c.secim) metin = `✗ ${x.metin}`;
        return { tip: "dugme", id: `sik-${i}`, metin, tur, devre_disi: !!c && !x.dogru && i !== c.secim };
      });
      return { tip: "sutun", cocuklar: [
        ust, sure,
        { tip: "fotograflar", eser: s.eser },
        { tip: "baslik", metin: s.eser.ad, boyut: 2 },
        { tip: "metin", metin: sonucMetni ?? "Hangi yüzyılda yapılmış?", soluk: !c },
        { tip: "izgara", sutun: 2, cocuklar: siklar },
        ...(c ? [{ tip: "kart", cocuklar: [{ tip: "metin", metin: s.eser.tarihce.tr.split(/\n+/).filter(Boolean).slice(0, 2).join(" ").slice(0, 380) }, { tip: "metin", metin: s.eser.kaynak, soluk: true }] }] : []),
        ...devam,
      ] };
    }
    const [a, b] = s.ikili;
    const etiket = (e, i) => !c ? "Bu daha eski" : i === s.dogruIndeks ? `✓ ${e.yuzyil}. yüzyıl` : `${i === c.secim ? "✗ " : ""}${e.yuzyil}. yüzyıl`;
    return { tip: "sutun", cocuklar: [
      ust, sure,
      { tip: "baslik", metin: sonucMetni ?? "Hangisi daha önce yapılmış?", boyut: 2 },
      { tip: "izgara", sutun: 2, cocuklar: [a, b].map((e, i) => ({ tip: "kart", renk: c ? (i === s.dogruIndeks ? "zumrut" : i === c.secim ? "mercan" : undefined) : undefined, cocuklar: [
        { tip: "gorsel", eser: e },
        { tip: "baslik", metin: e.ad, boyut: 3 },
        { tip: "dugme", id: `sik-${i}`, metin: etiket(e, i), tur: c ? (i === s.dogruIndeks ? "ana" : "ikincil") : "ana", devre_disi: !!c },
      ] })) },
      ...devam,
    ] };
  }

  function oyunSonucEkrani() {
    const o = d.oyun;
    if (!o) return oyunLobisi();
    const tam = o.dogru === o.sorular.length;
    return { tip: "sutun", cocuklar: [
      { tip: "kapak", ust: o.yeniRekor ? "Yeni rekor!" : `Rekor: ${rekorlar[o.mod]}`, baslik: tam ? "Kusursuz!" : `${o.puan} puan`,
        alt: `${o.sorular.length} turda ${o.dogru} doğru · en uzun seri ${o.enUzun}`, renk: tam ? "altin" : "murdum", desen: `sonuc-${o.mod}-${o.puan}`,
        cocuklar: [
          { tip: "dugme", id: o.mod === "yuzyil" ? "oyun-yuzyil" : "oyun-eski", metin: "Tekrar oyna", ikon: "tekrar" },
          { tip: "dugme", id: "oyun-cik", metin: "Oyunlara dön", tur: "ikincil" },
        ] },
      { tip: "baslik", metin: "Bu oyundaki eserler", boyut: 3 },
      { tip: "sutun", aralik: "dar", cocuklar: o.sorular.flatMap((s) => s.ikili ?? [s.eser]).map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "satir" })) },
    ] };
  }

  // ---------- Koleksiyon ----------
  function koleksiyonEkrani() {
    const fav = hepsi.filter((e) => favoriler.has(e.id));
    const sonBakilanlar = [...incelenen].reverse().slice(0, 8).map((id) => hepsi.find((e) => e.id === id)).filter(Boolean);
    const kazanilan = d.rozetler.filter((b) => b.kazanildi).length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Koleksiyon", alt: `${d.profil.ad} · seviye ${d.profil.seviye}` },
        { tip: "izgara", sutun: 3, cocuklar: [
          { tip: "istatistik", deger: incelenen.size, etiket: "incelenen", ikon: "pusula" },
          { tip: "istatistik", deger: favoriler.size, etiket: "favori", ikon: "kalp" },
          { tip: "istatistik", deger: `${kazanilan}/${d.rozetler.length}`, etiket: "rozet", ikon: "kupa" },
        ] },
        { tip: "ilerleme", deger: incelenen.size, toplam: hepsi.length, etiket: "Bursa'nın vakıf eserleri" },
        ...(sonBakilanlar.length ? [
          { tip: "baslik", metin: "Son baktıkların", boyut: 2 },
          { tip: "kaydirma", cocuklar: sonBakilanlar.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) },
        ] : []),
        { tip: "baslik", metin: "Favoriler", boyut: 2 },
        fav.length
          ? { tip: "kaydirma", cocuklar: fav.map((e) => ({ tip: "eser", eser: e, id: "eser", boyut: "kucuk" })) }
          : { tip: "metin", metin: "Bir eserin sayfasındaki ♥ ile favorilerine ekle.", soluk: true },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: d.rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
        { tip: "baslik", metin: "Rekorlar", boyut: 2 },
        { tip: "liste", ogeler: [
          { id: "r-yuzyil", metin: "Yüzyıl Avı", ikon: "zaman", sag: `${rekorlar.yuzyil ?? 0} puan` },
          { id: "r-eski", metin: "Hangisi daha eski?", ikon: "tekrar", sag: `${rekorlar.eski ?? 0} puan` },
        ] },
      ],
    };
  }
}
