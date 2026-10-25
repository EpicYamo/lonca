import { baglaninca } from "/ortak/animasyon.js";
import { ayarlariGetir } from "/ortak/ayarlar.js";

export const ODAK_ADI = { genel: "Genel görünüm", yakin: "Yakından", cati: "Çatı", yan: "Yandan", arka: "Arkadan", ust: "Kuşbakışı" };

export async function ucVarMi(eser) {
  const { uc } = await ayarlariGetir();
  return !!(uc?.google && uc.anahtar && Number.isFinite(eser?.konum?.lat) && Number.isFinite(eser?.konum?.lng));
}

export async function ucKur(kap, { eser, odak = "genel", noktalar = true, onOdak } = {}) {
  const bos = { var: false, git: async () => {}, odaklar: [], guncelle() {}, yokEt() {} };
  if (!(await ucVarMi(eser))) { kap.replaceChildren(aciklama(eser, "Bu eser için gerçek 3B görüntü yok.")); return bos; }
  try {
    await baglaninca(kap);
    const { gercekUcKur } = await import("./uc-gercek.js");
    const api = await gercekUcKur(kap, { anahtar: (await ayarlariGetir()).uc.anahtar, eser, odak, noktalar, onOdak });
    return { var: true, ...api, git: api.git, guncelle: api.guncelle, yokEt: api.yokEt, get odaklar() { return api.odaklar; } };
  } catch (h) {
    console.warn("Gerçek 3B açılamadı:", h.message);
    kap.replaceChildren(aciklama(eser, "Gerçek 3B şu an yüklenemedi (bağlantı ya da kota)."));
    return bos;
  }
}

function aciklama(eser, metin) {
  const kutu = document.createElement("div");
  kutu.className = "uc-yok";
  const foto = eser?.fotograflar?.[0];
  if (foto) { const img = document.createElement("img"); img.src = foto; img.alt = eser.ad ?? ""; kutu.append(img); }
  const p = document.createElement("p"); p.textContent = metin; kutu.append(p);
  return kutu;
}
