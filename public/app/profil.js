
const ANAHTAR = "lonca.profil";
const RENKLER = ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"];

function oku(k, varsayilan) {
  try { return JSON.parse(localStorage.getItem(k)) ?? varsayilan; } catch { return varsayilan; }
}
function yaz(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export const seviyeHesapla = (puan) => Math.floor(Math.sqrt(Math.max(0, puan) / 40)) + 1;
export const seviyeEsigi = (seviye) => 40 * (seviye - 1) ** 2;

export function profilOku() {
  return oku(ANAHTAR, null);
}

export function profilKaydet({ ad, renk }) {
  const eski = profilOku() ?? { puan: 0, olusturma: Date.now() };
  const profil = {
    ...eski,
    ad: String(ad || "Gezgin").trim().slice(0, 24) || "Gezgin",
    renk: RENKLER.includes(renk) ? renk : "kobalt",
  };
  yaz(ANAHTAR, profil);
  return profil;
}

export function profilBilgi() {
  const p = profilOku() ?? { ad: "Gezgin", renk: "kobalt", puan: 0 };
  return { ad: p.ad, renk: p.renk, puan: p.puan ?? 0, seviye: seviyeHesapla(p.puan ?? 0) };
}

export function puanEkle(miktar) {
  const p = profilOku() ?? profilKaydet({ ad: "Gezgin", renk: "kobalt" });
  const onceki = seviyeHesapla(p.puan ?? 0);
  p.puan = Math.max(0, (p.puan ?? 0) + Math.max(0, Math.min(Number(miktar) || 0, 1000)));
  yaz(ANAHTAR, p);
  const seviye = seviyeHesapla(p.puan);
  return { puan: p.puan, seviye, seviyeAtladi: seviye > onceki };
}

const basarimAnahtari = (modulId) => `lonca.basarim.${modulId}`;

export function basarimTanimla(modulId, liste) {
  const kayit = oku(basarimAnahtari(modulId), { tanimlar: [], kazanilan: {} });
  kayit.tanimlar = (Array.isArray(liste) ? liste : []).slice(0, 30).map((b) => ({
    id: String(b?.id ?? "").slice(0, 40), ad: String(b?.ad ?? "").slice(0, 50), aciklama: b?.aciklama ? String(b.aciklama).slice(0, 140) : "",
  })).filter((b) => b.id && b.ad);
  yaz(basarimAnahtari(modulId), kayit);
}

export function basarimKazan(modulId, id, yedekAd) {
  const kayit = oku(basarimAnahtari(modulId), { tanimlar: [], kazanilan: {} });
  if (kayit.kazanilan[id]) return null;
  let tanim = kayit.tanimlar.find((b) => b.id === id);
  if (!tanim) { 
    tanim = { id, ad: yedekAd || id, aciklama: "" };
    kayit.tanimlar.push(tanim);
  }
  kayit.kazanilan[id] = Date.now();
  yaz(basarimAnahtari(modulId), kayit);
  return tanim;
}

export function basarimListe(modulId) {
  const kayit = oku(basarimAnahtari(modulId), { tanimlar: [], kazanilan: {} });
  return kayit.tanimlar.map((b) => ({ ...b, kazanildi: !!kayit.kazanilan[b.id] }));
}

export function basarimOzeti(modulId) {
  const liste = basarimListe(modulId);
  return { toplam: liste.length, kazanilan: liste.filter((b) => b.kazanildi).length };
}

export function tumBasarimlar(moduller) {
  return moduller.map((m) => ({ modul: m, basarimlar: basarimListe(m.id) })).filter((x) => x.basarimlar.length);
}

const depoAnahtari = (modulId) => `lonca.depo.${modulId}`;
const DEPO_SINIRI = 50_000; // karakter

export function depoOku(modulId, anahtar) {
  return oku(depoAnahtari(modulId), {})[anahtar] ?? null;
}

export function depoYaz(modulId, anahtar, deger) {
  const depo = oku(depoAnahtari(modulId), {});
  depo[String(anahtar).slice(0, 60)] = deger;
  const metin = JSON.stringify(depo);
  if (metin.length > DEPO_SINIRI) throw new Error("Modül deposu dolu (en fazla 50 KB)");
  yaz(depoAnahtari(modulId), depo);
}
