import { sahne, eserler, basarim, profil, depo } from "@lonca/sdk";

const TUR_SAYISI = 8;
const SURE = { kolay: 20, zor: 12 }; // saniye

const BASARIMLAR = [
  { id: "ilk-oyun", ad: "İlk Av", aciklama: "Bir oyunu bitir." },
  { id: "seri-5", ad: "Alev Serisi", aciklama: "Üst üste 5 doğru cevap ver." },
  { id: "tam-puan", ad: "Zaman Dedektifi", aciklama: "Bir oyunda bütün soruları bil." },
  { id: "zor-usta", ad: "Usta Avcı", aciklama: "Zor modda en az 6 doğru yap." },
];

export default async function basla() {
  const havuz = (await eserler.liste({ il: "Bursa" })).filter((e) => e.yuzyil && e.fotograflar.length);
  await basarim.tanimla(BASARIMLAR);
  let rekor = (await depo.oku("rekor")) ?? 0;
  let zorluk = "kolay";
  /** @type {any} */
  let oyun = null; // { sorular, sira, puan, dogru, seri, enUzunSeri, cevap, bitti, yeniRekor }

  await sahne.ayarla({ baslik: "Yüzyıl Avı", tema: { zemin: "gece", renk: "altin", yazi: "sans" } });
  await sahne.ciz(lobi());

  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "sec" && olay.id === "zorluk") zorluk = olay.deger;
    else if (olay.tur === "sure" && oyun && !oyun.cevap) await cevapla(-1); 
    else if (olay.tur === "dokun") {
      if (olay.id === "basla" || olay.id === "tekrar") oyunuKur();
      else if (olay.id === "lobi") oyun = null;
      else if (olay.id.startsWith("sik-") && oyun && !oyun.cevap) await cevapla(Number(olay.id.slice(4)));
      else if (olay.id === "sonraki" && oyun) {
        oyun.sira++; oyun.cevap = null;
        if (oyun.sira >= oyun.sorular.length) await bitir();
      }
    }
    await sahne.ciz(!oyun ? lobi() : oyun.bitti ? sonucEkrani() : turEkrani());
  }

  function oyunuKur() {
    const adet = zorluk === "zor" ? 5 : 3;
    const sorular = eserler.karistir(havuz).slice(0, TUR_SAYISI)
      .map((eser) => ({ eser, secenekler: eserler.yuzyilSecenekleri(eser, adet) }));
    oyun = { sorular, sira: 0, puan: 0, dogru: 0, seri: 0, enUzunSeri: 0, cevap: null, bitti: false };
  }

  async function cevapla(i) {
    const s = oyun.sorular[oyun.sira];
    const dogru = i >= 0 && !!s.secenekler[i]?.dogru;
    oyun.cevap = { secim: i, dogru };
    if (dogru) {
      oyun.dogru++; oyun.seri++;
      oyun.enUzunSeri = Math.max(oyun.enUzunSeri, oyun.seri);
      oyun.puan += 10 + Math.min(oyun.seri - 1, 4) * 2 + (zorluk === "zor" ? 5 : 0);
      await sahne.efekt("yildiz");
      if (oyun.seri === 5) await basarim.kazan("seri-5");
    } else {
      oyun.seri = 0;
      await sahne.efekt("titre");
    }
  }

  async function bitir() {
    oyun.bitti = true;
    oyun.yeniRekor = oyun.puan > rekor;
    if (oyun.yeniRekor) { rekor = oyun.puan; await depo.yaz("rekor", rekor); }
    await profil.puanEkle(Math.round(oyun.puan / 4), "Yüzyıl Avı");
    await basarim.kazan("ilk-oyun");
    if (oyun.dogru === oyun.sorular.length) { await basarim.kazan("tam-puan"); await sahne.efekt("konfeti"); }
    if (zorluk === "zor" && oyun.dogru >= 6) await basarim.kazan("zor-usta");
  }

  // ---------- Ekranlar ----------
  function lobi() {
    return {
      tip: "kapak", ust: `Rekor: ${rekor} puan`, baslik: "Yüzyıl Avı", desen: "yuzyil-avi", renk: "murdum",
      alt: `${TUR_SAYISI} eser, her biri için birkaç saniye. Hangi yüzyılda yapıldığını bul; üst üste bildikçe puanın katlanır.`,
      cocuklar: [
        { tip: "secenekler", id: "zorluk", secili: zorluk, secenekler: [{ id: "kolay", metin: "Kolay · 3 şık" }, { id: "zor", metin: "Zor · 5 şık" }] },
        { tip: "dugme", id: "basla", metin: "Oyuna başla", ikon: "oyun" },
      ],
    };
  }

  function turEkrani() {
    const s = oyun.sorular[oyun.sira], c = oyun.cevap;
    const siklar = s.secenekler.map((x, i) => {
      let tur = "ikincil", metin = x.metin;
      if (c && x.dogru) { tur = "ana"; metin = `✓ ${x.metin}`; }
      else if (c && i === c.secim) metin = `✗ ${x.metin}`;
      return { tip: "dugme", id: `sik-${i}`, metin, tur, devre_disi: !!c && !x.dogru && i !== c.secim };
    });
    const paragraflar = s.eser.tarihce.tr.split(/\n+/).filter(Boolean);
    const ozet = (paragraflar[0]?.length < 160 ? paragraflar.slice(0, 2).join(" ") : paragraflar[0] ?? "").slice(0, 420);
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Tur ${oyun.sira + 1}/${oyun.sorular.length}`, alt: `${oyun.puan} puan${oyun.seri >= 2 ? ` · ${oyun.seri} seri` : ""}`, geri: "lobi" },
        c ? { tip: "ilerleme", deger: oyun.sira + 1, toplam: oyun.sorular.length }
          : { tip: "sure", id: `tur-${oyun.sira}`, saniye: SURE[zorluk] },
        { tip: "fotograflar", eser: s.eser },
        { tip: "baslik", metin: s.eser.ad, boyut: 1 },
        { tip: "metin", metin: !c ? "Bu eser kaçıncı yüzyıldan?" : c.dogru ? "Doğru bildin!" : c.secim < 0 ? "Süre doldu." : "Bu sefer olmadı.", soluk: !c },
        { tip: "sutun", aralik: "dar", cocuklar: siklar },
        ...(c ? [
          { tip: "kart", renk: c.dogru ? "zumrut" : "mercan", cocuklar: [{ tip: "metin", metin: ozet }, { tip: "metin", metin: s.eser.kaynak, soluk: true }] },
          { tip: "dugme", id: "sonraki", metin: oyun.sira + 1 < oyun.sorular.length ? "Sonraki eser" : "Sonucu gör", ikon: "ok" },
        ] : []),
      ],
    };
  }

  function sonucEkrani() {
    const tam = oyun.dogru === oyun.sorular.length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "kapak", ust: oyun.yeniRekor ? "Yeni rekor!" : `Rekor: ${rekor}`, baslik: tam ? "Kusursuz av!" : `${oyun.puan} puan`,
          alt: `${oyun.sorular.length} sorudan ${oyun.dogru} doğru · en uzun seri ${oyun.enUzunSeri}`, renk: tam ? "altin" : "murdum", desen: `sonuc-${oyun.puan}`,
          cocuklar: [{ tip: "dugme", id: "tekrar", metin: "Tekrar oyna", ikon: "tekrar" }, { tip: "dugme", id: "lobi", metin: "Lobiye dön", tur: "ikincil" }] },
        { tip: "baslik", metin: "Bu oyundaki eserler", boyut: 3 },
        { tip: "sutun", aralik: "dar", cocuklar: oyun.sorular.map((s) => ({ tip: "eser", eser: s.eser, id: "eser", boyut: "satir" })) },
      ],
    };
  }
}
