import { modulCalistir } from "./calistirici.js";
import { ekranYontemleri, TUR_ADI } from "./ekranlar.js";
import { sahneOlustur } from "./sahne.js";
import * as profil from "./profil.js";
import { ciniArkaPlan } from "/ortak/cini.js";
import { cizim } from "/ortak/cizimler.js";
import { gecis, ciz, yildizSac, hareketAzalt } from "/ortak/animasyon.js";
import { loncaLogo } from "/ortak/logo.js";
import { modulSurumu } from "/ortak/arama.js";
import * as raf from "./modullerim.js";
import { eserSayfasiKur } from "./eser-sayfasi.js";

const $ = (s) => document.querySelector(s);
export const el = (etiket, ozellik = {}, ...cocuklar) => {
  const d = Object.assign(document.createElement(etiket), ozellik);
  d.append(...cocuklar.flat().filter((c) => c != null));
  return d;
};

const ONIZLEME = new URLSearchParams(location.search).has("onizleme");

const DEMO_KONUM = { lat: 40.1836, lng: 29.0625 };

const depo = {
  oku(k, varsayilan = null) { try { return JSON.parse(localStorage.getItem(k)) ?? varsayilan; } catch { return varsayilan; } },
  yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const VARSAYILAN_TERCIH = { yazi: "1", okunakli: false, aralik: false, kontrast: false, renkDostu: false, sade: false,
  odak: false, hareket: false, buyukHedef: false, ses: false, dokunOku: false, sesHizi: 1 };
const SINIF = { okunakli: "okunakli", aralik: "aralik", kontrast: "kontrast", renkDostu: "renk-dostu", sade: "sade", odak: "belirgin-odak", hareket: "hareket-az", buyukHedef: "buyuk-hedef" };
const tercih = { ...VARSAYILAN_TERCIH, ...depo.oku("lonca.erisim", {}) };
if (depo.oku("buyuk-yazi", false)) tercih.yazi = "1.3";
if (depo.oku("yuksek-kontrast", false)) tercih.kontrast = true;
if (depo.oku("sesli-oku", false)) tercih.ses = true;

function tercihUygula() {
  const kok = document.documentElement;
  kok.style.setProperty("--olcek", String(Number(tercih.yazi) || 1));
  for (const [ad, sinif] of Object.entries(SINIF)) kok.classList.toggle(sinif, !!tercih[ad]);
  document.querySelectorAll("[data-tercih]").forEach((k) => { k.checked = !!tercih[k.dataset.tercih]; });
  const radyo = document.querySelector(`input[name="yazi"][value="${tercih.yazi}"]`);
  if (radyo) radyo.checked = true;
  $("#ses-hizi").value = String(tercih.sesHizi);
  $("#ses-hizi").setAttribute("aria-valuetext", tercih.sesHizi < 0.9 ? "yavaş" : tercih.sesHizi > 1.15 ? "hızlı" : "normal");
  depo.yaz("lonca.erisim", tercih);
}
document.querySelectorAll("[data-tercih]").forEach((k) => k.addEventListener("change", () => { tercih[k.dataset.tercih] = k.checked; tercihUygula(); }));
document.querySelectorAll('input[name="yazi"]').forEach((r) => r.addEventListener("change", () => { tercih.yazi = r.value; tercihUygula(); }));
$("#ses-hizi").addEventListener("input", (e) => { tercih.sesHizi = Number(e.target.value); tercihUygula(); });
$("#ses-hizi").addEventListener("change", () => seslendir("Okuma hızı böyle.", true));
$("#erisim-sifirla").addEventListener("click", () => { Object.assign(tercih, VARSAYILAN_TERCIH); tercihUygula(); });
tercihUygula();

document.addEventListener("focusin", (e) => {
  if (!tercih.dokunOku) return;
  const o = e.target.closest?.("button, a, input, [role=radio], [role=tab]");
  if (!o) return;
  const ad = o.getAttribute("aria-label") || o.labels?.[0]?.innerText || o.innerText || o.title;
  if (ad) seslendir(ad.replace(/\s+/g, " ").trim().slice(0, 140), true);
});

let ayarAcan = null;
function ayarlar(ac, dugme) {
  $("#ayarlar").hidden = !ac;
  document.querySelectorAll("[data-ayar]").forEach((d) => d.setAttribute("aria-expanded", String(ac)));
  if (ac) { ayarAcan = dugme; document.querySelector(`input[name="yazi"]:checked`)?.focus(); } else ayarAcan?.focus();
}
document.querySelectorAll("[data-ayar]").forEach((d) => d.addEventListener("click", () => ayarlar(true, d)));
$("#ayar-kapat").addEventListener("click", () => ayarlar(false));
$("#ayarlar").addEventListener("click", (e) => { if (e.target === e.currentTarget) ayarlar(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ayarlar").hidden) ayarlar(false); });

let turkceSes = null;
function sesBul() {
  const sesler = speechSynthesis.getVoices();
  turkceSes = sesler.find((v) => v.lang?.toLowerCase().startsWith("tr")) ?? null;
  $("#ses-notu").textContent = sesler.length && !turkceSes ? "Bu cihazda Türkçe ses bulunamadı, sesli okuma çalışmayacak." : "";
}
if ("speechSynthesis" in window) { sesBul(); speechSynthesis.addEventListener("voiceschanged", sesBul); }
else $("#ses-notu").textContent = "Bu tarayıcı sesli okumayı desteklemiyor.";
function seslendir(metin, zorla = false) {
  if ((!tercih.ses && !zorla) || !turkceSes || !("speechSynthesis" in window)) return;
  if (zorla && !tercih.ses && !tercih.dokunOku) return;
  speechSynthesis.cancel();
  const s = new SpeechSynthesisUtterance(metin);
  s.voice = turkceSes; s.lang = turkceSes.lang; s.rate = tercih.sesHizi;
  speechSynthesis.speak(s);
}

async function api(yol) {
  const y = await fetch(yol);
  if (!y.ok) throw new Error((await y.json().catch(() => ({}))).hata ?? `İstek başarısız (${y.status})`);
  return y;
}
function konumAl() {
  return new Promise((coz) => {
    if (!navigator.geolocation) return coz({ ...DEMO_KONUM, ornek: true });
    navigator.geolocation.getCurrentPosition(
      (p) => coz({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => coz({ ...DEMO_KONUM, ornek: true }),
      { timeout: 4000, maximumAge: 60000 },
    );
  });
}

function sahneyeKoy(...dugumler) {
  const sahne = $("#sahne");
  const kap = el("div", { className: "ekran-gecis" }, ...dugumler);
  const degistir = () => { sahne.replaceChildren(kap); scrollTo(0, 0); };
  const g = sahne.childElementCount ? gecis(degistir, "ileri") : (degistir(), null);
  if (g) kap.classList.add("vt");
  const odakla = () => { if (!ONIZLEME) (kap.querySelector("button") ?? sahne).focus?.({ preventScroll: true }); };
  g ? g.updateCallbackDone.then(odakla, odakla) : odakla();
  acilisBitir();
  return kap;
}

const katman = {
  kullaniciKapatti: null, 
  temizle: null,          
  koy(...dugumler) {
    const kap = el("div", { className: "ekran-gecis" }, ...dugumler);
    $("#katman-icerik").replaceChildren(kap);
    $("#katman-icerik").scrollTop = 0;
    $("#katman").hidden = false;
    acilisBitir();
    if (!ONIZLEME) requestAnimationFrame(() => (kap.querySelector("button") ?? kap).focus?.({ preventScroll: true }));
    return kap;
  },
  kapat() { $("#katman").hidden = true; $("#katman-icerik").replaceChildren(); },
  kullaniciIleKapat() {
    if ($("#katman").hidden) return;
    katman.temizle?.();
    katman.kapat();
    const coz = katman.kullaniciKapatti;
    katman.kullaniciKapatti = null;
    coz?.();
  },
};
$("#katman-kapat").addEventListener("click", () => katman.kullaniciIleKapat());
$("#katman").addEventListener("click", (e) => { if (e.target === e.currentTarget) katman.kullaniciIleKapat(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !$("#ayarlar").hidden) return;
  if (!$("#katman").hidden) katman.kullaniciIleKapat();
});

const ZEMINLER = ["acik", "parsomen", "koyu", "gece"];
const RENK_ADLARI = ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"];
function temaUygula(tema, varsayilanRenk) {
  const ekran = $("#modul-ekrani");
  ekran.dataset.zemin = ZEMINLER.includes(tema?.zemin) ? tema.zemin : "acik";
  ekran.dataset.renk = RENK_ADLARI.includes(tema?.renk) ? tema.renk : RENK_ADLARI.includes(varsayilanRenk) ? varsayilanRenk : "kobalt";
  ekran.dataset.yazi = tema?.yazi === "sans" ? "sans" : "serif";
  const koyu = ekran.dataset.zemin === "koyu" || ekran.dataset.zemin === "gece";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", koyu ? "#0b0f1c" : "#142763");
}

function ilerlemeAyarla(adim, toplam) {
  const cubuk = $("#ilerleme");
  if (!toplam) { cubuk.hidden = true; return; }
  const oran = Math.max(0, Math.min(1, adim / toplam));
  cubuk.hidden = false;
  cubuk.setAttribute("aria-valuenow", String(Math.round(oran * 100)));
  cubuk.setAttribute("aria-valuetext", `${toplam} adımdan ${adim}`);
  cubuk.firstElementChild.style.transform = `scaleX(${oran})`;
}

function bildir(metin, { tur = "bilgi", sure = 2600 } = {}) {
  const b = el("div", { className: `bildirim ${tur}`, role: "status" });
  if (tur === "basarim") {
    const muhur = el("span", { className: "bildirim-muhur", ariaHidden: "true" });
    muhur.innerHTML = '<svg viewBox="0 0 120 120"><g><rect x="22" y="22" width="76" height="76" rx="6"/><rect x="22" y="22" width="76" height="76" rx="6" transform="rotate(45 60 60)"/></g><circle cx="60" cy="60" r="28"/></svg>';
    b.append(muhur);
  }
  b.append(el("span", { textContent: String(metin).slice(0, 120) }));
  $("#bildirimler").append(b);
  if (tur === "basarim") requestAnimationFrame(() => yildizSac(b.querySelector(".bildirim-muhur"), 18));
  setTimeout(() => { b.classList.add("gidiyor"); setTimeout(() => b.remove(), 400); }, sure);
  seslendir(String(metin));
}

function yontemlerOlustur(modul) {
  return (gonder) => {
    let uygulamaModu = false;
    const hedefKoy = (...d) => (uygulamaModu ? katman.koy(...d) : sahneyeKoy(...d));
    const ekranlar = ekranYontemleri({
      el, sahneyeKoy: hedefKoy, seslendir, ilerlemeAyarla, onizleme: ONIZLEME, duzeltmeAc: (e) => duzeltmeIste(e),
      rozetKaydet: ({ ad }) => {
        const t = profil.basarimKazan(modul.id, `rozet-${ad}`, ad);
        if (t) profil.puanEkle(25);
      },
    });
    const KAPATILINCA = { "ekran.soru": { secim: -1, metin: "", dogru: null }, "ekran.harita": null, "ekran.galeri": null };
    let sonCagri = 0;
    const sarili = Object.fromEntries(Object.entries(ekranlar).filter(([ad]) => !ad.startsWith("_")).map(([ad, f]) => [ad, async (...a) => {
      const bu = ++sonCagri;
      if (!uygulamaModu || ad === "ekran.ilerleme" || ad === "ekran.ucVarMi") return f(...a); 
      try {
        const kapatildi = new Promise((coz) => { katman.kullaniciKapatti = () => coz(KAPATILINCA[ad]); });
        return await Promise.race([f(...a), kapatildi]);
      } finally {
        if (bu === sonCagri) { katman.kullaniciKapatti = null; setTimeout(() => { if (bu === sonCagri) { ekranlar._temizle(); katman.kapat(); } }, 60); }
      }
    }]));
    katman.temizle = () => ekranlar._temizle();
    const sahneApi = sahneOlustur({ el, kap: $("#sahne"), sekmeCubugu: $("#sekme-cubugu"), gonder, bileşen: ekranlar._bilesen });
    calisan.sahneApi = sahneApi;

    return {
      "eserler.yakindaki": async (s = {}) => {
        // Kullanıcı bu modüle konum izni vermediyse cihaz konumu hiç sorulmaz; örnek konum kullanılır.
        const izinli = ONIZLEME || !raf.istenenIzinler(modul).includes("konum") || raf.izinDurumu(modul.id, "konum") !== false;
        const k = izinli ? await konumAl() : { ...DEMO_KONUM, ornek: true };
        const q = new URLSearchParams({ lat: k.lat, lng: k.lng, limit: Math.min(Number(s.limit) || 10, 50) });
        if (s.tur) q.set("tur", s.tur);
        const liste = await (await api(`/api/eserler/yakin?${q}`)).json();
        return k.ornek ? liste.map((e) => ({ ...e, ornek_konum: true })) : liste;
      },
      "eserler.getir": async (id) => (await api(`/api/eserler/${encodeURIComponent(id)}`)).json(),
      "eserler.iliskiler": async (id) => {
        const q = id ? `?eser=${encodeURIComponent(id)}` : "";
        return (await api(`/api/eser-iliskileri${q}`)).json();
      },
      "dalislar.liste": async () => (await api(`/api/dalislar${ONIZLEME ? "?onizleme=1" : ""}`)).json(),
      "eserler.liste": async (s = {}) => {
        const q = new URLSearchParams();
        for (const k of ["il", "ilce", "tur", "ad", "yuzyil", "eksik"]) if (s[k] != null && s[k] !== "") q.set(k, String(s[k]));
        if (s.tam) q.set("tam", "1");
        for (const k of ["gerekli", "olmayan"]) if (Array.isArray(s[k]) && s[k].length) q.set(k, s[k].map(String).join(","));
        return (await api(`/api/eserler?${q}`)).json();
      },
      ...sarili,
      "sahne.ayarla": async (s = {}) => {
        uygulamaModu = true;
        document.body.classList.add("uygulama-modu");
        const r = sahneApi.ayarla(s);
        if (s.tema) temaUygula(s.tema, modul.renk);
        if (r.baslik) { $("#baslik").textContent = r.baslik; document.title = `${r.baslik} · Lonca`; }
      },
      "sahne.ciz": async (agac) => {
        uygulamaModu = true;
        document.body.classList.add("uygulama-modu");
        katman.kapat();
        // "Ekranı sesli oku" açıksa yeni görünümün başlığı ve ilk paragrafı okunur (ekranda yazanın aynısı).
        if (sahneApi.ciz(agac)?.yeni) seslendir([...$("#sahne").querySelectorAll(".s-ust-metin strong, .s-kapak-baslik, .s-kapak-alt, .s-afis-baslik, .s-baslik, .s-metin")].slice(0, 3).map((d) => d.textContent.trim()).filter(Boolean).join(". ").slice(0, 400));
        acilisBitir();
      },
      "sahne.bildir": async (m) => bildir(m),
      "sahne.efekt": async (ad) => sahneApi.efekt(ad),
      "ekran.duzeltme": async (eser) => (eser?.id ? duzeltmeIste(eser) : { gonderildi: false }),
      "profil.bilgi": async () => profil.profilBilgi(),
      "profil.puanEkle": async (n, neden) => {
        const r = profil.puanEkle(n);
        if (r.seviyeAtladi) bildir(`Seviye ${r.seviye}'e yükseldin!`, { tur: "basarim" });
        else if (neden) bildir(`+${Math.round(n)} puan · ${neden}`, { sure: 1600 });
        return r;
      },
      "basarim.tanimla": async (l) => profil.basarimTanimla(modul.id, l),
      "basarim.kazan": async (id) => {
        const t = profil.basarimKazan(modul.id, id);
        if (t) { profil.puanEkle(25); bildir(`Başarım: ${t.ad}`, { tur: "basarim", sure: 3200 }); }
        return !!t;
      },
      "basarim.liste": async () => profil.basarimListe(modul.id),
      "depo.oku": async (k) => profil.depoOku(modul.id, k),
      "depo.yaz": async (k, v) => profil.depoYaz(modul.id, k, v),
    };
  };
}

// ---------- Ekranlar ----------
function ekranGoster(hangi) {
  $("#ana-ekran").hidden = hangi !== "ana";
  $("#modul-ekrani").hidden = hangi !== "modul";
  $("#profil-ekrani").hidden = hangi !== "profil";
}

function avatarCiz(kap, p) {
  kap.style.backgroundImage = ciniArkaPlan(`avatar-${p.ad}`, p.renk);
}

$("#marka-logo").innerHTML = loncaLogo({ boyut: 30 });

let vitrin = null;
const vitrinGetir = () => (vitrin ??= fetch("/api/vitrin").then((y) => y.json()).catch(() => null));
const KATEGORI_ADI = { rehber: "Rehber", oyun: "Oyun", gezi: "Gezi", ogren: "Öğren" };
function kategoriBul(m) {
  if (KATEGORI_ADI[m.kategori]) return m.kategori;
  const t = `${m.ad} ${m.aciklama}`.toLocaleLowerCase("tr");
  if (/oyun|yarış|avı|bilmece|test|soru/.test(t)) return "oyun";
  if (/harita|rota|gezi|yürü/.test(t)) return "gezi";
  if (/öğren|sözlük|ders/.test(t)) return "ogren";
  return "rehber";
}
const yuzyilYazi = (y) => (y ? `${y}. yüzyıl` : null);

async function vitrinCiz() {
  const v = await vitrinGetir();
  if (!v) return;
  const s = v.sayilar;
  if (Array.isArray(v.iller)) $("#il-listesi").replaceChildren(...v.iller.map((il) => el("option", { value: il })));
  $("#vitrin-sayilar").replaceChildren(...[[s.eser, "vakıf eseri"], [s.fotografli, "fotoğraflı"], [s.ilce, "ilçe"], [s.konumlu, "haritada"]]
    .map(([n, ad]) => el("li", {}, el("strong", { textContent: String(n) }), el("span", { textContent: ad }))));
  const kolajEserleri = [v.gununEseri, ...v.secki].filter(Boolean).slice(0, 5);
  $("#kolaj").replaceChildren(...kolajEserleri.map((e, i) => {
    const k = el("span", { className: "kolaj-kare" });
    k.style.backgroundImage = `url("${e.foto}")`;
    k.style.setProperty("--i", String(i));
    return k;
  }));
  kolajDongusu(kolajEserleri);
  const g = v.gununEseri;
  if (g) {
    $("#gunun-eseri").hidden = false;
    const foto = el("span", { className: "gunun-foto" });
    foto.style.backgroundImage = `url("${g.foto}")`;
    $("#gunun-karti").replaceChildren(foto,
      el("span", { className: "gunun-metin" },
        el("span", { className: "gunun-ust", textContent: [TUR_ADI[g.tur] ?? "Eser", yuzyilYazi(g.yuzyil), g.ilce].filter(Boolean).join(" · ") }),
        el("strong", { textContent: g.ad }),
        el("span", { className: "gunun-ozet", textContent: g.ozet }),
        el("span", { className: "gunun-devam", textContent: `Devamını oku · ${g.fotoSayisi} fotoğraf →` })));
    $("#gunun-karti").onclick = () => eserPenceresi(g.id);
  }
  $("#secki").replaceChildren(...v.secki.map((e) => {
    const foto = el("span", { className: "secki-foto" });
    foto.style.backgroundImage = `url("${e.foto}")`;
    const b = el("button", { type: "button", className: "secki-karti" }, foto,
      el("span", { className: "secki-metin" }, el("strong", { textContent: e.ad }),
        el("span", { textContent: [TUR_ADI[e.tur] ?? "Eser", yuzyilYazi(e.yuzyil)].filter(Boolean).join(" · ") })));
    b.addEventListener("click", () => eserPenceresi(e.id));
    return el("li", {}, b);
  }));
}

let kolajZamanlayici = null;
function kolajDongusu(liste) {
  clearInterval(kolajZamanlayici);
  const kareler = [...$("#kolaj").children];
  let i = 0;
  const goster = () => {
    kareler.forEach((k, j) => k.classList.toggle("onde", j === i));
    $("#kolaj-atif").textContent = liste[i] ? `Fotoğraf: ${liste[i].ad}` : "";
  };
  goster();
  if (kareler.length < 2 || hareketAzalt()) return;
  kolajZamanlayici = setInterval(() => { if (!$("#ana-ekran").hidden && !document.hidden) { i = (i + 1) % kareler.length; goster(); } }, 6000);
}

const eserSayfasi = eserSayfasiKur({
  el, api, seslendir, bildir, katkiAc: (e) => duzeltmeIste(e),
  hataYazisi: ONIZLEME ? "Bu eserde eksik var, düzenle" : "Bir hata mı gördün? Bildir",
  dalisModulu: () => modulListesi.find((m) => /dalis/.test(m.id)) ?? null,
  modulAc: (m) => moduluAc(m),
});
const eserPenceresi = (id) => eserSayfasi.ac(id);

function devamKartiCiz() {
  const son = depo.oku("lonca.son-modul", null);
  const m = son && modulListesi.find((x) => x.id === son.id);
  $("#devam").hidden = !m;
  if (!m) return;
  const karo = el("span", { className: "devam-desen", ariaHidden: "true" });
  karo.style.backgroundImage = ciniArkaPlan(m.id, m.renk);
  const ozet = profil.basarimOzeti(m.id);
  $("#devam-karti").replaceChildren(karo, el("span", { className: "devam-metin" },
    el("strong", { textContent: m.ad }),
    el("span", { textContent: ozet.toplam ? `${ozet.kazanilan}/${ozet.toplam} başarım · devam et` : "Devam et" }),
    ozet.toplam ? el("span", { className: "devam-cubuk" }, Object.assign(el("i"), { style: `width:${(ozet.kazanilan / ozet.toplam) * 100}%` })) : null),
    el("span", { className: "devam-ok", ariaHidden: "true", textContent: "→" }));
  $("#devam-karti").onclick = () => moduluAc(m, $("#devam-karti"));
  $("#devam-karti").setAttribute("aria-label", `Kaldığın yerden devam et: ${m.ad}`);
}

function profilCipiGuncelle() {
  const p = profil.profilBilgi();
  const saat = new Date().getHours();
  $("#vitrin-selam").textContent = `${saat < 6 ? "İyi geceler" : saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar"}, ${p.ad}`;
  $("#cip-ad").textContent = p.ad;
  $("#cip-seviye").textContent = `Seviye ${p.seviye}`;
  avatarCiz($("#cip-avatar"), p);
}

$("#vitrin").style.setProperty("--serit-desen", ciniArkaPlan("lonca", "firuze"));
$("#katki-desen").style.backgroundImage = ciniArkaPlan("katki", "mercan");
let modulListesi = [], seciliKategori = "hepsi";

function uygulamaIkonu(m, boyut = "") {
  const desen = el("span", { className: `karo-desen uygulama-ikonu ${boyut}`, ariaHidden: "true" });
  desen.style.backgroundImage = ciniArkaPlan(m.id, m.renk);
  const madalyon = el("span", { className: "ikon-madalyon" });
  madalyon.innerHTML = cizim(m.ikon); 
  desen.append(madalyon);
  return desen;
}
function basarimCubugu(m) {
  const o = profil.basarimOzeti(m.id);
  if (!o.toplam) return null;
  return el("span", { className: "basarim-cubugu", title: `${o.kazanilan}/${o.toplam} başarım` },
    el("span", { className: "gizli", textContent: `${o.kazanilan}/${o.toplam} başarım` }),
    Object.assign(el("i"), { style: `width:${(o.kazanilan / o.toplam) * 100}%` }));
}

function oneCikanlariCiz(kapaklar) {
  const liste = [...modulListesi].sort((a, b) => String(b.yayin ?? "").localeCompare(String(a.yayin ?? ""))).slice(0, 6);
  $("#one-cikanlar").replaceChildren(...liste.map((m, i) => {
    const kapak = kapaklar?.[m.id];
    const arka = el("span", { className: "oc-arka", ariaHidden: "true" });
    if (kapak?.foto) arka.style.backgroundImage = `url("${kapak.foto}")`;
    else arka.style.backgroundImage = ciniArkaPlan(m.id, m.renk);
    const b = el("button", { className: `oc-kart renk-${m.renk ?? "kobalt"}` },
      arka,
      el("span", { className: "oc-govde" },
        el("span", { className: "oc-etiket", textContent: raf.yeniMi(m.id) ? `Yeni · ${KATEGORI_ADI[kategoriBul(m)]}` : KATEGORI_ADI[kategoriBul(m)] }),
        el("span", { className: "oc-ad", textContent: m.ad }),
        el("span", { className: "oc-aciklama", textContent: m.aciklama }),
        el("span", { className: "oc-alt" }, uygulamaIkonu(m, "kucuk"),
          el("span", { className: "oc-alt-metin", ariaHidden: "true" }, el("strong", { textContent: m.ad }), el("span", { textContent: kapak?.eser ? `Kapak: ${kapak.eser}` : "Lonca uygulaması" })),
          el("span", { className: "ac-pill", ariaHidden: "true", textContent: "AÇ" }))));
    b.addEventListener("click", () => moduluAc(m, b));
    const li = el("li", {}, b);
    li.style.setProperty("--i", String(i));
    return li;
  }));
  $("#one-cikan-oklar").hidden = liste.length < 2;
}

const yeniGelenler = new Set();
function uygulamalariCiz({ animasyonsuz = false } = {}) {
  $("#moduller").classList.remove("sessiz");
  const sayac = {};
  for (const m of modulListesi) sayac[kategoriBul(m)] = (sayac[kategoriBul(m)] ?? 0) + 1;
  const ciple = [["hepsi", "Hepsi", modulListesi.length], ...Object.keys(KATEGORI_ADI).filter((k) => sayac[k]).map((k) => [k, KATEGORI_ADI[k], sayac[k]])];
  if (!ciple.some(([k]) => k === seciliKategori)) seciliKategori = "hepsi";
  $("#kategori-cipleri").replaceChildren(...ciple.map(([k, ad, n]) => {
    const b = el("button", { type: "button", className: `kategori-cip${k === seciliKategori ? " secili" : ""}` }, ad, el("small", { textContent: String(n) }));
    b.setAttribute("aria-pressed", String(k === seciliKategori));
    b.addEventListener("click", () => { seciliKategori = k; uygulamalariCiz({ animasyonsuz: true }); });
    return b;
  }));
  $("#kategori-cipleri").hidden = modulListesi.length < 2;
  const gorunen = modulListesi.filter((m) => seciliKategori === "hepsi" || kategoriBul(m) === seciliKategori);
  $("#uygulama-sayisi").textContent = modulListesi.length ? `${modulListesi.length} uygulama` : "";
  $("#moduller").replaceChildren(...gorunen.map((m, i) => {
    const yeni = raf.yeniMi(m.id);
    const izinler = raf.istenenIzinler(m).map((iz) => raf.IZIN_BILGISI[iz].ad);
    const b = el("button", { className: "karo uygulama-satiri" },
      uygulamaIkonu(m),
      el("span", { className: "us-metin" },
        el("span", { className: "us-ad" }, m.ad, yeni ? el("span", { className: "yeni-rozet", textContent: "Yeni" }) : null),
        el("span", { className: "us-kategori" }, KATEGORI_ADI[kategoriBul(m)],
          izinler.length ? el("span", { className: "us-izin", textContent: ` · ${izinler.join(", ")} ister` }) : null),
        el("span", { className: "us-aciklama", textContent: m.aciklama }),
        basarimCubugu(m)),
      el("span", { className: "ac-pill", ariaHidden: "true", textContent: "AÇ" }));
    b.addEventListener("click", () => moduluAc(m, b));
    const rafta = raf.raftaMi(m.id);
    const ekle = el("button", { type: "button", className: `raf-dugme${rafta ? " rafta" : ""}`, textContent: rafta ? "✓" : "＋",
      ariaLabel: rafta ? `${m.ad}: Modüllerim'den çıkar` : `${m.ad}: Modüllerim'e ekle`, title: rafta ? "Modüllerim'de" : "Modüllerim'e ekle" });
    ekle.setAttribute("aria-pressed", String(rafta));
    ekle.addEventListener("click", () => {
      if (raf.raftaMi(m.id)) { raf.raftanKaldir(m.id); bildir(`${m.ad} Modüllerim'den çıkarıldı.`, { sure: 1800 }); }
      else { raf.rafaEkle(m.id); bildir(`${m.ad} Modüllerim'e eklendi.`, { sure: 1800 }); }
      uygulamalariCiz({ animasyonsuz: true });
      rafCiz();
      document.querySelector(`#moduller [data-id="${m.id}"] .raf-dugme`)?.focus();
    });
    const li = el("li", { className: `uygulama-li${yeni ? " yeni" : ""}${yeniGelenler.has(m.id) ? " geldi" : ""}` }, b, ekle);
    li.dataset.id = m.id;
    li.style.setProperty("--i", String(i));
    return li;
  }));
  if (!animasyonsuz) $("#moduller").querySelectorAll(".ikon-madalyon svg").forEach((svg, i) => ciz(svg, { gecikme: 200 + i * 80, sure: 650, aralik: 40 }));
  else $("#moduller").classList.add("sessiz");
}

// ---------- Modüllerim rafı ----------
let rafDuzenleme = false;
function rafCiz() {
  const liste = raf.rafModulleri(modulListesi);
  const ul = $("#modullerim");
  $("#modullerim-bos").hidden = liste.length > 0;
  $("#modullerim-duzenle").hidden = !liste.length;
  if (!liste.length) rafDuzenleme = false;
  $("#modullerim-duzenle").textContent = rafDuzenleme ? "Bitti" : "Düzenle";
  $("#modullerim-duzenle").setAttribute("aria-pressed", String(rafDuzenleme));
  ul.classList.toggle("duzenleniyor", rafDuzenleme);
  ul.replaceChildren(...liste.map((m) => {
    const sabit = raf.sabitMi(m.id);
    const ac = el("button", { type: "button", className: "raf-karo" }, uygulamaIkonu(m),
      el("span", { className: "raf-ad", textContent: m.ad }),
      sabit ? el("span", { className: "raf-igne", ariaHidden: "true", title: "Sabitlendi" }) : null,
      raf.yeniMi(m.id) ? el("span", { className: "raf-yeni", ariaHidden: "true" }) : null);
    ac.setAttribute("aria-label", `${m.ad}${sabit ? ", sabitlendi" : ""}. Aç`);
    ac.addEventListener("click", () => (rafDuzenleme ? null : moduluAc(m, ac)));
    ac.disabled = rafDuzenleme;
    const li = el("li", { className: sabit ? "sabit" : "" }, ac);
    li.dataset.id = m.id;
    if (rafDuzenleme) {
      const igne = el("button", { type: "button", className: `raf-eylem igne${sabit ? " secili" : ""}`, ariaLabel: sabit ? `${m.ad}: sabitlemeyi kaldır` : `${m.ad}: başa sabitle` });
      igne.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6zM12 13v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
      igne.setAttribute("aria-pressed", String(sabit));
      igne.addEventListener("click", () => { raf.sabitle(m.id); rafCiz(); $(`#modullerim [data-id="${m.id}"] .igne`)?.focus(); });
      const kaldir = el("button", { type: "button", className: "raf-eylem kaldir", textContent: "−", ariaLabel: `${m.ad}: Modüllerim'den çıkar` });
      kaldir.addEventListener("click", () => { raf.raftanKaldir(m.id); rafCiz(); uygulamalariCiz({ animasyonsuz: true }); ($("#modullerim .raf-eylem") ?? $("#modullerim-duzenle"))?.focus(); });
      li.append(igne, kaldir);
    }
    return li;
  }));
}
$("#modullerim-duzenle").addEventListener("click", () => { rafDuzenleme = !rafDuzenleme; rafCiz(); $("#modullerim-duzenle").focus(); });

// ---------- İzin sorma ----------
const KONUM_IKONU = '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/></svg>';
function izinSor(m) {
  const sorulacak = raf.sorulmamisIzinler(m);
  if (ONIZLEME || !sorulacak.length) return Promise.resolve();
  const d = $("#izin-penceresi");
  $("#izin-ikon").innerHTML = KONUM_IKONU;
  $("#izin-baslik").textContent = `${m.ad} izin istiyor`;
  $("#izin-alt").textContent = "Uygulama açılmadan önce, ne için istediğini bilmeni istiyoruz.";
  $("#izin-listesi").replaceChildren(...sorulacak.map((iz) => {
    const b = raf.IZIN_BILGISI[iz];
    return el("li", {}, el("strong", { textContent: b.ad }), el("span", { textContent: b.neden }), el("small", { textContent: b.reddedilince }));
  }));
  d.returnValue = "";
  d.showModal();
  d.querySelector('button[value="evet"]').focus();
  return new Promise((coz) => d.addEventListener("close", () => {
    // Pencere bir seçim yapılmadan kapanırsa (Esc, Android geri) karar kaydedilmez; bu açılışta izinsiz çalışır.
    if (d.returnValue === "evet" || d.returnValue === "hayir") for (const iz of sorulacak) raf.izinKaydet(m.id, iz, d.returnValue === "evet");
    coz();
  }, { once: true }));
}
$("#one-cikan-oklar").addEventListener("click", (e) => {
  const yon = Number(e.target.closest("[data-yon]")?.dataset.yon);
  if (!yon) return;
  const serit = $("#one-cikanlar");
  serit.scrollBy({ left: yon * serit.clientWidth * 0.85, behavior: hareketAzalt() ? "auto" : "smooth" });
});

async function anaEkran({ gecisli = false } = {}) {
  if (gecisli) gecis(() => ekranGoster("ana"), "geri"); else ekranGoster("ana");
  ilerlemeAyarla(0, 0);
  profilCipiGuncelle();
  const ul = $("#moduller");
  try {
    const [liste, v] = await Promise.all([api("/api/moduller").then((y) => y.json()), vitrinGetir()]);
    modulListesi = liste;
    sonSurum = modulSurumu(liste);
    raf.yenileriBul(liste);
    oneCikanlariCiz(v?.kapaklar);
    uygulamalariCiz();
    rafCiz();
    devamKartiCiz();
    if (!modulListesi.length) {
      ul.replaceChildren(el("li", { className: "bos", textContent: "Henüz yayında uygulama yok. Lonca Studio'da onaylanan uygulamalar burada görünür." }));
      $("#one-cikanlar").closest("section").hidden = true;
    } else $("#one-cikanlar").closest("section").hidden = false;
  } catch (h) {
    ul.replaceChildren(el("li", { className: "bos", textContent: `Uygulamalar yüklenemedi: ${h.message}. Bağlantını kontrol edip sayfayı yenile.` }));
  }
  vitrinCiz();
  if (!profil.profilOku() && !ONIZLEME) tanismaAc();
}

let acilisZamani = 0, acilisZamanlayici = null;
function acilisGoster(m) {
  const a = $("#acilis");
  $("#acilis-desen").style.backgroundImage = ciniArkaPlan(m.id, m.renk);
  $("#acilis-madalyon").innerHTML = cizim(m.ikon);
  $("#acilis-ad").textContent = m.ad;
  a.hidden = false;
  a.classList.remove("gidiyor");
  acilisZamani = performance.now();
}
function acilisBitir() {
  const a = $("#acilis");
  if (a.hidden || a.classList.contains("gidiyor")) return;
  clearTimeout(acilisZamanlayici);
  const bekle = Math.max(0, 750 - (performance.now() - acilisZamani));
  acilisZamanlayici = setTimeout(() => {
    a.classList.add("gidiyor");
    setTimeout(() => { a.hidden = true; }, 450);
  }, bekle);
}

let calisan = null; // { modul, iptal, sahneApi }
async function moduluAc(m, karo) {
  await izinSor(m);
  if (!ONIZLEME) { raf.rafaEkle(m.id); raf.goruldu(m.id); }
  depo.yaz("lonca.son-modul", { id: m.id, zaman: Date.now() });
  calisan?.iptal.abort();
  const iptal = new AbortController();
  calisan = { modul: m, iptal, sahneApi: null };
  const bu = calisan;
  document.body.classList.remove("uygulama-modu");
  ilerlemeAyarla(0, 0);

  const desen = karo?.querySelector(".karo-desen");
  if (desen) desen.style.viewTransitionName = "acilis";
  const g = gecis(() => {
    if (desen) desen.style.viewTransitionName = "";
    ekranGoster("modul");
    $("#acilis").style.viewTransitionName = "acilis";
    $("#baslik").textContent = m.ad;
    document.title = `${m.ad} · Lonca`;
    temaUygula(null, m.renk);
    $("#sahne").replaceChildren();
    katman.kapat();
    acilisGoster(m);
  }, "acilis");
  if (desen && !g) desen.style.viewTransitionName = "";

  try {
    const [yanit] = await Promise.all([api(`/api/moduller/${encodeURIComponent(m.id)}/kod`), g?.finished.catch(() => {})]);
    $("#acilis").style.viewTransitionName = "";
    await modulCalistir(await yanit.text(), yontemlerOlustur(m), { iptal: iptal.signal });
    if (bu !== calisan) return;
    modulBitti(m, null);
  } catch (h) {
    if (h.iptal || bu !== calisan) return;
    modulBitti(m, h);
  }
}

function modulBitti(m, hata) {
  calisan?.sahneApi?.temizle();
  document.body.classList.remove("uygulama-modu");
  katman.kapat();
  const kap = sahneyeKoy(el("div", { className: `panel ${hata ? "hata" : "bitis"}` },
    el("p", { className: "panel-metin", textContent: hata ? `Modül bir hatayla durdu: ${hata.message}` : `${m.ad} bitti.` })));
  const don = el("button", { className: "dugme", textContent: "Modüllere dön" });
  don.addEventListener("click", () => anaEkran({ gecisli: true }), { once: true });
  kap.append(don);
}

$("#geri").addEventListener("click", () => {
  katman.temizle?.();
  katman.kullaniciKapatti = null;
  document.title = "Lonca";
  calisan?.iptal.abort();
  calisan?.sahneApi?.temizle();
  calisan = null;
  document.body.classList.remove("uygulama-modu");
  katman.kapat();
  $("#acilis").hidden = true;
  anaEkran({ gecisli: true });
});

function profilEkrani() {
  const p = profil.profilBilgi();
  const sonraki = profil.seviyeEsigi(p.seviye + 1), bu = profil.seviyeEsigi(p.seviye);
  const avatar = el("span", { className: "avatar buyuk", ariaHidden: "true" });
  avatarCiz(avatar, p);
  const duzenle = el("button", { className: "dugme ikincil kucuk", textContent: "Adı ve rengi değiştir" });
  duzenle.addEventListener("click", tanismaAc);
  const gruplar = profil.tumBasarimlar(modulListesi);
  const kazanilan = gruplar.reduce((t, g) => t + g.basarimlar.filter((b) => b.kazanildi).length, 0);
  const toplam = gruplar.reduce((t, g) => t + g.basarimlar.length, 0);

  $("#profil-icerik").replaceChildren(
    el("section", { className: "profil-kart" },
      avatar,
      el("h2", { className: "profil-ad", textContent: p.ad }),
      el("p", { className: "profil-seviye", textContent: `Seviye ${p.seviye} · ${p.puan} puan` }),
      el("div", { className: "s-ilerleme", role: "progressbar", ariaLabel: "Sonraki seviyeye ilerleme", ariaValueNow: String(p.puan - bu), ariaValueMin: "0", ariaValueMax: String(sonraki - bu) },
        Object.assign(el("span"), { style: `width:${((p.puan - bu) / (sonraki - bu)) * 100}%` })),
      el("p", { className: "profil-alt", textContent: `Sonraki seviyeye ${sonraki - p.puan} puan` }),
      duzenle),
    el("section", { className: "profil-istatistik" },
      el("div", { className: "s-istatistik" }, el("strong", { textContent: String(kazanilan) }), el("span", { textContent: "başarım" })),
      el("div", { className: "s-istatistik" }, el("strong", { textContent: String(toplam ? Math.round((kazanilan / toplam) * 100) : 0) + "%" }), el("span", { textContent: "tamamlandı" })),
      el("div", { className: "s-istatistik" }, el("strong", { textContent: String(gruplar.length) }), el("span", { textContent: "modül" }))),
    el("h2", { className: "bolum-baslik", textContent: "Başarımlar" }),
    gruplar.length ? el("div", { className: "profil-basarimlar" }, ...gruplar.map(({ modul, basarimlar }) =>
      el("section", { className: "profil-modul" },
        el("h3", { textContent: modul.ad }),
        el("div", { className: "s-izgara", style: "--sutun:3" }, ...basarimlar.map((b) => {
          const r = el("div", { className: `s-rozet${b.kazanildi ? " kazanildi" : ""}` });
          r.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><g><rect x="26" y="26" width="68" height="68" rx="6"/><rect x="26" y="26" width="68" height="68" rx="6" transform="rotate(45 60 60)"/></g><circle cx="60" cy="60" r="26"/><path d="M60 43l5 10.4 11.4 1.7-8.2 8 2 11.3L60 69l-10.2 5.4 2-11.3-8.2-8 11.4-1.7z"/></svg>';
          r.append(el("strong", { textContent: b.ad }), el("span", { textContent: b.kazanildi ? (b.aciklama || "Kazanıldı") : "Henüz kazanılmadı" }));
          return r;
        }))))) : el("p", { className: "bos", textContent: "Modülleri oynadıkça başarımların burada birikecek." }),
    izinBolumu(),
  );
}
function izinBolumu() {
  const satirlar = modulListesi.flatMap((m) => raf.istenenIzinler(m).map((iz) => {
    const durum = raf.izinDurumu(m.id, iz);
    const kutu = el("input", { type: "checkbox", checked: durum === true });
    kutu.addEventListener("change", () => { raf.izinKaydet(m.id, iz, kutu.checked); alt.textContent = kutu.checked ? "İzin verildi" : "İzin verilmedi"; });
    const alt = el("small", { textContent: durum === undefined ? "Henüz sorulmadı" : durum ? "İzin verildi" : "İzin verilmedi" });
    return el("label", { className: "anahtar" }, kutu, el("span", {}, `${m.ad}: ${raf.IZIN_BILGISI[iz].ad}`, alt));
  }));
  const bolum = el("section", { className: "profil-izinler" });
  bolum.setAttribute("aria-labelledby", "izin-bolum-baslik");
  bolum.append(
    el("h2", { className: "bolum-baslik", id: "izin-bolum-baslik", textContent: "Uygulama izinleri" }),
    satirlar.length ? el("div", { className: "izin-satirlari" }, ...satirlar) : el("p", { className: "bos", textContent: "Hiçbir uygulama özel izin istemiyor." }));
  return bolum;
}
$("#profil-cip").addEventListener("click", () => { profilEkrani(); gecis(() => ekranGoster("profil"), "ileri"); });
$("#profil-geri").addEventListener("click", () => anaEkran({ gecisli: true }));

const RENKLER = [["kobalt", "Kobalt"], ["firuze", "Firuze"], ["mercan", "Mercan"], ["altin", "Altın"], ["zumrut", "Zümrüt"], ["murdum", "Mürdüm"]];
function tanismaAc() {
  const p = profil.profilOku();
  $("#tanisma-ad").value = p?.ad ?? "";
  $("#renk-secenekleri").replaceChildren(...RENKLER.map(([id, ad], i) => {
    const girdi = el("input", { type: "radio", name: "renk", value: id, checked: (p?.renk ?? "kobalt") === id || (!p && i === 0) });
    const ornek = el("span", { className: "renk-ornek", ariaHidden: "true" });
    ornek.style.backgroundImage = ciniArkaPlan(`avatar-renk-${id}`, id);
    return el("label", { className: "renk-secenek" }, girdi, ornek, el("span", { textContent: ad }));
  }));
  $("#tanisma").hidden = false;
  $("#tanisma-ad").focus();
}
function tanismaKapat(kaydet) {
  const renk = document.querySelector('input[name="renk"]:checked')?.value ?? "kobalt";
  profil.profilKaydet({ ad: kaydet ? $("#tanisma-ad").value : (profil.profilOku()?.ad ?? "Gezgin"), renk });
  $("#tanisma").hidden = true;
  // Odak gizlenen formda kalmasın; klavye ve ekran okuyucu ana içerikten devam eder.
  if (document.activeElement?.closest("#tanisma") || document.activeElement === document.body) $("#uygulamalar-baslik").focus({ preventScroll: true });
  profilCipiGuncelle();
  if (!$("#profil-ekrani").hidden) profilEkrani();
}
$("#tanisma-formu").addEventListener("submit", (e) => { e.preventDefault(); tanismaKapat(true); });
$("#tanisma-gec").addEventListener("click", () => tanismaKapat(false));

const KATKI_TURLERI = Object.entries(TUR_ADI);
$("#katki-formu").elements.tur.replaceChildren(...KATKI_TURLERI.map(([id, ad]) => el("option", { value: id, textContent: ad })));
let katkiCoz = null, katkiEser = null;
let katkiFotolari = [];
const KATKI_FOTO_SINIRI = 6;
function katkiFotolariniCiz() {
  const liste = $("#katki-foto-listesi");
  for (const img of liste.querySelectorAll("img")) URL.revokeObjectURL(img.src);
  liste.replaceChildren(...katkiFotolari.map((dosya, i) => {
    const kaldir = el("button", { type: "button", className: "katki-foto-kaldir", textContent: "×", ariaLabel: `${i + 1}. fotoğrafı çıkar` });
    kaldir.addEventListener("click", () => { katkiFotolari.splice(i, 1); katkiFotolariniCiz(); });
    return el("li", {}, el("img", { src: URL.createObjectURL(dosya), alt: `${i + 1}. fotoğraf${i === 0 ? " (kapak)" : ""}` }), kaldir);
  }));
  $("#katki-foto-ekle").hidden = katkiFotolari.length >= KATKI_FOTO_SINIRI;
}
$("#katki-formu").elements.foto.addEventListener("change", (e) => {
  const durum = $("#katki-durum");
  durum.textContent = "";
  for (const dosya of [...(e.target.files ?? [])]) {
    if (katkiFotolari.length >= KATKI_FOTO_SINIRI) { durum.textContent = `En fazla ${KATKI_FOTO_SINIRI} fotoğraf eklenebilir.`; durum.className = "katki-durum hata"; break; }
    if (!/^image\/(jpeg|png|webp)$/.test(dosya.type)) continue;
    if (dosya.size > 6 * 1024 * 1024) { durum.textContent = `${dosya.name}: en fazla 6 MB olabilir.`; durum.className = "katki-durum hata"; continue; }
    katkiFotolari.push(dosya);
  }
  e.target.value = "";
  katkiFotolariniCiz();
});
// Studio önizlemesinde vatandaş formu yerine eser, Studio'nun içerik formunda düzenlemeye açılır.
function duzeltmeIste(eser) {
  if (!ONIZLEME || !eser?.id) return katkiAc(eser);
  parent.postMessage({ tur: "eser-duzenle", id: eser.id }, location.origin);
  return Promise.resolve({ gonderildi: false });
}
function katkiAc(eser = null) {
  katkiEser = eser;
  const f = $("#katki-formu");
  f.reset();
  $("#katki-form-baslik").textContent = eser ? "Hata bildir" : "Eser öner";
  $("#katki-alt").textContent = eser ? `“${eser.ad}” hakkında yanlış ya da eksik bir bilgi mi var? Editörler kontrol edip düzeltir.` : "Editörler kaynağı kontrol ettikten sonra eser uygulamada yayınlanır.";
  $("#katki-yeni").hidden = !!eser;
  $("#katki-not-alan").hidden = !eser;
  $("#katki-durum").textContent = "";
  $("#katki-gonder").disabled = false;
  katkiFotolari = []; katkiFotolariniCiz();
  $("#katki").hidden = false;
  (eser ? f.elements.not : f.elements.ad).focus();
  return new Promise((coz) => { katkiCoz = coz; });
}
function katkiKapat(gonderildi) {
  $("#katki").hidden = true;
  katkiCoz?.({ gonderildi });
  katkiCoz = null;
}
$("#katki-vazgec").addEventListener("click", () => katkiKapat(false));
$("#katki").addEventListener("click", (e) => { if (e.target === e.currentTarget) katkiKapat(false); });
$("#eser-oner").addEventListener("click", () => katkiAc());
$("#katki-formu").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget.elements, durum = $("#katki-durum");
  const hata = (m) => { durum.textContent = m; durum.className = "katki-durum hata"; };
  try {
    $("#katki-gonder").disabled = true;
    let govde;
    if (katkiEser) {
      if (f.not.value.trim().length < 5) { $("#katki-gonder").disabled = false; return hata("Lütfen birkaç kelimeyle anlat."); }
      govde = { tur: "not", eserId: katkiEser.id, not: f.not.value };
    } else {
      if (f.ad.value.trim().length < 2 || f.il.value.trim().length < 2 || f.tarihce.value.trim().length < 20 || f.kaynak.value.trim().length < 3) {
        $("#katki-gonder").disabled = false;
        return hata("Ad, il, en az bir cümlelik tarihçe ve kaynak gerekli.");
      }
      const fotograflar = [];
      for (const [i, dosya] of katkiFotolari.entries()) {
        durum.className = "katki-durum"; durum.textContent = `Fotoğraflar yükleniyor ${i + 1}/${katkiFotolari.length}…`;
        const dataUrl = await new Promise((coz, red) => { const r = new FileReader(); r.onload = () => coz(r.result); r.onerror = red; r.readAsDataURL(dosya); });
        const y = await fetch("/api/medya", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dosya: dataUrl }) });
        const s = await y.json();
        if (!y.ok) { $("#katki-gonder").disabled = false; return hata(`${dosya.name}: ${s.hata}`); }
        fotograflar.push(s.yol);
      }
      govde = { tur: "yeni", veri: { ad: f.ad.value, tur: f.tur.value, ilce: f.ilce.value, il: f.il.value.trim(), tarihce: { tr: f.tarihce.value }, kaynak: f.kaynak.value, fotograflar } };
    }
    const y = await fetch("/api/eser-oneriler", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(govde) });
    const s = await y.json();
    if (!y.ok) { $("#katki-gonder").disabled = false; return hata([s.hata, ...(s.ayrintilar ?? [])].join(" · ")); }
    katkiKapat(true);
    bildir("Teşekkürler! Editörler kontrol ettikten sonra yayına girecek.", { tur: "basarim", sure: 3600 });
    profil.puanEkle(15);
    profilCipiGuncelle();
  } catch (h) { $("#katki-gonder").disabled = false; hata(`Gönderilemedi: ${h.message}`); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#katki").hidden) katkiKapat(false); });

// ---------- Yeni onaylanan modüller: hafif sürüm yoklaması ----------
// Sunucu her onay/kaldırmada değişen kısa bir sürüm verir; değişince liste yeniden çekilir. Android köprüsü fetch'i
// canlı sunucuya yönlendirdiği için telefonda da aynen çalışır.
let sonSurum = null, yoklaniyor = false;
async function modulleriYokla() {
  if (ONIZLEME || document.hidden || yoklaniyor || sonSurum == null) return;
  yoklaniyor = true;
  try {
    const { surum } = await (await api("/api/moduller/surum")).json();
    if (surum === sonSurum) return;
    const liste = await (await api("/api/moduller")).json();
    sonSurum = modulSurumu(liste);
    const gelenler = raf.yenileriBul(liste);
    modulListesi = liste;
    for (const m of gelenler) yeniGelenler.add(m.id);
    if (!$("#ana-ekran").hidden) {
      vitrin = null;
      oneCikanlariCiz((await vitrinGetir())?.kapaklar);
      uygulamalariCiz({ animasyonsuz: true });
      rafCiz();
      $("#one-cikanlar").closest("section").hidden = !liste.length;
    }
    for (const m of gelenler.slice(0, 2)) bildir(`Yeni uygulama yayında: ${m.ad}`, { tur: "yeni", sure: 4200 });
    if (gelenler.length > 2) bildir(`${gelenler.length - 2} yeni uygulama daha`, { tur: "yeni", sure: 4200 });
    setTimeout(() => { for (const m of gelenler) yeniGelenler.delete(m.id); }, 4000);
  } catch {} finally { yoklaniyor = false; }
}
if (!ONIZLEME) setInterval(modulleriYokla, 12000);

// ---------- Genel arama ----------
let aramaNo = 0, aramaZaman = null;
const aramaGirdi = $("#arama"), aramaSonuc = $("#arama-sonuc");
function aramaTemizle() {
  aramaGirdi.value = ""; aramaNo++;
  aramaSonuc.hidden = true; aramaSonuc.replaceChildren();
  $("#arama-durum").textContent = ""; $("#arama-temizle").hidden = true;
}
function sonucSatiri({ foto, desen, baslik, alt, tik, etiket }) {
  const kare = el("span", { className: "as-foto", ariaHidden: "true" });
  if (foto) kare.style.backgroundImage = `url("${foto}")`;
  else if (desen) kare.append(desen);
  const b = el("button", { type: "button", className: "as-satir" }, kare,
    el("span", { className: "as-metin" }, el("strong", { textContent: baslik }), el("span", { textContent: alt })),
    etiket ? el("span", { className: "as-etiket", textContent: etiket }) : null);
  b.addEventListener("click", tik);
  return el("li", {}, b);
}
async function aramaYap() {
  const q = aramaGirdi.value.trim();
  $("#arama-temizle").hidden = !aramaGirdi.value;
  const bu = ++aramaNo;
  if (q.length < 2) { aramaSonuc.hidden = true; $("#arama-durum").textContent = ""; return; }
  const kucuk = (x) => String(x ?? "").toLocaleLowerCase("tr");
  const uygulamalar = modulListesi.filter((m) => kucuk(`${m.ad} ${m.aciklama}`).includes(kucuk(q))).slice(0, 4);
  let eserler = [];
  try { eserler = await (await api(`/api/ara?q=${encodeURIComponent(q)}&limit=20`)).json(); } catch {}
  if (bu !== aramaNo) return;
  const gruplar = [];
  if (uygulamalar.length) gruplar.push(el("h3", { className: "as-baslik", textContent: "Uygulamalar" }),
    el("ul", {}, ...uygulamalar.map((m) => sonucSatiri({ desen: uygulamaIkonu(m, "kucuk"), baslik: m.ad, alt: KATEGORI_ADI[kategoriBul(m)], etiket: "AÇ",
      tik: () => { aramaTemizle(); moduluAc(m); } }))));
  if (eserler.length) gruplar.push(el("h3", { className: "as-baslik", textContent: "Eserler" }),
    el("ul", {}, ...eserler.map((e) => sonucSatiri({ foto: e.foto, desen: el("span", { className: "as-cini", style: `background-image:${ciniArkaPlan(e.id, "firuze")}` }),
      baslik: e.ad, alt: [TUR_ADI[e.tur] ?? "Eser", [e.ilce, e.il].filter(Boolean).join(", "), yuzyilYazi(e.yuzyil)].filter(Boolean).join(" · "),
      tik: () => eserPenceresi(e.id) }))));
  if (!gruplar.length) gruplar.push(el("p", { className: "as-bos", textContent: `“${q}” için sonuç yok. Başka bir ad, ilçe ya da il dene.` }));
  aramaSonuc.replaceChildren(...gruplar);
  aramaSonuc.hidden = false;
  $("#arama-durum").textContent = eserler.length || uygulamalar.length ? `${eserler.length} eser, ${uygulamalar.length} uygulama bulundu` : "Sonuç yok";
}
aramaGirdi.addEventListener("input", () => { clearTimeout(aramaZaman); aramaZaman = setTimeout(aramaYap, 180); });
aramaGirdi.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aramaGirdi.value) { e.stopPropagation(); aramaTemizle(); }
  if (e.key === "ArrowDown" || e.key === "Enter") { const ilk = aramaSonuc.querySelector("button"); if (ilk) { e.preventDefault(); ilk.focus(); } }
});
aramaSonuc.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const d = [...aramaSonuc.querySelectorAll("button")], i = d.indexOf(document.activeElement);
  e.preventDefault();
  if (e.key === "ArrowUp" && i <= 0) return aramaGirdi.focus();
  d[Math.max(0, Math.min(d.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
});
$("#arama-temizle").addEventListener("click", () => { aramaTemizle(); aramaGirdi.focus(); });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !$("#ana-ekran").hidden && !ONIZLEME) anaEkran();
});

