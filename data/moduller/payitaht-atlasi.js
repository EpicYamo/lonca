import { sahne, ekran, eserler, basarim, profil, depo } from "@lonca/sdk";


const BASARIMLAR = [
  { id: "ilk-adim", ad: "İlk Adım", aciklama: "Payitahtın ilk anıt eserini seyyah defterine kaydet." },
  { id: "gok-seyyahi", ad: "Gök Seyyahı", aciklama: "Bir vakıf eserini gerçek 3B uçuşla gökyüzünden süzülerek incele." },
  { id: "haritaci", ad: "Şehir Haritacısı", aciklama: "Canlı harita atlasından 5 farklı eseri keşfet." },
  { id: "mimar-gozu", ad: "Mimarın Gözü", aciklama: "Mimari İmtihan'da art arda 3 doğru cevap vererek seri yakala." },
  { id: "bursa-piri", ad: "Bursa Pîri", aciklama: "Toplam 10 eseri inceleyip seyyah defterini zenginleştir." },
];

const LUGAT = [
  {
    id: "ters-t",
    metin: "Ters T (Bursa Tipi) Plan",
    alt: "Girişte bir hol, ortada kubbeli bir orta avlu veya şadırvan, yanlarda ise dervişlerin konakladığı tabhâne odalarından oluşan Erken Osmanlı mimarisine has cami planı.",
  },
  {
    id: "mukarnas",
    metin: "Mukarnas (Petek Dolgu)",
    alt: "Kademeli küçük nişlerin yan yana ve üst üste dizilmesiyle oluşan, ışık-gölge oyunları sunan prizmatik İslam süsleme ve geçiş ögesi.",
  },
  {
    id: "kulliye",
    metin: "Külliye Mimarisi",
    alt: "Cami merkezinde medrese, hamam, imaret, türbe ve darüşşifanın bir arada yer aldığı, vakıf kültürünün en kapsamlı sosyo-kültürel yerleşkesi.",
  },
  {
    id: "revak",
    metin: "Revak & Son Cemaat",
    alt: "Üstü tonoz veya kubbelerle örtülü, önü sütun ve kemerlerle dışarıya açılan yarı açık gölgelikli geçit alanı.",
  },
  {
    id: "kasnak",
    metin: "Kubbe Kasnağı",
    alt: "Kare veya çokgen duvar gövdesinden yuvarlak kubbe eteğine geçişi sağlayan ve pencereleriyle ana mekana ışık taşıyan yüksek kuşak.",
  },
];

