import { sahne, eserler, ekran, dalislar } from "@lonca/sdk";

// Vakıf Dalışları: uzaydan eserin içine uzun bir gezi.
//  1. Uydudan iniş: gerçek uydu görüntüsünde (Esri World Imagery) Dünya'dan şehre, şehirden esere kesintisiz
//     yakınlaşma; yol üstündeki eserler okla gösterilir.
//  2. Dışarıdan içeri: cephe, çatı, kapı.
//  3. Merkez ve kollar: geniş bir iç mekân karesinden her ayrıntıya (şadırvan, minber, mihrap…) dalınır,
//     kim yaptı / ne zaman / neden anlatılır, sonra merkeze geri çekilip sıradakine gidilir.
//  4. Gökyüzüne çıkış.
// Her durakta kamera ayrıntılara kayar, ok ve atan halka ile gösterir, yanında kaynaklı bilgi kartı belirir.
//
// Dalışlar sunucudan gelir (dalislar.liste()): elle hazırlananlar (araclar/dalis-modul.mjs) ve Studio'da dalış
// kalfasının hazırlayıp editörün onayladıkları. Yeni bir dalış onaylanınca burada kendiliğinden görünür.
// Kaynaklar: E = Vakıf Katılım envanteri (eser kaydı), V = Türkçe Vikipedi (CC BY-SA), G = genel bilgi.
// Künye, uydu işaretlerinin adları ve son kaynak satırı çalışma anında eser kayıtlarından çekilir.

const KAYNAK = { E: "Vakıf envanteri", V: "Vikipedi (CC BY-SA)", G: "Genel bilgi" };
const UYDU_KAYNAK = "Uydu: Esri World Imagery · konum: Vikipedi";
const KARE_EN = 1024, KARE_BOY = 1536; // dalis-uret.mjs kare boyutu (uydu konum hesabı için)

// Uydu karelerinde gösterilecek yerler (konumlar Vikipedi'den, uydu görüntüsüyle doğrulandı; kayıtlardaki
// konumlar yaklaşık olduğundan burada ayrıca tutulur).
const YERLER = [
  { id: "bursa-ulucami", lat: 40.18389, lng: 29.06194 },
  { id: "bursa-koza-hani", lat: 40.18444, lng: 29.06361 },
  { id: "bursa-orhan-bey-kulliyesi", lat: 40.18389, lng: 29.06417 },
  { id: "bursa-ii-murad-kulliyesi", lat: 40.19111, lng: 29.04667 },
  { id: "bursa-emir-sultan-kulliyesi", lat: 40.18111, lng: 29.08111 },
];
const SEHIR = { lat: 40.19722, lng: 29.06222 }, ULUDAG = { lat: 40.07056, lng: 29.22194 };


const TUR_ADI = { cami: "Cami", mescit: "Mescit", han: "Han", turbe: "Türbe", medrese: "Medrese", hamam: "Hamam", cesme: "Çeşme", kulliye: "Külliye", imaret: "İmaret", bedesten: "Bedesten" };
const kunyeMetni = (e) => [e.yuzyil ? `${e.yuzyil}. yüzyıl` : null, TUR_ADI[e.tur] ?? null, [e.ilce, e.il].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

function dunyaPx(lat, lng, z) {
  const n = 256 * 2 ** z, f = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2) * n];
}
// Bir konumun, merkezi (lat, lng) ve düzeyi z olan uydu karesindeki yeri (0–1); karede değilse null.
function karedeYer([lat, lng, z], yer) {
  const [cx, cy] = dunyaPx(lat, lng, z), [px, py] = dunyaPx(yer.lat, yer.lng, z);
  const x = 0.5 + (px - cx) / KARE_EN, y = 0.5 + (py - cy) / KARE_BOY;
  return x > 0.06 && x < 0.94 && y > 0.16 && y < 0.88 ? [x, y] : null;
}
const odakAlan = ([x, y], g) => [x - g / 2, y - g / 2, g];