if (ONIZLEME) {
  document.documentElement.classList.add("onizleme");
  ekranGoster("modul");
  $("#geri").hidden = true;
  document.querySelector(".kapsul-ayrac").hidden = true;
  $("#baslik").textContent = "Önizleme";
  sahneyeKoy(el("p", { className: "bos", textContent: "Kalfanın yazdığı modül burada çalışacak." }));
  window.addEventListener("message", async (e) => {
    if (e.origin !== location.origin || e.source !== parent || e.data?.tur !== "onizle") return;
    const m = { id: e.data.id || "onizleme", ad: e.data.ad || "Önizleme", renk: e.data.renk, ikon: e.data.ikon };
    calisan?.iptal.abort();
    const iptal = new AbortController();
    calisan = { modul: m, iptal, sahneApi: null };
    $("#baslik").textContent = m.ad;
    temaUygula(null, m.renk);
    katman.kapat();
    acilisGoster(m);
    try {
      await modulCalistir(e.data.kod, yontemlerOlustur(m), { iptal: iptal.signal });
      modulBitti(m, null);
    } catch (h) {
      if (!h.iptal) modulBitti(m, h);
    }
  });
  parent.postMessage({ tur: "onizleme-hazir" }, location.origin);
} else {
  anaEkran();
  // Paylaşılan bağlantı: /app/?eser=<id> eser sayfasını açar.
  const paylasilan = new URLSearchParams(location.search).get("eser");
  if (paylasilan && /^[a-z0-9-]{1,80}$/.test(paylasilan)) eserPenceresi(paylasilan);
}

export { TUR_ADI };