export default async function basla() {
  const tumEserler = await eserler.liste({ il: "Bursa" });
  const konumluEserler = tumEserler.filter((e) => e.konum);
  const fotoluEserler = tumEserler.filter((e) => e.fotograflar && e.fotograflar.length > 0);

  await basarim.tanimla(BASARIMLAR);

  const incelenenler = new Set((await depo.oku("incelenen_eserler")) ?? []);
  let enYuksekSkor = (await depo.oku("rekor_skor")) ?? 0;
  let rozetler = await basarim.liste();

  let yigin = [{ ad: "kapak" }];
  const simdiki = () => yigin[yigin.length - 1];
  const git = (ad, veri = {}) => yigin.push({ ad, veri });
  const geri = () => { if (yigin.length > 1) yigin.pop(); };

  let seciliTur = "hepsi";

  // Mimari imtihan durumu
  /** @type {any} */
  let oyun = null;

  await sahne.ayarla({
    baslik: "Payitaht Bursa",
    tema: { zemin: "gece", renk: "altin", yazi: "serif" },
  });

  const ciz = () => sahne.ciz(guncelArayuz());
  await ciz();

  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "dokun") {
      if (olay.id === "geri") {
        geri();
      } else if (olay.id === "menu-atlas") {
        git("atlas");
      } else if (olay.id === "menu-oyun") {
        oyunuKur();
        git("oyun");
      } else if (olay.id === "menu-defter") {
        rozetler = await basarim.liste();
        git("defter");
      } else if (olay.id === "menu-lugat") {
        git("lugat");
      } else if (olay.id === "eser-sec" && olay.eser) {
        await eseriAc(olay.eser);
      } else if (olay.id === "uc-gezi" && simdiki().veri?.eser) {
        await gercek3BUcus(simdiki().veri.eser);
      } else if (olay.id === "harita-ac-pencere") {
        const secilen = await ekran.harita(konumluEserler, { baslik: "Bursa Vakıf Anıtları" });
        if (secilen) await eseriAc(secilen);
      } else if (olay.id === "galeri-ac") {
        const secilen = await ekran.galeri(fotoluEserler.slice(0, 15), { baslik: "Bursa Şaheserleri Galerisi" });
        if (secilen) await eseriAc(secilen);
      } else if (olay.id === "zaman-tuneli") {
        const yuzyilli = tumEserler.filter((e) => e.yuzyil);
        await ekran.zaman(yuzyilli.slice(0, 20), { baslik: "Asırlar Boyu Bursa" });
      } else if (olay.id === "hata-bildir" && simdiki().veri?.eser) {
        await ekran.duzeltme(simdiki().veri.eser);
      } else if (olay.id.startsWith("sik-") && oyun && !oyun.cevap) {
        const indeks = Number(olay.id.slice(4));
        await cevapla(indeks);
      } else if (olay.id === "oyun-sonraki" && oyun) {
        oyun.sira++;
        oyun.cevap = null;
        if (oyun.sira >= oyun.sorular.length) {
          await oyunuBitir();
        }
      } else if (olay.id === "oyun-tekrar") {
        oyunuKur();
      }
    } else if (olay.tur === "sec" && olay.id === "tur-filtre") {
      seciliTur = olay.deger;
    } else if (olay.tur === "sure" && oyun && !oyun.cevap) {
      await cevapla(-1); 
    }

    await ciz();
  }

  // ---------- Aksiyonlar ----------
  async function eseriAc(eser) {
    const ucVar = await ekran.ucVarMi(eser);
    git("detay", { eser, ucVar });

    if (!incelenenler.has(eser.id)) {
      incelenenler.add(eser.id);
      await depo.yaz("incelenen_eserler", [...incelenenler]);
      await profil.puanEkle(15, `Keşif: ${eser.ad}`);
    }

    await basarim.kazan("ilk-adim");
    if (incelenenler.size >= 5) await basarim.kazan("haritaci");
    if (incelenenler.size >= 10) {
      await basarim.kazan("bursa-piri");
      await sahne.efekt("konfeti");
    }
  }

  async function gercek3BUcus(eser) {
    const ucSonuc = await ekran.uc({
      eser,
      baslik: eser.ad,
      duraklar: [
        { odak: "genel", metin: `${eser.ad} ve çevresi. Kuşbakışı Bursa silüeti ve eserin şehir dokusundaki yeri.` },
        { odak: "yakin", metin: "Eserin giriş cephesi ve abidevi mimari oranları yakından karşınızda." },
        { odak: "ust", metin: "Kuşbakışı çatı ve kubbe nizamı. Erken devir taş ve tuğla işçiliği belirginleşir." },
      ],
    });

    if (ucSonuc.acildi) {
      await basarim.kazan("gok-seyyahi");
      await profil.puanEkle(25, "3B Hava Seyri");
      await sahne.efekt("parla");
    }
  }

  function oyunuKur() {
    const havuz = fotoluEserler.filter((e) => e.yuzyil);
    const secilenler = eserler.karistir(havuz).slice(0, 5);
    const sorular = secilenler.map((e) => ({
      eser: e,
      secenekler: eserler.yuzyilSecenekleri(e, 4),
    }));

    oyun = {
      sorular,
      sira: 0,
      puan: 0,
      dogru: 0,
      seri: 0,
      enUzunSeri: 0,
      cevap: null,
      bitti: false,
      yeniRekor: false,
    };
  }

  async function cevapla(i) {
    const soru = oyun.sorular[oyun.sira];
    const dogruMu = i >= 0 && !!soru.secenekler[i]?.dogru;
    oyun.cevap = { secim: i, dogru: dogruMu };

    if (dogruMu) {
      oyun.dogru++;
      oyun.seri++;
      oyun.enUzunSeri = Math.max(oyun.enUzunSeri, oyun.seri);
      const puan = 10 + (oyun.seri - 1) * 5;
      oyun.puan += puan;
      await sahne.efekt("yildiz");

      if (oyun.seri >= 3) {
        await basarim.kazan("mimar-gozu");
      }
    } else {
      oyun.seri = 0;
      await sahne.efekt("titre");
    }
  }

  async function oyunuBitir() {
    oyun.bitti = true;
    if (oyun.puan > enYuksekSkor) {
      enYuksekSkor = oyun.puan;
      oyun.yeniRekor = true;
      await depo.yaz("rekor_skor", enYuksekSkor);
    }
    if (oyun.puan > 0) {
      await profil.puanEkle(Math.round(oyun.puan / 2), "Mimari İmtihan");
    }
    if (oyun.dogru === oyun.sorular.length) {
      await sahne.efekt("konfeti");
    }
  }

  function guncelArayuz() {
    const e = simdiki();
    if (e.ad === "atlas") return atlasEkrani();
    if (e.ad === "detay") return detayEkrani(e.veri.eser, e.veri.ucVar);
    if (e.ad === "oyun") return oyunEkrani();
    if (e.ad === "defter") return defterEkrani();
    if (e.ad === "lugat") return lugatEkrani();
    return kapakEkrani();
  }

  function kapakEkrani() {
    const vitrinEser = tumEserler.find((e) => e.id === "bursa-ulucami") ?? tumEserler[0];
    return {
      tip: "kapak",
      ust: "Osmanlı Payitahtı · Vakıf Medeniyeti",
      baslik: "Payitaht Atlası",
      alt: "Ulu Şehir Bursa'nın anıt eserlerini gerçek 3B gökyüzü uçuşlarıyla keşfet, canlı harita üzerinde adımla ve mimari imtihanla seyyah rütbeni yükselt.",
      eser: vitrinEser,
      renk: "altin",
      desen: "payitaht-bursa",
      cocuklar: [
        { tip: "dugme", id: "menu-atlas", metin: "Vakıf Atlası & Harita", ikon: "harita" },
        { tip: "dugme", id: "menu-oyun", metin: "Mimarın İmtihanı (Oyun)", ikon: "oyun", tur: "ikincil" },
        { tip: "satir", hizala: "orta", cocuklar: [
          { tip: "dugme", id: "menu-defter", metin: `Seyyah Defteri (${incelenenler.size})`, ikon: "kupa", tur: "hayalet" },
          { tip: "dugme", id: "menu-lugat", metin: "Mimari Lügat", ikon: "kitap", tur: "hayalet" },
        ]},
      ],
    };
  }

  function atlasEkrani() {
    // Filtrelenen eserler
    const filtrelenmis = tumEserler.filter((e) => {
      if (seciliTur === "hepsi") return true;
      if (seciliTur === "ibadet") return e.tur === "cami" || e.tur === "mescit";
      if (seciliTur === "kulliye") return e.tur === "kulliye" || e.tur === "medrese";
      if (seciliTur === "ticaret") return e.tur === "han" || e.tur === "hamam" || e.tur === "carsi";
      if (seciliTur === "turbe") return e.tur === "turbe" || e.tur === "hazire";
      return true;
    });

    const haritaGosterim = filtrelenmis.filter((e) => e.konum).slice(0, 30);

    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: "Vakıf Atlası",
          alt: `${filtrelenmis.length} Tarihî Anıt`,
          geri: "geri",
          sag: [
            { id: "galeri-ac", ikon: "kamera", etiket: "Galeri" },
            { id: "zaman-tuneli", ikon: "zaman", etiket: "Kronoloji" },
          ],
        },
        {
          tip: "secenekler",
          id: "tur-filtre",
          secili: seciliTur,
          secenekler: [
            { id: "hepsi", metin: "Tümü" },
            { id: "ibadet", metin: "Cami & Mescit" },
            { id: "kulliye", metin: "Külliye & Medrese" },
            { id: "ticaret", metin: "Han & Hamam" },
            { id: "turbe", metin: "Türbe & Hazire" },
          ],
        },
        haritaGosterim.length > 0
          ? { tip: "harita", id: "eser-sec", eserler: haritaGosterim }
          : { tip: "bosluk" },
        {
          tip: "satir",
          hizala: "orta",
          cocuklar: [
            { tip: "dugme", id: "harita-ac-pencere", metin: "Büyük Haritada Gezin", ikon: "pusula", tur: "ikincil" },
          ],
        },
        { tip: "baslik", metin: "Öne Çıkan Vakıf Eserleri", boyut: 3 },
        {
          tip: "izgara",
          sutun: 2,
          cocuklar: filtrelenmis.slice(0, 10).map((eser) => ({
            tip: "eser",
            eser,
            id: "eser-sec",
            boyut: "kucuk",
          })),
        },
      ],
    };
  }

  function detayEkrani(eser, ucVar) {
    const paragraflar = eser.tarihce.tr.split(/\n+/).filter(Boolean);
    const yuzyilMetni = eser.yuzyil ? `${eser.yuzyil}. Yüzyıl Yapımı` : "Tarihlendirme Belirsiz";
    const turEtiketi = eser.tur.toUpperCase();

    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: eser.ad,
          alt: `${eser.ilce ?? "Bursa"} · ${turEtiketi}`,
          geri: "geri",
        },
        { tip: "fotograflar", eser },
        {
          tip: "cipler",
          ogeler: [
            yuzyilMetni,
            turEtiketi,
            incelenenler.has(eser.id) ? "✓ Deftere Kaydedildi" : "Keşfedildi",
          ],
        },
        ...(ucVar
          ? [
              {
                tip: "kart",
                renk: "altin",
                cocuklar: [
                  { tip: "baslik", metin: "Gökyüzünden Süzül (Gerçek 3B)", boyut: 3 },
                  {
                    tip: "metin",
                    metin: "Google 3B fotogrametri modeliyle bu eserin üzerinde kuşbakışı süzülün.",
                  },
                  { tip: "dugme", id: "uc-gezi", metin: "3B Hava Uçuşunu Başlat", ikon: "kup" },
                ],
              },
            ]
          : []),
        { tip: "baslik", metin: "Tarihçe ve Mimari Kimlik", boyut: 2 },
        ...paragraflar.slice(0, 3).map((p) => ({ tip: "metin", metin: p })),
        eser.konum
          ? { tip: "harita", id: "eser-sec", eserler: [eser], secili: eser.id }
          : { tip: "bosluk" },
        eser.adres
          ? { tip: "metin", metin: `📍 Adres: ${eser.adres}`, soluk: true }
          : { tip: "bosluk" },
        { tip: "ayrac" },
        { tip: "metin", metin: `Kaynak: ${eser.kaynak}`, soluk: true },
        {
          tip: "satir",
          hizala: "orta",
          cocuklar: [
            { tip: "dugme", id: "hata-bildir", metin: "Eksik / Yanlış Bilgi Bildir", tur: "hayalet", ikon: "bilgi" },
          ],
        },
      ],
    };
  }

  function oyunEkrani() {
    if (!oyun) return kapakEkrani();
    if (oyun.bitti) return imtihanSonucEkrani();

    const soru = oyun.sorular[oyun.sira];
    const c = oyun.cevap;

    const sikDugmeleri = soru.secenekler.map((x, i) => {
      let tur = "ikincil";
      let metin = x.metin;
      if (c) {
        if (x.dogru) {
          tur = "ana";
          metin = `✓ ${x.metin}`;
        } else if (i === c.secim) {
          metin = `✗ ${x.metin}`;
        }
      }
      return {
        tip: "dugme",
        id: `sik-${i}`,
        metin,
        tur,
        devre_disi: !!c && !x.dogru && i !== c.secim,
      };
    });

    const ilkParagraf = soru.eser.tarihce.tr.split(/\n+/).filter(Boolean)[0] ?? "";
    const ipucuMetni = ilkParagraf.length > 220 ? ilkParagraf.slice(0, 220) + "..." : ilkParagraf;

    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: `İmtihan: Soru ${oyun.sira + 1} / ${oyun.sorular.length}`,
          alt: `${oyun.puan} Puan${oyun.seri >= 2 ? ` · 🔥 ${oyun.seri} Seri` : ""}`,
          geri: "geri",
        },
        c
          ? { tip: "ilerleme", deger: oyun.sira + 1, toplam: oyun.sorular.length }
          : { tip: "sure", id: `soru-sure-${oyun.sira}`, saniye: 14 },
        { tip: "fotograflar", eser: soru.eser },
        {
          tip: "baslik",
          metin: c ? soru.eser.ad : "Bu vakıf anıtı hangi yüzyılda inşa edilmiştir?",
          boyut: 2,
        },
        {
          tip: "metin",
          metin: !c
            ? "Yapının kubbe, taçkapı ve cephe üslubuna dikkat ederek yüzyılı tahmin edin."
            : c.dogru
            ? "Tebrikler! Mimarın gözüyle doğru çağı tespit ettiniz."
            : c.secim < 0
            ? "Süre doldu! Eserin yapım çağı belirlenemedi."
            : "Yanlış tahmin! Mimari üslup başka bir döneme işaret ediyor.",
          soluk: !c,
        },
        { tip: "sutun", aralik: "dar", cocuklar: sikDugmeleri },
        ...(c
          ? [
              {
                tip: "kart",
                renk: c.dogru ? "zumrut" : "mercan",
                cocuklar: [
                  { tip: "metin", metin: ipucuMetni },
                  { tip: "metin", metin: soru.eser.kaynak, soluk: true },
                ],
              },
              {
                tip: "dugme",
                id: "oyun-sonraki",
                metin: oyun.sira + 1 < oyun.sorular.length ? "Sıradaki Eser" : "İmtihanı Tamamla",
                ikon: "ok",
              },
            ]
          : []),
      ],
    };
  }

  function imtihanSonucEkrani() {
    const tamPuan = oyun.dogru === oyun.sorular.length;
    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "kapak",
          ust: oyun.yeniRekor ? "👑 YENİ ŞEHİR REKORU!" : `En Yüksek Skor: ${enYuksekSkor}`,
          baslik: tamPuan ? "Hassa Mimarı!" : `${oyun.puan} Puan`,
          alt: `${oyun.sorular.length} sorudan ${oyun.dogru} doğru bildiniz. En uzun isabet seriniz: ${oyun.enUzunSeri}`,
          renk: tamPuan ? "altin" : "kobalt",
          desen: `imtihan-${oyun.puan}`,
          cocuklar: [
            { tip: "dugme", id: "oyun-tekrar", metin: "Yeniden İmtihan Ol", ikon: "tekrar" },
            { tip: "dugme", id: "geri", metin: "Atlasa Dön", tur: "ikincil" },
          ],
        },
        { tip: "baslik", metin: "İmtihandaki Eserler", boyut: 3 },
        {
          tip: "sutun",
          aralik: "dar",
          cocuklar: oyun.sorular.map((s) => ({
            tip: "eser",
            eser: s.eser,
            boyut: "satir",
            id: "eser-sec",
          })),
        },
      ],
    };
  }

  function defterEkrani() {
    const toplam = tumEserler.length;
    const oran = Math.round((incelenenler.size / Math.max(1, toplam)) * 100);
    const rutbe =
      incelenenler.size >= 15
        ? "Bursa Şehir Pîri"
        : incelenenler.size >= 8
        ? "Kıdemli Seyyah"
        : incelenenler.size >= 3
        ? "Yolcu Çelebi"
        : "Acemi Seyyah";

    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: "Seyyah Defteri",
          alt: `Rütbe: ${rutbe}`,
          geri: "geri",
        },
        {
          tip: "izgara",
          sutun: 3,
          cocuklar: [
            { tip: "istatistik", deger: incelenenler.size, etiket: "Keşif", ikon: "harita" },
            { tip: "istatistik", deger: `%${oran}`, etiket: "Tamamlanma", ikon: "yildiz" },
            { tip: "istatistik", deger: enYuksekSkor, etiket: "Rekor Skor", ikon: "kupa" },
          ],
        },
        { tip: "ilerleme", deger: incelenenler.size, toplam, etiket: "Bursa Envanteri Keşif İlerlemesi" },
        { tip: "baslik", metin: "Kazanılan Mühürler & Başarımlar", boyut: 2 },
        {
          tip: "izgara",
          sutun: 2,
          cocuklar: rozetler.map((r) => ({
            tip: "rozet",
            ad: r.ad,
            aciklama: r.aciklama,
            kazanildi: r.kazanildi,
          })),
        },
      ],
    };
  }

  function lugatEkrani() {
    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: "Mimari Lügat",
          alt: "Bursa Vakıf Mimarisi Kavramları",
          geri: "geri",
        },
        {
          tip: "metin",
          metin: "Bursa camilerini, külliyelerini ve hanlarını incelerken karşılaşacağınız kadim mimari terimler rehberi.",
          soluk: true,
        },
        {
          tip: "liste",
          ogeler: LUGAT.map((l) => ({
            id: l.id,
            metin: l.metin,
            alt: l.alt,
            ikon: "kitap",
          })),
        },
      ],
    };
  }
}
