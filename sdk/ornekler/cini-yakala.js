// Örnek gerçek zamanlı oyun: düşen çinileri parmakla sürüklenen sepetle yakala. Her 5 çinide bir vakıf eserinin
// fotoğrafı tuvalin üstünde kart olarak açılır. Gösterdikleri: tuval düğümü, oyun.dongu (dt), oyun.dokunmalar
// (tut-sürükle), klavye (ok tuşları), oyun.ses, oyun.titres, kalem.gorsel ile eser fotoğrafı, cocuklar ile katman, rekor.
// Tuval TAM EKRANDIR (en/boy verilmez): boyutu ekranın gerçek boyutudur (telefonda dar ve uzun, web'de geniş). Her karede
// oyun.boyut ile okunur; bütün konum ve büyüklükler en/boy'a oranla kurulur, sabit 360 × 640 yoktur.
import { sahne, eserler, oyun, depo, profil } from "@lonca/sdk";

let EN = 360, BOY = 640, O = 1;    // tuvalin gerçek boyutu ve ölçek (her karede oyun.boyut ile güncellenir)
const SEPET = { en: 84, boy: 18, y: BOY - 70 };
function olcuOku() {
  ({ en: EN, boy: BOY } = oyun.boyut("alan"));
  O = Math.min(EN / 360, BOY / 640);                          // 360 × 640'lık telefonda 1; büyük ekranda büyür
  SEPET.en = 84 * O; SEPET.boy = 18 * O; SEPET.y = BOY - 70 * O;  // sepet hep altta, parmağın üstünde
}

