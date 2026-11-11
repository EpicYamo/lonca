import { sahne, eserler, basarim, profil, depo } from "@lonca/sdk";

// Hanlarda Hazine Avı: çocuklar için süreli bir bulmaca. Her turda bir hanın gerçek fotoğrafı gösterilir,
// çocuk doğru hanı bulursa hazine sandığına bir altın girer. İpuçları yalnızca eser kaydından gelir (yüzyıl, ilçe).

const TUR_SAYISI = 5;
const SURE_SANIYE = 30;
const SIK_SAYISI = 3;

const BASARIMLAR = [
  { id: "ilk-altin", ad: "İlk Altın", aciklama: "Hazine avında ilk altınını bul." },
  { id: "dolu-sandik", ad: "Dolu Sandık", aciklama: "Bir avda bütün altınları topla." },
  { id: "ipucsuz", ad: "Keskin Göz", aciklama: "Bir avı hiç ipucu almadan bitir." },
  { id: "kervanbasi", ad: "Kervanbaşı", aciklama: "Toplam 15 altın biriktir." },
];

export default async function basla() {
  const hanlar = (await eserler.liste({ il: "Bursa", tur: "han" })).filter((e) => e.fotograflar.length);
  await basarim.tanimla(BASARIMLAR);
  let toplamAltin = (await depo.oku("toplam-altin")) ?? 0;
  let rozetler = await basarim.liste();
  let ekranAdi = "kapak"; // kapak | oyun | sonuc | sandik
  /** @type {any} */
  let av = null; // { turlar, sira, altin, ipucuSayisi, cevap, ipucu }

  await sahne.ayarla({ baslik: "Hanlarda Hazine Avı", tema: { zemin: "parsomen", renk: "altin", yazi: "sans" } });
  await sahne.ciz(arayuz());

  for await (const olay of sahne.olaylar()) {
    if (olay.tur === "sure" && av && !av.cevap && olay.id === `tur-${av.sira}`) await cevapla(null);
    else if (olay.tur === "dokun") {
      if (olay.id === "basla" || olay.id === "tekrar") avKur();
      else if (olay.id === "kapak") { ekranAdi = "kapak"; av = null; }
      else if (olay.id === "sandik") { rozetler = await basarim.liste(); ekranAdi = "sandik"; }
      else if (olay.id === "ipucu" && av && !av.cevap && !av.ipucu) { av.ipucu = true; av.ipucuSayisi++; }
      else if (olay.id.startsWith("sik-") && av && !av.cevap) await cevapla(olay.id.slice(4));
      else if (olay.id === "sonraki" && av) {
        av.sira++; av.cevap = null; av.ipucu = false;
        if (av.sira >= av.turlar.length) await bitir();
      }
    }
    await sahne.ciz(arayuz());
  }

  function avKur() {
    const secilenler = eserler.karistir(hanlar).slice(0, Math.min(TUR_SAYISI, hanlar.length));
    const turlar = secilenler.map((han) => {
      const digerleri = eserler.karistir(hanlar.filter((h) => h.id !== han.id && !karisir(h, han))).slice(0, SIK_SAYISI - 1);
      return { han, siklar: eserler.karistir([han, ...digerleri]) };
    });
    av = { turlar, sira: 0, altin: 0, ipucuSayisi: 0, cevap: null, ipucu: false };
    ekranAdi = "oyun";
  }

  async function cevapla(id) {
    const tur = av.turlar[av.sira];
    const dogru = id === tur.han.id;
    av.cevap = { id, dogru };
    if (dogru) {
      av.altin++;
      await sahne.efekt("yildiz");
      await basarim.kazan("ilk-altin");
    } else {
      await sahne.efekt("titre");
    }
  }

  async function bitir() {
    ekranAdi = "sonuc";
    toplamAltin += av.altin;
    await depo.yaz("toplam-altin", toplamAltin);
    if (av.altin) await profil.puanEkle(av.altin * 5, "Hanlarda Hazine Avı");
    if (av.altin === av.turlar.length) { await basarim.kazan("dolu-sandik"); await sahne.efekt("konfeti"); }
    if (av.ipucuSayisi === 0 && av.altin > 0) await basarim.kazan("ipucsuz");
    if (toplamAltin >= 15) await basarim.kazan("kervanbasi");
  }

  // ---------- Yardımcılar ----------
  // Adları birbirini içeren hanlar (Koza Hanı / İç Koza Hanı) aynı soruda şık olmasın: fotoğraf ikisine de uyabilir.
  function kok(han) {
    return han.ad.toLocaleLowerCase("tr").split(/\s+/).filter((k) => !["han", "hanı", "kervansarayı"].includes(k)).join(" ");
  }
  function karisir(a, b) {
    const x = kok(a), y = kok(b);
    return !!x && !!y && (x.includes(y) || y.includes(x));
  }

  function ipuclari(han) {
    const liste = [];
    if (han.yuzyil) liste.push(`${han.yuzyil}. yüzyılda yapılmış`);
    if (han.ilce) liste.push(`${han.ilce} ilçesinde`);
    return liste.length ? `İpucu: Bu han ${liste.join(", ")}.` : "Bu han için kayıtta ek ipucu yok; fotoğrafa iyi bak!";
  }

  function kisaNot(han) {
    const cumle = (han.tarihce.tr.split(/(?<=[.!?])\s+/).find((c) => c.length > 30) ?? "").trim();
    return cumle.length > 220 ? cumle.slice(0, 217) + "…" : cumle;
  }

  function sandikDizisi(dolu, toplam) {
    return "🪙".repeat(dolu) + "▫️".repeat(Math.max(0, toplam - dolu));
  }

  // ---------- Ekranlar ----------
  function arayuz() {
    if (ekranAdi === "oyun" && av) return oyunEkrani();
    if (ekranAdi === "sonuc" && av) return sonucEkrani();
    if (ekranAdi === "sandik") return sandikEkrani();
    return kapakEkrani();
  }

  function kapakEkrani() {
    const kapakHani = hanlar.find((h) => h.id === "bursa-koza-hani") ?? hanlar[0];
    if (!hanlar.length) return { tip: "kapak", baslik: "Hanlarda Hazine Avı", alt: "Şu an hiç han bulunamadı. Biraz sonra yeniden dene." };
    return {
      tip: "kapak", ust: "Bursa · Kervan yolu", baslik: "Hanlarda Hazine Avı", eser: kapakHani, renk: "altin",
      alt: `Kervanlar bu hanlarda konaklardı. ${Math.min(TUR_SAYISI, hanlar.length)} fotoğraf, her biri için ${SURE_SANIYE} saniye: fotoğraftaki hanı bul, altınları sandığına doldur!`,
      cocuklar: [
        { tip: "dugme", id: "basla", metin: "Ava başla", ikon: "pusula" },
        { tip: "dugme", id: "sandik", metin: `Hazine sandığım (${toplamAltin} altın)`, ikon: "kupa", tur: "ikincil" },
      ],
    };
  }

  function oyunEkrani() {
    const tur = av.turlar[av.sira], c = av.cevap;
    const siklar = tur.siklar.map((h) => {
      let metin = h.ad, tip = "ikincil";
      if (c && h.id === tur.han.id) { metin = `✓ ${h.ad}`; tip = "ana"; }
      else if (c && h.id === c.id) metin = `✗ ${h.ad}`;
      return { tip: "dugme", id: `sik-${h.id}`, metin, tur: tip, devre_disi: !!c && h.id !== tur.han.id && h.id !== c.id };
    });
    const mesaj = !c ? "Bu fotoğraf hangi hana ait?" : c.dogru ? "Harika! Bir altın buldun." : c.id === null ? "Süre doldu! Doğru han şuydu:" : "Bu sefer olmadı. Doğru han şuydu:";
    const not = c ? kisaNot(tur.han) : "";
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: `Tur ${av.sira + 1}/${av.turlar.length}`, alt: `Sandık: ${sandikDizisi(av.altin, av.turlar.length)}`, geri: "kapak" },
        c ? { tip: "ilerleme", deger: av.sira + 1, toplam: av.turlar.length }
          : { tip: "sure", id: `tur-${av.sira}`, saniye: SURE_SANIYE },
        { tip: "fotograflar", eser: tur.han },
        { tip: "baslik", metin: mesaj, boyut: 2 },
        !c && av.ipucu ? { tip: "kart", renk: "altin", cocuklar: [{ tip: "metin", metin: ipuclari(tur.han) }] } : { tip: "bosluk" },
        { tip: "sutun", aralik: "dar", cocuklar: siklar },
        !c && !av.ipucu ? { tip: "dugme", id: "ipucu", metin: "İpucu al", tur: "hayalet", ikon: "bilgi" } : { tip: "bosluk" },
        ...(c ? [
          { tip: "kart", renk: c.dogru ? "zumrut" : "mercan", cocuklar: [
            { tip: "baslik", metin: tur.han.ad, boyut: 3 },
            not ? { tip: "metin", metin: not } : { tip: "bosluk" },
            { tip: "metin", metin: tur.han.kaynak, soluk: true },
          ] },
          { tip: "dugme", id: "sonraki", metin: av.sira + 1 < av.turlar.length ? "Sonraki han" : "Sandığı aç", ikon: "ok" },
        ] : []),
      ],
    };
  }

  function sonucEkrani() {
    const tam = av.altin === av.turlar.length;
    return {
      tip: "sutun", cocuklar: [
        { tip: "kapak", ust: `Toplam ${toplamAltin} altın`, baslik: tam ? "Sandık dopdolu!" : `${av.altin} altın buldun`,
          alt: `${sandikDizisi(av.altin, av.turlar.length)}  ${av.turlar.length} handan ${av.altin} tanesini buldun.`, renk: tam ? "altin" : "mercan", desen: `hazine-${av.altin}`,
          cocuklar: [
            { tip: "dugme", id: "tekrar", metin: "Yeniden ava çık", ikon: "tekrar" },
            { tip: "dugme", id: "sandik", metin: "Hazine sandığım", ikon: "kupa", tur: "ikincil" },
          ] },
        { tip: "baslik", metin: "Bu avdaki hanlar", boyut: 3 },
        { tip: "sutun", aralik: "dar", cocuklar: av.turlar.map((t) => ({ tip: "eser", eser: t.han, id: "eser", boyut: "satir" })) },
      ],
    };
  }

  function sandikEkrani() {
    return {
      tip: "sutun", cocuklar: [
        { tip: "ust_cubuk", baslik: "Hazine sandığım", geri: "kapak" },
        { tip: "izgara", sutun: 2, cocuklar: [
          { tip: "istatistik", deger: toplamAltin, etiket: "altın", ikon: "yildiz" },
          { tip: "istatistik", deger: hanlar.length, etiket: "han", ikon: "pusula" },
        ] },
        { tip: "baslik", metin: "Rozetler", boyut: 2 },
        { tip: "izgara", sutun: 2, cocuklar: rozetler.map((b) => ({ tip: "rozet", ad: b.ad, aciklama: b.aciklama, kazanildi: b.kazanildi })) },
        { tip: "dugme", id: "basla", metin: "Ava başla", ikon: "pusula" },
      ],
    };
  }
}
