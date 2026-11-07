// Kullanıcının cihazında tutulan modül tercihleri: Modüllerim rafı (ekle/kaldır/sabitle), "Yeni" işaretleri ve modül izinleri.
// Hepsi localStorage'da; sunucuya hiçbir şey gitmez.

const oku = (k, varsayilan) => { try { return JSON.parse(localStorage.getItem(k)) ?? varsayilan; } catch { return varsayilan; } };
const yaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const RAF = "lonca.modullerim", BILINEN = "lonca.bilinen-moduller", YENI = "lonca.yeni-moduller", IZIN = "lonca.izinler";

// ---------- Raf ----------
const raf = () => {
  const r = oku(RAF, null);
  return { liste: Array.isArray(r?.liste) ? r.liste : [], sabit: Array.isArray(r?.sabit) ? r.sabit : [] };
};
export const raftaMi = (id) => raf().liste.includes(id);
export const sabitMi = (id) => raf().sabit.includes(id);
export function rafaEkle(id) {
  const r = raf();
  if (!r.liste.includes(id)) r.liste.unshift(id);
  yaz(RAF, r);
}
export function raftanKaldir(id) {
  const r = raf();
  r.liste = r.liste.filter((x) => x !== id);
  r.sabit = r.sabit.filter((x) => x !== id);
  yaz(RAF, r);
}
export function sabitle(id, sabit = !sabitMi(id)) {
  const r = raf();
  if (!r.liste.includes(id)) r.liste.unshift(id);
  r.sabit = r.sabit.filter((x) => x !== id);
  if (sabit) r.sabit.unshift(id);
  yaz(RAF, r);
  return sabit;
}
// Yayındaki modüllerden raftakiler: sabitlenenler önce, sonra rafa eklenme sırası (en yeni önde).
export function rafModulleri(moduller) {
  const r = raf(), bul = (id) => moduller.find((m) => m.id === id);
  const sabitler = r.sabit.map(bul).filter(Boolean);
  return [...sabitler, ...r.liste.filter((id) => !r.sabit.includes(id)).map(bul).filter(Boolean)];
}

// ---------- Yeni modüller ----------
// İlk açılışta mevcut liste "bilinen" sayılır (her şey yeni görünmesin); sonra listeye katılan her modül
// kullanıcı açana kadar "Yeni" kalır.
export function yenileriBul(moduller) {
  const idler = moduller.map((m) => m.id);
  const bilinen = oku(BILINEN, null);
  if (!Array.isArray(bilinen)) { yaz(BILINEN, idler); return []; }
  const gelenler = moduller.filter((m) => !bilinen.includes(m.id));
  const yeni = new Set(oku(YENI, []).filter((id) => idler.includes(id)));
  for (const m of gelenler) yeni.add(m.id);
  yaz(YENI, [...yeni]);
  yaz(BILINEN, idler);
  return gelenler;
}
export const yeniMi = (id) => oku(YENI, []).includes(id);
export const goruldu = (id) => yaz(YENI, oku(YENI, []).filter((x) => x !== id));

// ---------- İzinler ----------
export const IZIN_BILGISI = {
  konum: {
    ad: "Konum",
    neden: "Yakınındaki eserleri bulmak ve sana uzaklıklarını göstermek için. Konumun yalnızca yakındaki eserleri aramak için kullanılır; profilinde saklanmaz.",
    reddedilince: "Konum vermezsen uygulama örnek bir konumla (Bursa, Ulucami çevresi) çalışır.",
  },
};
const izinler = () => oku(IZIN, {});
export const izinDurumu = (modulId, izin) => izinler()[modulId]?.[izin]; // true · false · undefined (sorulmadı)
export function izinKaydet(modulId, izin, verildi) {
  const t = izinler();
  t[modulId] = { ...(t[modulId] ?? {}), [izin]: !!verildi };
  yaz(IZIN, t);
}
export const istenenIzinler = (m) => (Array.isArray(m?.izinler) ? m.izinler : []).filter((i) => IZIN_BILGISI[i]);
export const sorulmamisIzinler = (m) => istenenIzinler(m).filter((i) => izinDurumu(m.id, i) === undefined);