export default async function basla() {
  const fotolu = eserler.karistir(await eserler.liste({ gerekli: ["fotograf"] }));
  let rekor = (await depo.oku("rekor")) ?? 0;
  /** @type {any} */
  let d = null;              // oyun durumu
  let gorunum = "kapak";     // kapak | oyun | eser | bitti (ad "ekran" değil: SDK'daki ekran ile karışmasın)
  let gosterilen = null;     // katmanda gösterilen eser

  await sahne.ayarla({ baslik: "Çini Yakala", tema: { zemin: "gece", renk: "firuze", yazi: "sans" } });
  await ciz();

  for await (const olay of sahne.olaylar()) {
    if (olay.tur !== "dokun") continue;
    if (olay.id === "basla" || olay.id === "tekrar") yeniOyun();
    else if (olay.id === "devam") { gorunum = "oyun"; gosterilen = null; oyun.dongu(adim); }
    else if (olay.id === "kapak") { oyun.durdur(); gorunum = "kapak"; }
    await ciz();
  }

  function yeniOyun() {
    olcuOku();
    d = { x: EN / 2, cini: [], dogma: 0, puan: 0, can: 3, hiz: 160, sonEser: 0 };
    gorunum = "oyun";
    oyun.dongu(adim);
  }

  // Her karede: girdiyi oku → durumu dt ile güncelle → çiz. Burada await yok.
  function adim(dt) {
    olcuOku();                                                   // ekran dönebilir, pencere büyüyebilir
    const parmak = oyun.dokunmalar("alan")[0];
    if (parmak) d.x = parmak.x;                                  // tut-sürükle: sepet parmağı izler
    if (oyun.tus("ArrowLeft")) d.x -= 320 * O * dt;             // web: ok tuşları
    if (oyun.tus("ArrowRight")) d.x += 320 * O * dt;
    d.x = oyun.sinirla(d.x, SEPET.en / 2, EN - SEPET.en / 2);

    d.dogma -= dt;
    if (d.dogma <= 0) { d.dogma = Math.max(0.35, 1.1 - d.puan * 0.03); d.cini.push({ x: oyun.rastgele(20 * O, EN - 20 * O), y: -20 * O, r: 14 * O }); }
    const sepet = { x: d.x - SEPET.en / 2, y: SEPET.y, en: SEPET.en, boy: SEPET.boy };
    for (const c of d.cini) {
      c.y += (d.hiz + d.puan * 6) * O * dt;
      if (!c.bitti && oyun.carpisir({ x: c.x - c.r, y: c.y - c.r, en: c.r * 2, boy: c.r * 2 }, sepet)) {
        c.bitti = true; d.puan++; oyun.ses("puan"); oyun.titres("hafif");
      } else if (!c.bitti && c.y > BOY + c.r) {
        c.bitti = true; d.can--; oyun.ses("hata"); oyun.titres("orta");
      }
    }
    d.cini = d.cini.filter((c) => !c.bitti);
    cizAlan();
    if (d.can <= 0) return bitir();
    if (d.puan > 0 && d.puan % 5 === 0 && d.sonEser !== d.puan && fotolu.length) {
      d.sonEser = d.puan;                                        // ödül: bir eserin fotoğrafı
      gosterilen = fotolu[(d.puan / 5 - 1) % fotolu.length];
      oyun.durdur(); oyun.ses("gol"); gorunum = "eser"; ciz();
    }
  }

  function cizAlan() {
    oyun.ciz("alan", (k) => {
      k.temizle("#0b1430");
      for (let y = 0; y < BOY; y += 120 * O) k.cizgi(0, y, EN, y + 60 * O, "rgba(255,255,255,.04)", 30 * O);
      for (const c of d.cini) k.kaydet().tasi(c.x, c.y).dondur(c.y / 60).dikdortgen(-c.r, -c.r, c.r * 2, c.r * 2, "#3fb5a8", { yuvarlak: 4 * O, cizgi: "#e8f6f3", kalinlik: 2 }).geriYukle();
      k.dikdortgen(d.x - SEPET.en / 2, SEPET.y, SEPET.en, SEPET.boy, "#e8b04a", { yuvarlak: SEPET.boy / 2 });
      // Skor sol üstte, can sağ üstte: uygulamanın köşedeki kapat düğmesinin altına (y = 72) yazılır.
      k.yazi(d.puan, 18, 72, { boyut: 26 * O, kalin: true });
      k.yazi("♥".repeat(d.can), EN - 18, 72, { boyut: 22 * O, renk: "#ff6b6b", hiza: "sag" });
      if (fotolu.length) k.gorsel(fotolu[0], EN - 60 * O, BOY - 34 * O, 44 * O, 26 * O, { yuvarlak: 6 });
    });
  }

  async function bitir() {
    oyun.durdur();
    oyun.ses("kaybettin");
    if (d.puan > rekor) { rekor = d.puan; await depo.yaz("rekor", rekor); }
    if (d.puan) await profil.puanEkle(d.puan, "Çini Yakala");
    gorunum = "bitti";
    await ciz();
  }

  // Ekran: kapak (lobi) ya da tam ekran tuval; eser ve oyun sonu kartları tuvalin üstünde katman olarak açılır.
  function ciz() {
    if (gorunum === "kapak") {
      return sahne.ciz({ tip: "kapak", ust: "Oyun", baslik: "Çini Yakala", eser: fotolu[0], alt: `Parmağınla sepeti sürükle, çinileri yakala. Rekor: ${rekor}`,
        cocuklar: [{ tip: "dugme", id: "basla", metin: "Başla", ikon: "oyun" }] });
    }
    const katman = [];
    if (gorunum === "eser" && gosterilen) {
      katman.push({ tip: "kart", cocuklar: [
        { tip: "baslik", metin: `${d.puan} çini!`, boyut: 2 },
        { tip: "eser", eser: gosterilen, id: "eser", boyut: "buyuk" },
        { tip: "metin", metin: gosterilen.kaynak, soluk: true },
        { tip: "dugme", id: "devam", metin: "Devam", ikon: "ok" },
      ] });
    } else if (gorunum === "bitti") {
      katman.push({ tip: "kart", cocuklar: [
        { tip: "baslik", metin: "Oyun bitti", boyut: 2 },
        { tip: "istatistik", deger: d.puan, etiket: `Puan · rekor ${rekor}`, ikon: "kupa" },
        { tip: "satir", cocuklar: [{ tip: "dugme", id: "tekrar", metin: "Yeniden", ikon: "tekrar" }, { tip: "dugme", id: "kapak", metin: "Menü", tur: "ikincil" }] },
      ] });
    }
    return sahne.ciz({ tip: "sutun", aralik: "dar", cocuklar: [
      { tip: "tuval", id: "alan", arkaplan: "#0b1430", etiket: "Çini yakalama alanı", cocuklar: katman }, // en/boy yok: tam ekran
    ] });
  }
}