function uyduBakislari(u, tanim, eser, kayitlar, bursaSayisi) {
  const [, , z, cikis] = u;
  if (cikis) return [];
  const b = [];
  const hedef = tanim.hedef ? { ...tanim.hedef } : null;
  if (!hedef) return b;
  if (z <= 9) {
    const n = karedeYer(u, SEHIR);
    if (n) b.push({ nokta: n, ust: "Uydudan", baslik: "Bursa", metin: `Lonca'da Bursa'dan ${bursaSayisi} vakıf eseri kayıtlı. Aşağı iniyoruz.`, kaynak: UYDU_KAYNAK });
    const d = z === 9 && karedeYer(u, ULUDAG);
    if (d) b.push({ nokta: d, ust: "Uydudan", baslik: "Uludağ", metin: "Şehrin güneydoğusunda yükselen dağ; Bursa onun eteklerine kurulmuştur.", kaynak: UYDU_KAYNAK });
    return b;
  }
  const hn = karedeYer(u, hedef);
  if (z >= 14) {
    for (const y of YERLER) {
      if (y.id === tanim.eser || b.length >= 2) continue;
      const n = karedeYer(u, y), k = kayitlar.get(y.id);
      if (n && k && (!hn || Math.hypot(n[0] - hn[0], n[1] - hn[1]) > 0.04)) b.push({ nokta: n, ust: "Yakında", baslik: k.ad, metin: kunyeMetni(k), kaynak: UYDU_KAYNAK });
    }
  }
  if (hn) b.push({
    nokta: hn, ...(z >= 16 ? { alan: odakAlan(hn, 0.55) } : {}), ust: "Hedef", baslik: hedef.ad ?? eser.ad,
    metin: `${hedef.not ? `${hedef.not} ` : ""}${kunyeMetni(eser)}. ${z >= 16 ? "Şimdi buraya iniyoruz." : "Yaklaşıyoruz."}`, kaynak: UYDU_KAYNAK,
  });
  return b;
}

async function dalisKur(tanim, kayitlar, bursaSayisi) {
  const eser = kayitlar.get(tanim.eser) ?? await eserler.getir(tanim.eser);
  const iliskiler = (await eserler.iliskiler(tanim.eser).catch(() => [])).filter((i) => i.diger);
  const N = tanim.kareler.length;
  const ilkGercek = tanim.kareler.findIndex((k) => !k.u);
  const kareler = tanim.kareler.map((k, i) => {
    let bakislar = k.u ? uyduBakislari(k.u, tanim, eser, kayitlar, bursaSayisi)
      : (k.k ?? []).map((x) => ({ nokta: x.n, alan: x.a, ust: x.u, baslik: x.b, metin: x.m, kaynak: KAYNAK[x.k] ?? x.k }));
    if (i === ilkGercek) bakislar.unshift({ ust: "Künye", baslik: eser.ad, metin: kunyeMetni(eser), kaynak: KAYNAK.E });
    if (i === N - 1) {
      for (const il of iliskiler.slice(0, 2)) bakislar.push({ ust: "Tarihsel bağ", baslik: il.diger.ad, metin: il.baslik || il.aciklama, kaynak: il.kaynak || KAYNAK.E });
      bakislar.push({ ust: "Kaynaklar", metin: `${eser.kaynak ?? "Vakıf Katılım"}; Türkçe Vikipedi (CC BY-SA); uydu görüntüsü Esri World Imagery (Esri, Maxar, Earthstar Geographics).` });
    }
    bakislar = bakislar.slice(0, 6);
    return {
      gorsel: `/medya/dalis/${tanim.eser}/${k.g}.jpg`, etiket: k.t, baslik: k.b ?? "", yazi: k.y,
      ...(k.c ? { cikis: k.c } : k.p ? { portal: k.p } : {}), bakislar,
    };
  });
  return { eser, kareler, iliskiler };
}

