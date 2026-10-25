import { sahne, eserler, basarim, profil, depo } from "@lonca/sdk";

const SURE_SANIYE = 12;
const SORU_SAYISI = 6;

const BASARIMLAR = [
  { id: "ilk-turbe", ad: "İlk İnceleme", aciklama: "Bir türbenin yapım yüzyılını doğru tespit et." },
  { id: "seri-3", ad: "Usta Dedektif", aciklama: "Üst üste 3 türbenin yüzyılını doğru bil." },
  { id: "kusursuz", ad: "Bursa Piri", aciklama: "Bir oyundaki tüm soruları eksiksiz doğru cevapla." },
];

export default async function basla() {
  const tumTurbeler = await eserler.liste({ il: "Bursa", tur: "turbe" });
  const havuz = tumTurbeler.filter((e) => e.yuzyil && e.fotograflar && e.fotograflar.length > 0);

  await basarim.tanimla(BASARIMLAR);
  let rekor = (await depo.oku("rekor")) ?? 0;
  let ekranModu = "lobi"; // "lobi" | "oyun" | "sonuc" | "basarimlar"
  let rozetler = await basarim.liste();

  /** @type {any} */
  let oyun = null; // { sorular, sira, puan, dogru, seri, enUzunSeri, cevap, bitti, yeniRekor }

  await sahne.ayarla({
    baslik: "Türbe Dedektifi",
    tema: { zemin: "gece", renk: "murdum", yazi: "sans" },
  });

  await sahne.ciz(guncelArayuz());

  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "sure" && oyun && !oyun.cevap) {
      await cevapla(-1); 
    } else if (olay.tur === "dokun") {
      if (olay.id === "basla" || olay.id === "tekrar") {
        oyunuBaslat();
      } else if (olay.id === "lobi") {
        ekranModu = "lobi";
        oyun = null;
      } else if (olay.id === "basarimlar") {
        rozetler = await basarim.liste();
        ekranModu = "basarimlar";
      } else if (olay.id.startsWith("sik-") && oyun && !oyun.cevap) {
        const secilenIndeks = Number(olay.id.slice(4));
        await cevapla(secilenIndeks);
      } else if (olay.id === "sonraki" && oyun) {
        oyun.sira++;
        oyun.cevap = null;
        if (oyun.sira >= oyun.sorular.length) {
          await oyunuBitir();
        }
      }
    }
    await sahne.ciz(guncelArayuz());
  }

  function oyunuBaslat() {
    if (havuz.length === 0) {
      ekranModu = "lobi";
      return;
    }
    const secilenler = eserler.karistir(havuz).slice(0, Math.min(SORU_SAYISI, havuz.length));
    const sorular = secilenler.map((turbe) => ({
      eser: turbe,
      secenekler: eserler.yuzyilSecenekleri(turbe, 4),
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
    ekranModu = "oyun";
  }

  async function cevapla(indeks) {
    const soru = oyun.sorular[oyun.sira];
    const dogruMu = indeks >= 0 && !!soru.secenekler[indeks]?.dogru;

    oyun.cevap = { secim: indeks, dogru: dogruMu };

    if (dogruMu) {
      oyun.dogru++;
      oyun.seri++;
      oyun.enUzunSeri = Math.max(oyun.enUzunSeri, oyun.seri);

      const seriBonusu = (oyun.seri - 1) * 5;
      const kazanilanPuan = 10 + seriBonusu;
      oyun.puan += kazanilanPuan;

      await sahne.efekt("yildiz");
      await basarim.kazan("ilk-turbe");
      if (oyun.seri >= 3) {
        await basarim.kazan("seri-3");
      }
    } else {
      oyun.seri = 0;
      await sahne.efekt("titre");
    }
  }

  async function oyunuBitir() {
    oyun.bitti = true;
    ekranModu = "sonuc";

    if (oyun.puan > rekor) {
      rekor = oyun.puan;
      oyun.yeniRekor = true;
      await depo.yaz("rekor", rekor);
    }

    if (oyun.puan > 0) {
      await profil.puanEkle(Math.round(oyun.puan / 2), "Türbe Dedektifi");
    }

    if (oyun.dogru === oyun.sorular.length && oyun.sorular.length > 0) {
      await basarim.kazan("kusursuz");
      await sahne.efekt("konfeti");
    }
  }

  function guncelArayuz() {
    if (ekranModu === "basarimlar") return basarimlarEkrani();
    if (ekranModu === "oyun" && oyun) return turEkrani();
    if (ekranModu === "sonuc" && oyun) return sonucEkrani();
    return lobiEkrani();
  }

  function lobiEkrani() {
    const kapakEseri = havuz[0];
    return {
      tip: "kapak",
      ust: `En Yüksek Skor: ${rekor} Puan`,
      baslik: "Türbe Dedektifi",
      alt: `Bursa'nın ebedî istirahatgâhlarını fotoğraflarından incele, hangi yüzyılda yapıldıklarını bul! Seri yaptıkça puanın katlanır, her soru 12 saniye.`,
      eser: kapakEseri,
      renk: "murdum",
      desen: "turbe-dedektifi",
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Dedektifliğe Başla", ikon: "oyun" },
        { tip: "dugme", id: "basarimlar", metin: "Başarımlar & Rozetler", ikon: "kupa", tur: "ikincil" },
      ],
    };
  }

  function turEkrani() {
    const soru = oyun.sorular[oyun.sira];
    const c = oyun.cevap;

    const sikDugmeleri = soru.secenekler.map((secenek, i) => {
      let tur = "ikincil";
      let metin = secenek.metin;

      if (c) {
        if (secenek.dogru) {
          tur = "ana";
          metin = `✓ ${secenek.metin}`;
        } else if (i === c.secim) {
          metin = `✗ ${secenek.metin}`;
        }
      }

      return {
        tip: "dugme",
        id: `sik-${i}`,
        metin,
        tur,
        devre_disi: !!c && !secenek.dogru && i !== c.secim,
      };
    });

    const tarihceParagraflari = soru.eser.tarihce.tr.split(/\n+/).filter(Boolean);
    const ozet = tarihceParagraflari[0]?.slice(0, 320) ?? "";

    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: `Soru ${oyun.sira + 1} / ${oyun.sorular.length}`,
          alt: `${oyun.puan} puan${oyun.seri >= 2 ? ` · 🔥 ${oyun.seri} Seri` : ""}`,
          geri: "lobi",
        },
        c
          ? { tip: "ilerleme", deger: oyun.sira + 1, toplam: oyun.sorular.length }
          : { tip: "sure", id: `tur-${oyun.sira}`, saniye: SURE_SANIYE },
        { tip: "fotograflar", eser: soru.eser },
        {
          tip: "baslik",
          metin: c ? soru.eser.ad : "Bu türbe kaçıncı yüzyılda inşa edildi?",
          boyut: 2,
        },
        {
          tip: "metin",
          metin: !c
            ? "Fotoğrafı dikkatle incele; mimari üslup ipucu verecektir."
            : c.dogru
            ? "Tebrikler, doğru tespit!"
            : c.secim < 0
            ? "Süre doldu! Yüzyıl belirlenemedi."
            : "Yanlış tahmin!",
          soluk: !c,
        },
        { tip: "sutun", aralik: "dar", cocuklar: sikDugmeleri },
        ...(c
          ? [
              {
                tip: "kart",
                renk: c.dogru ? "zumrut" : "mercan",
                cocuklar: [
                  { tip: "metin", metin: ozet },
                  { tip: "metin", metin: soru.eser.kaynak, soluk: true },
                ],
              },
              {
                tip: "dugme",
                id: "sonraki",
                metin: oyun.sira + 1 < oyun.sorular.length ? "Sıradaki Türbe" : "Sonucu Gör",
                ikon: "ok",
              },
            ]
          : []),
      ],
    };
  }

  function sonucEkrani() {
    const kusursuzMu = oyun.dogru === oyun.sorular.length;
    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "kapak",
          ust: oyun.yeniRekor ? "🌟 YENİ REKOR!" : `En Yüksek Skor: ${rekor} Puan`,
          baslik: kusursuzMu ? "Kusursuz Dedektif!" : `${oyun.puan} Puan`,
          alt: `${oyun.sorular.length} soruda ${oyun.dogru} doğru · En uzun seri: ${oyun.enUzunSeri}`,
          renk: kusursuzMu ? "altin" : "murdum",
          desen: `sonuc-${oyun.puan}`,
          cocuklar: [
            { tip: "dugme", id: "tekrar", metin: "Yeniden Oyna", ikon: "tekrar" },
            { tip: "dugme", id: "basarimlar", metin: "Başarımları Gör", ikon: "kupa", tur: "ikincil" },
            { tip: "dugme", id: "lobi", metin: "Lobiye Dön", tur: "hayalet" },
          ],
        },
        { tip: "baslik", metin: "İncelenen Türbeler", boyut: 3 },
        {
          tip: "sutun",
          aralik: "dar",
          cocuklar: oyun.sorular.map((s) => ({
            tip: "eser",
            eser: s.eser,
            boyut: "satir",
          })),
        },
      ],
    };
  }

  function basarimlarEkrani() {
    const kazanilanSayisi = rozetler.filter((r) => r.kazanildi).length;
    return {
      tip: "sutun",
      cocuklar: [
        {
          tip: "ust_cubuk",
          baslik: "Dedektif Başarımları",
          alt: `${kazanilanSayisi} / ${rozetler.length} Başarım Açıldı`,
          geri: "lobi",
        },
        {
          tip: "izgara",
          sutun: 2,
          cocuklar: rozetler.map((b) => ({
            tip: "rozet",
            ad: b.ad,
            aciklama: b.aciklama,
            kazanildi: b.kazanildi,
          })),
        },
        { tip: "bosluk" },
        { tip: "dugme", id: "basla", metin: "Oyuna Başla", ikon: "oyun" },
      ],
    };
  }
}
