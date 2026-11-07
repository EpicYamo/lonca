// Çevrimdışı API: Android paketindeki veri anlık görüntüsünden (mobil/anlik/veri.json) sunucunun okuma uçlarını
// birebir taklit eder. Yalnızca uygulama Lonca sunucusuna ulaşamadığında kullanılır.
import { tamlikSuzgeci } from "/mobil/dogrulama.js";

let veri = null;
const yukle = () => (veri ??= fetch("/mobil/anlik/veri.json").then((y) => y.json()));

const json = (govde, durum = 200) => new Response(JSON.stringify(govde), { status: durum, headers: { "content-type": "application/json; charset=utf-8" } });

function mesafe(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// server/uygulama.js /api/vitrin ile aynı hesap (günün eseri her gün değişsin diye cihazda yapılır).
function vitrin({ eserler, moduller }) {
  const havuz = eserler.filter((e) => e.fotograflar?.length);
  const sabitSayi = (metin) => [...String(metin)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ozetEser = (e) => ({ id: e.id, ad: e.ad, tur: e.tur, ilce: e.ilce, yuzyil: e.yuzyil, foto: e.fotograflar[0] });
  const ilginc = (metin) => {
    const cumleler = String(metin).split(/(?<=[.!?])\s+/).filter(Boolean);
    const anlatan = cumleler.filter((c) => !/(Caddesi|Sokak|Sokağı|Mahallesi|No:|yer almaktadır|bulunmaktadır|konumlanmaktadır)/i.test(c));
    const m = (anlatan.length ? anlatan : cumleler).slice(0, 2).join(" ");
    return m.length <= 280 ? m : `${m.slice(0, 280).replace(/\s+\S*$/, "")}…`;
  };
  const gun = Math.floor(Date.now() / 86_400_000);
  const tam = havuz.filter((e) => e.yuzyil && e.tarihce?.tr);
  const gununEseri = tam.length ? tam[gun % tam.length] : havuz[0] ?? null;
  const secki = [];
  for (let i = 0; i < havuz.length && secki.length < 10; i++) {
    const e = havuz[(gun * 7 + i * 13) % havuz.length];
    if (e !== gununEseri && !secki.includes(e)) secki.push(e);
  }
  const kapaklar = Object.fromEntries(moduller.map((m) => {
    const secilen = m.kapakEser && eserler.find((e) => e.id === m.kapakEser && e.fotograflar?.length);
    if (secilen) return [m.id, { foto: secilen.fotograflar[0], eser: secilen.ad }];
    const uygun = havuz.filter((e) => !m.ikon || m.ikon === "genel" || e.tur === m.ikon);
    const liste = uygun.length ? uygun : havuz;
    const e = liste[sabitSayi(m.id) % Math.max(1, liste.length)];
    return [m.id, e ? { foto: e.fotograflar[0], eser: e.ad } : null];
  }));
  return {
    sayilar: { eser: eserler.length, fotografli: havuz.length, konumlu: eserler.filter((e) => e.konum).length, ilce: new Set(eserler.map((e) => e.ilce).filter(Boolean)).size },
    gununEseri: gununEseri && { ...ozetEser(gununEseri), ozet: ilginc(gununEseri.tarihce.tr), fotoSayisi: gununEseri.fotograflar.length },
    secki: secki.map(ozetEser),
    kapaklar,
  };
}

export async function yanitla(url) {
  const v = await yukle();
  const yol = url.pathname.replace(/\/+$/, "");
  const q = Object.fromEntries(url.searchParams);
  const { eserler } = v;
  const kucuk = (x) => String(x ?? "").toLocaleLowerCase("tr");
  let m;

  if (yol === "/api/ayarlar") return json(v.ayarlar);
  if (yol === "/api/eserler") {
    const uygun = tamlikSuzgeci(q);
    return json(eserler.filter((e) => (!q.il || e.il === q.il) && (!q.ilce || e.ilce === q.ilce) && (!q.tur || e.tur === q.tur)
      && (!q.ad || kucuk(e.ad).includes(kucuk(q.ad))) && (!q.yuzyil || e.yuzyil === Number(q.yuzyil)) && uygun(e)));
  }
  if (yol === "/api/eserler/yakin") {
    const lat = Number(q.lat), lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ hata: "lat ve lng gerekli" }, 400);
    const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 50);
    return json(eserler.filter((e) => e.konum && (!q.tur || e.tur === q.tur))
      .map((e) => ({ ...e, mesafe_m: mesafe({ lat, lng }, e.konum) }))
      .sort((a, b) => a.mesafe_m - b.mesafe_m).slice(0, limit));
  }
  if ((m = yol.match(/^\/api\/eserler\/([^/]+)$/))) {
    const e = eserler.find((x) => x.id === decodeURIComponent(m[1]));
    return e ? json(e) : json({ hata: "eser bulunamadı" }, 404);
  }
  if (yol === "/api/eser-iliskileri") {
    if (!q.eser) return json(v.iliskiler);
    return json(v.iliskiler.filter((i) => i.a === q.eser || i.b === q.eser)
      .map((i) => ({ ...i, diger: eserler.find((e) => e.id === (i.a === q.eser ? i.b : i.a)) ?? null })));
  }
  if (yol === "/api/vitrin") return json(vitrin(v));
  if (yol === "/api/moduller") return json(v.moduller);
  if ((m = yol.match(/^\/api\/moduller\/([a-z0-9-]{1,64})\/kod$/))) {
    if (!v.moduller.some((x) => x.id === m[1])) return json({ hata: "modül bulunamadı" }, 404);
    const y = await fetch(`/mobil/anlik/moduller/${m[1]}.js`);
    return new Response(await y.text(), { status: 200, headers: { "content-type": "text/javascript; charset=utf-8" } });
  }
  if (yol === "/api/dalislar") return json(v.dalislar);
  return json({ hata: "Bu bölüm çevrimdışıyken kullanılamıyor. Lonca sunucusuna bağlanınca açılır." }, 503);
}

export const anlikTarihi = async () => (await yukle()).olusturma;