export default async function basla() {
  await sahne.ayarla({ baslik: "Vakıf Dalışları", tema: { zemin: "gece", renk: "altin", yazi: "serif" } });
  const bursa = await eserler.liste({ il: "Bursa" });
  const kayitlar = new Map(bursa.map((e) => [e.id, e]));
  const tanimlar = await dalislar.liste();
  const liste = tanimlar.map((d) => ({ ...d, e: kayitlar.get(d.eser) })).filter((d) => d.e);
  // Uydu karelerinde, gezisi olan bütün eserler de "yakında" diye gösterilir.
  for (const d of tanimlar) if (d.hedef && !d.hedef.ad && !YERLER.some((y) => y.id === d.eser)) YERLER.push({ id: d.eser, lat: d.hedef.lat, lng: d.hedef.lng });
  let acik = null; // { tanim, eser, kareler, iliskiler, uc }

  const ayrintiSayisi = (d) => d.kareler.reduce((t, k) => t + (k.k?.length ?? 0), 0);
  const lobi = () => ({
    tip: "sutun", cocuklar: [
      { tip: "kapak", ust: "Uzaydan içine", baslik: "Vakıf Dalışları", eser: liste[0]?.e,
        alt: "Bir eser seç ve kaydır: uydudan şehre in, kapıdan içeri gir, her ayrıntıya yaklaş ve geri çekil. Kamera her durakta oklarla gösterir ve anlatır.",
        cocuklar: liste.length ? [{ tip: "dugme", id: "sec:0", metin: `${liste[0].e.ad} ile başla`, ikon: "ok" }] : [] },
      ...(liste.length ? [] : [{ tip: "metin", metin: "Henüz yayında dalış yok.", soluk: true }]),
      { tip: "baslik", metin: "Geziler", boyut: 2 },
      ...liste.map((d, i) => ({ tip: "kart", cocuklar: [
        { tip: "eser", eser: d.e, id: `sec:${i}`, boyut: "satir" },
        { tip: "metin", metin: `${d.durum === "bekliyor" ? "Önizleme · onay bekliyor · " : ""}${d.ozet} · ${d.kareler.length} durak, ${ayrintiSayisi(d)}+ ayrıntı`, soluk: true },
      ] })),
      { tip: "metin", soluk: true, metin: "Rozetler her karenin kaynağını söyler: \"Uydu görüntüsü\" gerçek uydu fotoğrafıdır; \"Gerçek fotoğraf\" envanter fotoğrafıdır; \"kenarları YZ\", \"YZ ile netleştirildi\" ve \"YZ ile yeniden çizildi\" gerçek fotoğraftan türetilmiştir; \"Yapay zekâ canlandırması\" yolculuğu bağlamak için üretilmiş ara karedir ve mimari ayrıntıyı birebir belgelemez. Her bilgi kartı kaynağını gösterir." },
    ],
  });

  const dalis = () => ({
    tip: "sutun", cocuklar: [
      { tip: "ust_cubuk", baslik: acik.eser.ad, alt: "Kaydır, içine gir", geri: "lobi" },
      {
        tip: "dalis", id: acik.tanim.eser, etiket: `${acik.eser.ad}: uydudan içine kaydırmalı gezi`, kareler: acik.kareler,
        cocuklar: [
          { tip: "baslik", metin: acik.eser.ad, boyut: 2 },
          { tip: "fotograflar", eser: acik.eser },
          ...(acik.iliskiler.length ? [{ tip: "graf", id: "bag", merkez: acik.eser,
            iliskiler: acik.iliskiler.slice(0, 8).map((i) => ({ eser: i.diger, tur: i.tur, baslik: i.baslik })) }] : []),
          { tip: "metin", metin: `Kaynaklar: ${acik.eser.kaynak ?? "Vakıf Katılım"}; Türkçe Vikipedi (CC BY-SA); uydu görüntüsü Esri World Imagery.`, soluk: true },
          { tip: "satir", hizala: "yay", cocuklar: [
            ...(acik.uc ? [{ tip: "dugme", id: "uc", metin: "Gerçek 3B", ikon: "kup", tur: "ikincil" }] : []),
            { tip: "dugme", id: "hata", metin: "Hata bildir", ikon: "bilgi", tur: "hayalet" },
          ] },
          ...liste.filter((d) => d.eser !== acik.tanim.eser).map((d) => ({ tip: "dugme", id: `sec:${liste.indexOf(d)}`, metin: `Sıradaki gezi: ${d.e.ad}`, ikon: "ok", tur: "ana" })),
        ],
      },
    ],
  });

  await sahne.ciz(lobi());
  for await (const olay of sahne.olaylar()) {
    if (olay.tur !== "dokun") continue;
    if (olay.id.startsWith("sec:")) {
      const tanim = liste[Number(olay.id.slice(4))];
      if (!tanim) continue;
      const kurulan = await dalisKur(tanim, kayitlar, bursa.length);
      acik = { tanim, ...kurulan, uc: await ekran.ucVarMi(kurulan.eser) };
    } else if (olay.id === "lobi") {
      acik = null;
    } else if (olay.id === "uc" && acik) {
      await ekran.uc({ eser: acik.eser, baslik: acik.eser.ad, duraklar: [
        { odak: "genel", metin: "Eser ve çevresi bugün. Parmağınla çevir, iki parmakla yaklaş." },
        { odak: "ust", baslik: "Kuşbakışı", metin: "Yukarıdan bakınca yapının planı ve çevresiyle ilişkisi görünür." },
      ] });
      continue;
    } else if (olay.id === "hata" && acik) {
      await ekran.duzeltme(acik.eser);
      continue;
    } else continue;
    await sahne.ciz(acik ? dalis() : lobi());
  }
}
