// Atölye oturumları: Studio'daki kalfa sohbeti ve üzerinde çalışılan modül taslağı, kullanıcı başına sunucuda durur.
// Sayfa yenilense ya da kalfa isteği sürerken sekme kapansa bile ilerleme kaybolmaz; kalfanın yanıtı oturuma yazılır.
// Kayıtlar data/atolye/<sahip>.json'da (çalışma verisi, gitignore'da). Sahip: hesap kimliği; hesapsız yönetici
// (yönetici şifresi ya da geliştirme modu) için "yonetici".
import { randomBytes } from "node:crypto";
import path from "node:path";
import { jsonDosya } from "./depo.js";

export const MAKS_OTURUM = 40;
const MAKS_MESAJ = 200;
const KALFA_SOHBET_SINIRI = 30; // POST /api/kalfa'nın kabul ettiği en uzun sohbet
const MAKS_METIN = 4000;
const sahipGecerli = (s) => typeof s === "string" && /^[a-z0-9]{1,64}$/.test(s);
const simdi = () => new Date().toISOString();
const baslikYap = (metin) => { const t = String(metin).replace(/\s+/g, " ").trim(); return t.length > 80 ? `${t.slice(0, 79)}…` : t; };
const hataVer = (mesaj, kod) => Object.assign(new Error(mesaj), { kod });

// Admin'in izin kartındaki kararı sohbete bu cümleyle girer (istemcinin yazdığı metin değil): kalfa kararı her zaman aynı biçimde okur.
const IZIN_KARARLARI = { dis_kaynak: ["ver", "reddet"], kayit: ["bilgi-bankasi", "modul", "reddet"] };
function kararCumlesi(izin, karar) {
  const ad = `“${izin.konu}”`;
  if (izin.tur === "dis_kaynak") return karar === "ver"
    ? `İzin veriyorum: ${ad} için Vikipedi'den bilgi çekebilirsin.`
    : `İzin vermiyorum: ${ad} için dış kaynak kullanma; bilgi bankasındaki eserlerle devam et.`;
  const madde = izin.baslik ? ` (Vikipedi: ${izin.baslik})` : "";
  if (karar === "bilgi-bankasi") return `${ad}${madde} bilgi bankasına eklensin (kaynak: ${izin.kaynak_url}). Ekle ve modüle devam et.`;
  if (karar === "modul") return `${ad}${madde} bilgi bankasına eklenmesin; bilgiler yalnızca bu modüle özel kalsın. Modüle devam et.`;
  return `${ad}${madde} hiçbir yere eklenmesin; bu maddeyi kullanma.`;
}

export function atolyeKur(dizin) {
  const dosyalar = new Map();
  const kilitler = new Map();
  // Şu an kalfası çalışan oturumlar. Dosyada "bekleyen" görünüp burada olmayan iş, sunucu yeniden başladığı için yarım kalmıştır.
  const calisanlar = new Set();

  function dosya(sahip) {
    if (!sahipGecerli(sahip)) throw hataVer("geçersiz oturum sahibi", 400);
    if (!dosyalar.has(sahip)) dosyalar.set(sahip, jsonDosya(path.join(dizin, `${sahip}.json`), { oturumlar: [] }));
    return dosyalar.get(sahip);
  }
  // Aynı sahibin dosyasında oku-değiştir-yaz adımları sırayla yürür (taslak kaydı ile kalfa yanıtı birbirini ezmesin).
  function sirayla(sahip, is) {
    const onceki = kilitler.get(sahip) ?? Promise.resolve();
    const bu = onceki.catch(() => {}).then(async () => {
      const d = dosya(sahip);
      const veri = await d.oku();
      if (!Array.isArray(veri.oturumlar)) veri.oturumlar = [];
      const sonuc = await is(veri);
      if (sonuc?.yaz !== false) await d.yaz(veri);
      return sonuc?.deger;
    });
    kilitler.set(sahip, bu);
    return bu;
  }

  const anahtar = (sahip, id) => `${sahip}/${id}`;
  function yarimKalaniKapat(sahip, o) {
    if (!o.bekleyen || calisanlar.has(anahtar(sahip, o.id))) return false;
    o.mesajlar.push({ rol: "kalfa", metin: "Kalfanın yanıtı alınamadı (sunucu yeniden başlamış olabilir). İsteğini yeniden gönder.", hata: true, zaman: simdi() });
    o.bekleyen = null;
    return true;
  }
  const ozet = (o) => ({
    id: o.id, baslik: o.baslik, olusturma: o.olusturma, guncelleme: o.guncelleme,
    mesajSayisi: o.mesajlar.length, modul: o.taslak?.ad || o.taslak?.id || "", bekliyor: !!o.bekleyen,
  });
  function bul(veri, id) {
    const o = veri.oturumlar.find((x) => x.id === id);
    if (!o) throw hataVer("oturum bulunamadı", 404);
    return o;
  }
  function mesajEkle(o, m) {
    o.mesajlar.push({ ...m, zaman: simdi() });
    if (o.mesajlar.length > MAKS_MESAJ) o.mesajlar.splice(0, o.mesajlar.length - MAKS_MESAJ);
    if (!o.baslik && m.rol === "usta") o.baslik = baslikYap(m.metin);
    o.guncelleme = simdi();
  }

  async function liste(sahip) {
    return sirayla(sahip, (veri) => {
      const degisti = veri.oturumlar.map((o) => yarimKalaniKapat(sahip, o)).some(Boolean);
      const deger = [...veri.oturumlar].sort((a, b) => b.guncelleme.localeCompare(a.guncelleme)).map(ozet);
      return { deger, yaz: degisti };
    });
  }

  async function olustur(sahip, { taslak } = {}) {
    return sirayla(sahip, (veri) => {
      const zaman = simdi();
      const o = { id: randomBytes(6).toString("hex"), baslik: "", olusturma: zaman, guncelleme: zaman, mesajlar: [], taslak: taslak ?? null, bekleyen: null };
      veri.oturumlar.push(o);
      // En eski (en uzun süredir dokunulmayan) oturumlar silinir; çalışan kalfası olanlar korunur.
      while (veri.oturumlar.length > MAKS_OTURUM) {
        const eski = [...veri.oturumlar].filter((x) => x !== o && !calisanlar.has(anahtar(sahip, x.id)))
          .sort((a, b) => a.guncelleme.localeCompare(b.guncelleme))[0];
        if (!eski) break;
        veri.oturumlar.splice(veri.oturumlar.indexOf(eski), 1);
      }
      return { deger: o };
    });
  }

  async function getir(sahip, id) {
    return sirayla(sahip, (veri) => {
      const o = bul(veri, id);
      return { deger: o, yaz: yarimKalaniKapat(sahip, o) };
    });
  }

  async function taslakYaz(sahip, id, taslak) {
    return sirayla(sahip, (veri) => {
      const o = bul(veri, id);
      o.taslak = taslak;
      o.guncelleme = simdi();
      return { deger: { guncelleme: o.guncelleme } };
    });
  }

  async function sil(sahip, id) {
    return sirayla(sahip, (veri) => {
      const i = veri.oturumlar.findIndex((x) => x.id === id);
      if (i < 0) throw hataVer("oturum bulunamadı", 404);
      if (calisanlar.has(anahtar(sahip, id))) throw hataVer("Kalfa bu sohbette hâlâ çalışıyor; bitince silebilirsin", 409);
      veri.oturumlar.splice(i, 1);
      return { deger: { silindi: id } };
    });
  }

  // Kalfaya gidecek sohbet oturumdan kurulur: hatalı yanıtlar ve onlara yol açan istekler, dalış mesajları atlanır.
  function kalfaSohbeti(o, istek) {
    const m = o.mesajlar;
    const temiz = m.filter((x, i) => !x.dalis && !x.hata && !(x.rol === "usta" && (m[i + 1]?.hata || m[i + 1]?.dalis)) && x.metin)
      .map((x) => ({ rol: x.rol, metin: x.metin.slice(0, MAKS_METIN) }));
    const sohbet = [...temiz.slice(-(KALFA_SOHBET_SINIRI - 1)), { rol: "usta", metin: istek }];
    while (sohbet.length > 1 && sohbet[0].rol !== "usta") sohbet.shift();
    return sohbet;
  }

  // İsteği oturuma yazar ve oturumu "bekleyen" yapar; kalfayı çağıran taraf bitince kalfaBitir'i çağırmalı.
  // izin: { id, karar } verilirse oturumdaki bekleyen izin karara bağlanır ve istek kararın cümlesi olur (yalnızca admin; uygulama.js denetler).
  async function kalfaBaslat(sahip, id, { istek, kod, izin = null }) {
    return sirayla(sahip, (veri) => {
      const o = bul(veri, id);
      yarimKalaniKapat(sahip, o);
      if (o.bekleyen) throw hataVer("Kalfa bu sohbette hâlâ çalışıyor; yanıtını bekle", 409);
      o.kalfaDurumu ??= { izinler: [], disKaynaklar: [] };
      if (izin) {
        const i = o.kalfaDurumu.izinler.find((x) => x.id === izin.id);
        if (!i) throw hataVer("izin bulunamadı", 404);
        if (i.durum !== "bekliyor") throw hataVer("Bu izin zaten yanıtlandı", 409);
        if (!IZIN_KARARLARI[i.tur]?.includes(izin.karar)) throw hataVer(`karar: ${IZIN_KARARLARI[i.tur]?.join(" | ")}`, 400);
        i.durum = izin.karar === "reddet" ? "reddedildi" : "verildi";
        i.karar = izin.karar;
        i.yanit = simdi();
        istek = kararCumlesi(i, izin.karar);
      }
      const sohbet = kalfaSohbeti(o, istek);
      mesajEkle(o, { rol: "usta", metin: istek });
      if (kod != null) o.taslak = { ...(o.taslak ?? {}), kod };
      o.bekleyen = { baslangic: simdi() };
      calisanlar.add(anahtar(sahip, id));
      return { deger: { sohbet, istek, kalfaDurumu: structuredClone(o.kalfaDurumu) } };
    });
  }

  async function kalfaBitir(sahip, id, { sonuc, hata, ayrintilar = [] }) {
    try {
      return await sirayla(sahip, (veri) => {
        const o = veri.oturumlar.find((x) => x.id === id);
        if (!o) return { yaz: false };
        o.bekleyen = null;
        if (hata) {
          mesajEkle(o, { rol: "kalfa", metin: ayrintilar.length ? `${hata}\n• ${ayrintilar.join("\n• ")}` : hata, hata: true });
          return {};
        }
        if (sonuc.kalfaDurumu) o.kalfaDurumu = sonuc.kalfaDurumu;
        const ek = {
          aramalar: sonuc.aramalar ?? [], model: sonuc.model ?? null, kaynaklar: sonuc.kaynaklar ?? null, oneriler: sonuc.oneriler ?? [],
          ...(sonuc.izin && { izin: sonuc.izin }), ...(sonuc.eserIstegi && { eserIstegi: sonuc.eserIstegi }),
          ...(sonuc.disKaynaklar?.length && { disKaynaklar: sonuc.disKaynaklar }),
        };
        // Sohbet yanıtı (kod yazılmadı): yalnızca mesaj eklenir, taslak olduğu gibi kalır.
        if (sonuc.tur === "sohbet") {
          mesajEkle(o, { rol: "kalfa", metin: sonuc.metin ?? "", ek: { ...ek, tur: "sohbet" } });
          return {};
        }
        mesajEkle(o, { rol: "kalfa", metin: sonuc.aciklama_ustaya ?? "", ek: { ...ek, tur: "modul", deneme: sonuc.deneme ?? 1 }, uretim: true });
        o.taslak = {
          kod: sonuc.kod, ad: sonuc.ad ?? "", id: sonuc.id ?? "", aciklama: sonuc.aciklama ?? "",
          renk: sonuc.renk ?? "", ikon: sonuc.ikon === "genel" ? "" : (sonuc.ikon ?? ""), kategori: sonuc.kategori ?? "",
        };
        return {};
      });
    } finally {
      calisanlar.delete(anahtar(sahip, id));
    }
  }

  // Dalış kipindeki istek: iş sunucuda sürer (dalis-kalfasi.js); oturum yalnızca isteği ve iş kimliğini tutar.
  async function dalisEkle(sahip, id, { istek, is }) {
    return sirayla(sahip, (veri) => {
      const o = bul(veri, id);
      mesajEkle(o, { rol: "usta", metin: istek });
      mesajEkle(o, { rol: "kalfa", metin: "", dalis: is });
      return {};
    });
  }

  return { liste, olustur, getir, taslakYaz, sil, kalfaBaslat, kalfaBitir, dalisEkle };
}
