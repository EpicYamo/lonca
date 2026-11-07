import { ciniArkaPlan } from "/ortak/cini.js";
import { hareketAzalt } from "/ortak/animasyon.js";
import { loncaLogo } from "/ortak/logo.js";
import { dilAl } from "/ortak/dil.js";

const $ = (s) => document.querySelector(s);
// Tarih/saat biçimi arayüz diline uyar (metinler /ortak/dil.js ile çevrilir).
const yerelDil = () => (dilAl() === "en" ? "en-GB" : "tr-TR");
const el = (etiket, ozellik = {}, ...cocuk) => {
  const d = Object.assign(document.createElement(etiket), ozellik);
  d.append(...cocuk.filter((c) => c != null));
  return d;
};

document.querySelector("#amblem").innerHTML = loncaLogo({ boyut: 38, baslik: "Lonca" });

const ANAHTAR = new Set("import export default async function await const let var return if else for of in while break continue true false null undefined new from".split(" "));
const SDK = new Set(["eserler", "ekran", "sahne", "profil", "basarim", "depo", "dalislar"]);
const kacis = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renklendir(kod) {
  const desen = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-zÇĞİÖŞÜçğıöşü_$][\wÇĞİÖŞÜçğıöşü$]*)/g;
  let cikti = "", son = 0;
  for (const m of kod.matchAll(desen)) {
    cikti += kacis(kod.slice(son, m.index));
    const [parca, yorum, metin, sayi, kelime] = m;
    if (yorum) cikti += `<span class="t-yorum">${kacis(parca)}</span>`;
    else if (metin) cikti += `<span class="t-metin">${kacis(parca)}</span>`;
    else if (sayi) cikti += `<span class="t-sayi">${parca}</span>`;
    else if (ANAHTAR.has(kelime)) cikti += `<span class="t-anahtar">${parca}</span>`;
    else if (SDK.has(kelime)) cikti += `<span class="t-sdk">${parca}</span>`;
    else if (kod[m.index + parca.length] === "(") cikti += `<span class="t-fonk">${parca}</span>`;
    else cikti += kacis(parca);
    son = m.index + parca.length;
  }
  return cikti + kacis(kod.slice(son)) + "\n";
}

function editoruGuncelle() {
  const kod = $("#kod").value;
  $("#renkli").innerHTML = renklendir(kod);
  const satir = Math.max(1, kod.split("\n").length);
  $("#satirlar").textContent = Array.from({ length: satir }, (_, i) => i + 1).join("\n");
}
$("#kod").addEventListener("input", editoruGuncelle);
$("#kod").addEventListener("scroll", () => {
  $("#renkli").parentElement.scrollTop = $("#kod").scrollTop;
  $("#renkli").parentElement.scrollLeft = $("#kod").scrollLeft;
  $("#satirlar").scrollTop = $("#kod").scrollTop;
});
$("#kod").addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey) return;
  e.preventDefault();
  const t = e.target, b = t.selectionStart;
  t.setRangeText("  ", b, t.selectionEnd, "end");
  editoruGuncelle();
  canliOnizle();
});

// Elle düzenleme canlı: yazma durunca (800 ms) modül önizlemede yerinde yeniden çalışır.
let canliZamanlayici = 0;
function canliOnizle() {
  clearTimeout(canliZamanlayici);
  canliZamanlayici = setTimeout(() => onizle({ yeniden: false, sessiz: true }), 800);
}
$("#kod").addEventListener("input", canliOnizle);
$("#ad").addEventListener("input", canliOnizle);
for (const s of ["#renk", "#ikon", "#kategori"]) $(s).addEventListener("change", canliOnizle);

let akisNo = 0;
async function kodAkit(kod) {
  clearTimeout(canliZamanlayici);
  const kutu = $("#kod");
  const bu = ++akisNo;
  if (hareketAzalt()) { kutu.value = kod; editoruGuncelle(); return true; }
  const satirlar = kod.split("\n");
  const adim = Math.max(1, Math.ceil(satirlar.length / 40));
  $("#editor").classList.add("yaziliyor");
  for (let i = adim; i < satirlar.length + adim; i += adim) {
    kutu.value = satirlar.slice(0, i).join("\n");
    editoruGuncelle();
    kutu.scrollTop = kutu.scrollHeight;
    $("#renkli").parentElement.scrollTop = kutu.scrollTop;
    await new Promise((r) => setTimeout(r, 34));
    if (bu !== akisNo) { $("#editor").classList.remove("yaziliyor"); return false; }
  }
  kutu.value = kod;
  editoruGuncelle();
  kutu.scrollTop = 0;
  $("#renkli").parentElement.scrollTop = 0;
  $("#satirlar").scrollTop = 0;
  $("#editor").classList.remove("yaziliyor");
  return true;
}

const sonaKaydir = () => { const m = $("#mesajlar"); m.scrollTo({ top: m.scrollHeight, behavior: "smooth" }); };
function mesajEkle(rol, metin, { adimlar = [], hata = false, kaynaklar = null } = {}) {
  const li = el("li", { className: `mesaj ${rol}${hata ? " hata" : ""}` }, el("p", { textContent: metin }));
  const kutu = kaynakKutusu(kaynaklar);
  if (kutu) li.append(kutu);
  if (adimlar.length) li.append(el("ul", { className: "adimlar" }, ...adimlar.map(([m, sinif], i) => el("li", { className: `adim ${sinif ?? ""}`, textContent: m, style: `--i:${i}` }))));
  $("#mesajlar").append(li);
  sonaKaydir();
  return li;
}

// Kalfanın yanıtının dayandığı kaynaklar: bilgi bankasındaki eser kayıtları (künyesiyle) ve SDK sözleşmesinin parçaları.
// Sunucu bunları yalnızca araçların gerçekten döndürdüğü eserlerden ve sözleşmede bulunan adlardan kurar (server/kalfa.js).
function kaynakKutusu(k) {
  const eserler = k?.eserler ?? [], sdk = k?.sdk ?? [];
  if (!eserler.length && !sdk.length) return null;
  const kutu = el("details", { className: "kaynaklar" },
    el("summary", { textContent: `Kaynaklar · ${[eserler.length && `${eserler.length} eser kaydı`, sdk.length && "SDK"].filter(Boolean).join(" + ")}` }));
  if (eserler.length) {
    kutu.append(el("p", { className: "kaynak-baslik", textContent: "Bilgi bankası" }), el("ul", { className: "kaynak-listesi" },
      ...eserler.map((e) => {
        const ac = el("button", { type: "button", className: "kaynak-eser", textContent: `${e.ad}${e.il ? ` (${e.il})` : ""}`, title: "Eser kaydını aç" });
        ac.addEventListener("click", () => eserDuzenlemeyeAc(e.id));
        return el("li", {}, ac, e.kaynak ? el("small", { textContent: e.kaynak }) : null);
      })));
  }
  if (sdk.length) kutu.append(el("p", { className: "kaynak-baslik", textContent: "SDK sözleşmesi (@lonca/sdk)" }), el("p", { className: "kaynak-sdk" }, ...sdk.map((a) => el("code", { textContent: a }))));
  return kutu;
}

// ---------- Kalfa kipi: Modül ya da Dalış ----------
// Dalış kipinde ustanın yazdığı her şey bir dalış isteğidir: dalış kalfası (server/dalis-kalfasi.js) eseri bulur,
// kaynakları toplar, geziyi planlar, kareleri üretir ve dalışı onay bekleyen olarak kaydeder.
let kip = "modul";
const KIP = {
  modul: { not: "Soru sor, fikrini konuş; yazmasını isteyince mini uygulamaya çevirir", ipucu: "Sor ya da fikrini anlat… (Enter gönderir, Shift+Enter yeni satır)" },
  dalis: { not: "İsteğini uydudan eserin içine inen bir geziye çevirir (birkaç dakika sürer)", ipucu: "Hangi eser, neler anlatılsın? Örn. \"Ulu Cami'nin minberini ve şadırvanını anlatan bir dalış\"" },
};
function kipSec(yeni) {
  kip = yeni;
  for (const b of document.querySelectorAll(".kip button[data-kip]")) {
    const secili = b.dataset.kip === kip;
    b.classList.toggle("secili", secili);
    b.setAttribute("aria-checked", String(secili));
  }
  $("#kip-not").textContent = KIP[kip].not;
  $("#istek").placeholder = KIP[kip].ipucu;
  onerileriGoster();
  if (kip === "dalis" && !dalisOnerisiYuklendi) dalisOnerileriniYenile();
}
document.querySelectorAll(".kip button[data-kip]").forEach((b) => b.addEventListener("click", () => kipSec(b.dataset.kip)));
$("#dalis-oneriler").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) gonder(b.textContent); });

// ---------- Öneri düğmeleri ----------
// Modül kipinde kalfa her yanıtla 2–3 yeni öneri verir; boş sohbette index.html'deki örnek fikirler görünür.
// Dalış kipinde öneriler sunucudan (bilgi bankasındaki eserlerden) gelir ve her dalış isteğinden sonra yenilenir.
const ILK_ONERILER = [...document.querySelectorAll("#oneriler button")].map((b) => b.textContent);
let kalfaOnerileri = null; // null: sohbet boş, örnek fikirler gösterilir
let dalisOnerisiYuklendi = false;
const dalisIstenenler = [];
const dalisOneriEserleri = new Map(); // öneri metni → eser kimliği (gönderilen öneri yeniden önerilmesin)
function oneriDugmeleri(kutu, metinler) {
  kutu.replaceChildren(...metinler.map((m) => el("button", { type: "button", textContent: m })));
}
function onerileriGoster() {
  const liste = kalfaOnerileri ?? ILK_ONERILER;
  oneriDugmeleri($("#oneriler"), liste);
  // Sohbet başladıktan sonra kalfanın kısa önerileri yan yana küçük düğmeler olarak durur (mesajlara yer kalsın).
  $("#oneriler").classList.toggle("kompakt", kalfaOnerileri !== null);
  $("#oneriler").hidden = kip !== "modul" || !liste.length;
  $("#dalis-oneriler").hidden = kip !== "dalis" || !$("#dalis-oneriler").children.length;
}
function kalfaOnerileriniAyarla(liste) {
  kalfaOnerileri = Array.isArray(liste) ? liste : null;
  onerileriGoster();
}
async function dalisOnerileriniYenile() {
  dalisOnerisiYuklendi = true;
  try {
    const { oneriler } = await yApi(`/api/dalis-kalfasi/oneriler?haric=${encodeURIComponent(dalisIstenenler.slice(-10).join(","))}`, { yeniden: false });
    for (const o of oneriler) dalisOneriEserleri.set(o.metin, o.eser);
    if (oneriler.length) oneriDugmeleri($("#dalis-oneriler"), oneriler.map((o) => o.metin));
  } catch { dalisOnerisiYuklendi = false; /* öneriler alınamadı: eldekiler kalır */ }
  onerileriGoster();
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
function dalisKutusu() {
  const cubuk = el("div", { className: "dalis-cubuk" }, el("span", { style: "width:3%" }));
  const gunluk = el("ul", { className: "dalis-gunluk" });
  const baslik = el("p", { textContent: "Dalış kalfası isteğini anlıyor…" });
  const li = el("li", { className: "mesaj kalfa" }, baslik, el("div", { className: "dalis-ilerleme" }, cubuk, gunluk));
  $("#mesajlar").append(li);
  sonaKaydir();
  return { li, cubuk, gunluk, baslik };
}
// Dalış işini sunucudan izler. geriYukleme: sayfa yenilendikten sonra oturumdan açılan eski bir dalış (önizleme kendiliğinden açılmaz).
async function dalisIzle(is, { li, cubuk, gunluk, baslik }, { geriYukleme = false, bu = oturumSurumu } = {}) {
  let goruldu = 0, durum;
  try {
    while (true) {
      durum = await yApi(`/api/dalis-kalfasi/${encodeURIComponent(is)}`, { yeniden: false });
      if (bu !== oturumSurumu) return;
      for (const g of durum.gunluk.slice(goruldu)) gunluk.append(el("li", { textContent: `${String(g.t).padStart(3, " ")} sn  ${g.metin}` }));
      goruldu = durum.gunluk.length;
      gunluk.scrollTop = gunluk.scrollHeight;
      cubuk.firstChild.style.width = `${Math.max(3, (durum.adim / durum.toplamAdim) * 100)}%`;
      if (durum.ad) baslik.textContent = `${durum.ad} için dalış hazırlanıyor (adım ${durum.adim}/${durum.toplamAdim})…`;
      if (durum.durum !== "calisiyor") break;
      await bekle(1500);
    }
  } catch (h) {
    if (geriYukleme && /bulunamadı/.test(h.message)) {
      baslik.textContent = "Bu dalış işinin kaydı sunucuda artık yok (sunucu yeniden başlamış olabilir). Sonucuna Dalışlar sayfasından bakabilirsin.";
      return;
    }
    li.classList.add("hata");
    baslik.textContent = h.message;
    return;
  }
  if (durum.durum === "hata") {
    li.classList.add("hata");
    baslik.textContent = durum.hata;
    return;
  }
  cubuk.firstChild.style.width = "100%";
  baslik.textContent = yoneticiMi()
    ? `${durum.ad} dalışı hazır: ${durum.sonuc.kareSayisi} durak. Önizlemede "onay bekliyor" olarak görünüyor; kartları kontrol edip yayınla.`
    : `${durum.ad} dalışı hazır: ${durum.sonuc.kareSayisi} durak. Önizlemede "onay bekliyor" olarak görünüyor; admin kartları kontrol edip onaylayınca yayına girer.`;
  if (!geriYukleme && durum.eser) { dalisIstenenler.push(durum.eser); dalisOnerileriniYenile(); }
  const onizleDugme = el("button", { type: "button", className: "ikincil", textContent: "Önizle" });
  const yayinla = el("button", { type: "button", className: "birincil yalniz-admin", textContent: "Yayınla" });
  onizleDugme.addEventListener("click", () => dalisOnizle());
  yayinla.addEventListener("click", async () => {
    try {
      await yApi(`/api/dalislar/${durum.eser}/durum`, { method: "POST", govde: { durum: "onayli" } });
      yayinla.disabled = true; yayinla.textContent = "Yayında ✓";
    } catch (h) { mesajEkle("kalfa", h.message, { hata: true }); }
  });
  li.append(el("div", { className: "dalis-dugmeler" }, onizleDugme, yayinla));
  if (!geriYukleme) dalisOnizle();
}
async function dalisGonder(metin) {
  if (dalisOneriEserleri.has(metin)) dalisIstenenler.push(dalisOneriEserleri.get(metin));
  mesajEkle("usta", metin);
  $("#istek").value = "";
  $("#gonder").disabled = true;
  const kutu = dalisKutusu();
  const bu = oturumSurumu;
  sahneDurum("Dalış kalfası çalışıyor…");
  try {
    const oturum = await oturumGerekli();
    const { is } = await yApi("/api/dalis-kalfasi", { method: "POST", govde: { istek: metin, oturum } });
    dalisOnerileriniYenile(); // gönderilen öneri listede takılı kalmasın
    await dalisIzle(is, kutu, { bu });
    return;
  } catch (h) {
    kutu.li.classList.add("hata");
    kutu.baslik.textContent = h.message;
    dalisOnerileriniYenile(); // istek başarısız olsa da öneriler yenilenir
  } finally {
    if (bu === oturumSurumu) { $("#gonder").disabled = false; sahneDurum(null); }
    $("#istek").focus();
    sonaKaydir();
  }
}

// Önizlemede Vakıf Dalışları modülünü açar; önizleme kipinde onay bekleyen dalışlar da listelenir.
async function dalisOnizle() {
  try {
    const kod = await (await fetch("/api/moduller/vakif-dalislari/kod")).text();
    bekleyen = { kod, ad: "Vakıf Dalışları", id: "vakif-dalislari", renk: "altin", ikon: "cami", kategori: "gezi" };
    cerceveyiYenile();
    sahneDurum(null);
    document.dispatchEvent(new CustomEvent("studio:onizleme-hazir"));
  } catch (h) { mesajEkle("kalfa", `Önizleme açılamadı: ${h.message}`, { hata: true }); }
}

// Kalfanın yanıtındaki iz (veri aramaları, deneme sayısı, model) sohbette adım listesi olarak gösterilir.
function adimlarYap({ tur = "modul", aramalar = [], deneme = 1, model = null } = {}) {
  const adimlar = aramalar.map((a) => {
    if (a.okunan) return [`Bilgi bankasından okudu: ${a.ad ?? a.okunan}`];
    const sorgu = Object.entries(a.sorgu ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "tümü";
    return [`Bilgi bankasında aradı: ${sorgu} → ${a.bulunan} eser`];
  });
  if (tur === "sohbet") {
    if (model) adimlar.push([model === "sahte" ? "Sahte kalfa: yapay zekâ bağlı değil" : `Yanıtlayan model: ${model}`]);
    return adimlar;
  }
  if (deneme > 1) adimlar.push([`Denetimde hata buldu, ${deneme}. denemede düzeltti`, "duzeltme"]);
  adimlar.push(["SDK tip denetiminden geçti"]);
  if (model) adimlar.push([model === "sahte" ? "Sahte kalfa: yapay zekâ bağlı değil, hazır şablon" : `Kodu yazan model: ${model}`]);
  return adimlar;
}
const yaziyorEkle = (metin) => {
  const li = el("li", { className: "mesaj kalfa" }, el("div", { className: "yaziyor" }, el("i"), el("i"), el("i"), el("span", { textContent: metin })));
  $("#mesajlar").append(li);
  sonaKaydir();
  return li;
};
// Kalfanın yazdığı modülü editöre akıtır ve önizler.
async function taslagiAkit(t) {
  surumSakla("kalfa yazmadan önce");
  sahneDurum("Kalfa modülü yazıyor…");
  if (!(await kodAkit(t.kod))) { sahneDurum(null); return; }
  $("#ad").value = t.ad ?? ""; $("#id").value = t.id ?? ""; $("#aciklama").value = t.aciklama ?? "";
  $("#renk").value = t.renk ?? ""; $("#ikon").value = t.ikon ?? ""; $("#kategori").value = t.kategori ?? "";
  editoruGuncelle();
  taslakDegisti(); // kalfa beklenirken editörde yapılan bir değişiklik oturumdaki sonucu ezmiş olabilir
  durumYaz("iyi", "Modül hazır, önizlemede çalışıyor.");
  onizle();
  sahneDurum(null);
  document.dispatchEvent(new CustomEvent("studio:onizleme-hazir"));
}

async function gonder(metin) {
  metin = metin.trim();
  if (!metin || $("#gonder").disabled) return;
  if (kip === "dalis") return dalisGonder(metin);
  mesajEkle("usta", metin);
  $("#istek").value = "";
  $("#oneriler").hidden = true;
  $("#gonder").disabled = true;
  const yaziyor = yaziyorEkle("Kalfa düşünüyor: bilgi bankasına ve SDK'ya bakıyor");
  const bu = oturumSurumu;
  sahneDurum("Kalfa düşünüyor…");
  try {
    // İstek oturuma yazılır; sayfa bu sırada yenilense de kalfanın yanıtı sunucuda oturuma kaydedilir.
    const oturum = await oturumGerekli();
    const s = await yApi("/api/kalfa", { method: "POST", govde: { oturum, istek: metin, kod: $("#kod").value } });
    yaziyor.remove();
    if (bu !== oturumSurumu) return;
    kalfaOnerileriniAyarla(s.oneriler ?? []);
    if (s.tur === "sohbet") {
      mesajEkle("kalfa", s.metin, { adimlar: adimlarYap(s), kaynaklar: s.kaynaklar });
      return;
    }
    mesajEkle("kalfa", s.aciklama_ustaya, { adimlar: adimlarYap(s), kaynaklar: s.kaynaklar });
    await taslagiAkit({ ...s, ikon: s.ikon === "genel" ? "" : s.ikon });
  } catch (h) {
    yaziyor.remove();
    if (bu !== oturumSurumu) return;
    onerileriGoster();
    const ayrinti = h.ayrintilar?.length ? `\n• ${h.ayrintilar.join("\n• ")}` : "";
    mesajEkle("kalfa", h instanceof TypeError ? `Sunucuya ulaşılamadı: ${h.message}. Sunucunun çalıştığını kontrol et.` : `${h.message}${ayrinti}`, { hata: true });
  } finally {
    if (bu === oturumSurumu) { $("#gonder").disabled = false; sahneDurum(null); }
    $("#istek").focus();
  }
}

$("#sohbet-formu").addEventListener("submit", (e) => { e.preventDefault(); gonder($("#istek").value); });
$("#istek").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gonder($("#istek").value); }
});
$("#oneriler").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) gonder(b.textContent); });

// Önizleme kendiliğinden çalışır: kalfa modülü bitirince, oturum/modül açılınca ve elle düzenlemede (canliOnizle).
// yeniden: çerçeveyi baştan yükle; false ise hazır çerçevede modül yerinde yeniden çalışır (app.js öncekini iptal eder).
// sessiz: kod boşsa uyarı yazma, telefonu parlatma (yazarken her değişiklikte).
let bekleyen = null;
let cerceveHazir = false; // çerçeve "onizleme-hazir" dedi; src değişince yeniden beklenir
function cerceveyiYenile() {
  cerceveHazir = false;
  $("#cerceve").src = `/app/?onizleme=1&t=${Date.now()}`;
}
function onizle({ yeniden = true, sessiz = false } = {}) {
  clearTimeout(canliZamanlayici);
  const kod = $("#kod").value;
  if (!kod.trim()) {
    if (!sessiz) durumYaz("kotu", "Önizlenecek kod yok. Kalfaya bir fikir anlat ya da kodu elle yaz.");
    return;
  }
  bekleyen = { kod, ad: $("#ad").value, id: $("#id").value, renk: $("#renk").value || undefined, ikon: $("#ikon").value || undefined, kategori: $("#kategori").value || undefined };
  if (!yeniden && cerceveHazir) $("#cerceve").contentWindow.postMessage({ tur: "onizle", ...bekleyen }, location.origin);
  else cerceveyiYenile();
  if (sessiz) return;
  const telefon = $(".telefon");
  telefon.classList.remove("parla");
  void telefon.offsetWidth;
  telefon.classList.add("parla");
}
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.source !== $("#cerceve").contentWindow) return;
  if (e.data?.tur === "onizleme-hazir") {
    cerceveHazir = true;
    if (bekleyen) $("#cerceve").contentWindow.postMessage({ tur: "onizle", ...bekleyen }, location.origin);
  }
  if (e.data?.tur === "eser-duzenle" && typeof e.data.id === "string") eserDuzenlemeyeAc(e.data.id);
});
$("#onizleme-yenile").addEventListener("click", () => onizle());

// Kalfa çalışırken önizlemenin üstünde görünen durum (ekran okuyucuya da duyurulur).
// Canlı bölge hep yerinde durur, yalnızca metni değişir; aria-busy telefonda (güncellenen içerik), bölgede değil.
function sahneDurum(metin) {
  $("#sahne").classList.toggle("calisiyor", !!metin);
  if (metin) $(".telefon").setAttribute("aria-busy", "true"); else $(".telefon").removeAttribute("aria-busy");
  $("#sahne-durum-metin").textContent = metin ?? "";
}

const SIFRE_ANAHTARI = "lonca.yonetici";
const sifreOku = () => { try { return sessionStorage.getItem(SIFRE_ANAHTARI) ?? ""; } catch { return ""; } };
let yonetimSifreli = false;
// Admin: geliştirme modu (şifre tanımlı değil), girilmiş yönetici şifresi ya da şifresini belirlemiş editör hesabı.
// Sunucu her istekte rolü yeniden denetler; bu yalnızca arayüzde neyin gösterileceğini belirler.
const yoneticiMi = () => !yonetimSifreli || !!sifreOku() || (hesap?.rol === "editor" && !hesap.sifreDegismeli);

async function yApi(yol, { method = "GET", govde, yeniden = true, basliklar = {} } = {}) {
  const y = await fetch(yol, {
    method, headers: { ...(govde !== undefined ? { "content-type": "application/json" } : {}), "x-yonetici-sifre": sifreOku(), ...hesapBasligi(), ...basliklar },
    body: govde !== undefined ? JSON.stringify(govde) : undefined,
  });
  if (y.status === 401 && yeniden && await oturumIste()) return yApi(yol, { method, govde, basliklar, yeniden: false });
  const veri = y.headers.get("content-type")?.includes("json") ? await y.json() : await y.text();
  if (!y.ok) throw Object.assign(new Error(veri?.hata ?? `İstek başarısız (${y.status})`), { ayrintilar: veri?.ayrintilar ?? [] });
  return veri;
}

function girisIste() {
  const d = $("#giris");
  $("#giris-hata").textContent = "";
  $("#giris-sifre").value = "";
  d.showModal();
  return new Promise((coz) => {
    d.addEventListener("close", async function kapandi() {
      d.removeEventListener("close", kapandi);
      if (d.returnValue !== "giris") return coz(false);
      try { sessionStorage.setItem(SIFRE_ANAHTARI, $("#giris-sifre").value); } catch {}
      const y = await fetch("/api/yonetici", { headers: { "x-yonetici-sifre": sifreOku() } });
      yetkiGuncelle();
      if (!y.ok) { try { sessionStorage.removeItem(SIFRE_ANAHTARI); } catch {} return coz(await girisIste()); }
      coz(true);
    });
  });
}
function yoneticiRozeti(girildi) {
  const r = $("#yonetici");
  // Hesaplı Studio'da yetki hesap rozetinde görünür; bu rozet yalnızca yönetici şifresiyle girilince kalır.
  r.hidden = hesapGerekli && !girildi;
  r.classList.toggle("canli", girildi || !yonetimSifreli);
  r.textContent = !yonetimSifreli ? "Geliştirme modu" : girildi ? "Yönetici ✓" : "Yönetici girişi";
  r.title = !yonetimSifreli ? "YONETICI_SIFRE tanımlı değil: onay işlemleri şifresiz" : "";
}
$("#yonetici").addEventListener("click", () => { if (yonetimSifreli) girisIste().then(() => { yetkiGuncelle(); sayfayiYenile(); oturumlariBaslat(); }); });

// ---------- Hesap (usta / admin) ----------
// Sunucu yönetici şifresiyle çalışıyorsa Studio'nun tamamı hesap ister: kayıt olan usta, hazır hesaplar admin (rol: editor).
// Jeton localStorage'da durur (bütün sayfalar aynı oturumu kullanır); rol her istekte sunucuda hesaptan okunur.
const JETON_ANAHTARI = "lonca.studio.hesap";
const ROL_ADI = { vatandas: "Vatandaş", usta: "Usta", editor: "Admin" };
const ROL_ACIKLAMA = {
  vatandas: "Bu hesabın Studio yetkisi yok.",
  usta: "Kalfayla modül yazıp onaya gönderebilir, Studio'daki verileri görebilirsin. Onay ve düzenleme admin hesaplarındadır.",
  editor: "Modül yazabilir, onaylayıp yayınlayabilir, içeriği ve ayarları düzenleyebilirsin.",
};
let hesapGerekli = false, hesap = null;

const jetonOku = () => { try { return localStorage.getItem(JETON_ANAHTARI) ?? ""; } catch { return ""; } };
const jetonYaz = (j) => { try { j ? localStorage.setItem(JETON_ANAHTARI, j) : localStorage.removeItem(JETON_ANAHTARI); } catch {} };
function hesapBasligi() { const j = jetonOku(); return j ? { authorization: `Bearer ${j}` } : {}; }
const studioHesabi = () => ["usta", "editor"].includes(hesap?.rol) && !hesap.sifreDegismeli;
// Studio'ya girilmiş mi: geliştirme modu, şifresini belirlemiş usta/admin hesabı ya da yönetici şifresi.
const oturumVar = () => !hesapGerekli || studioHesabi() || (yonetimSifreli && !!sifreOku());
const atolyeAcik = oturumVar;
// Rozetler, kilitler ve admin'e özel düğmeler (.yalniz-admin) tek yerden güncellenir.
function yetkiGuncelle() {
  document.body.classList.toggle("admin", yoneticiMi());
  yoneticiRozeti(!!sifreOku());
  hesapRozetiGuncelle();
  atolyeKilidiGuncelle();
}
const acikSayfa = () => document.querySelector(".sekme-d.secili")?.dataset.sayfa ?? "atolye";
const sayfayiYenile = () => sayfaAc(acikSayfa());

function hesapRozetiGuncelle() {
  const d = $("#hesap-d");
  d.hidden = !hesapGerekli;
  d.classList.toggle("canli", !!hesap);
  $("#hesap-ad").textContent = hesap ? `${hesap.kimlik} · ${ROL_ADI[hesap.rol] ?? hesap.rol}` : "Giriş yap";
  d.setAttribute("aria-label", hesap ? `Hesap: ${hesap.kimlik}, ${ROL_ADI[hesap.rol] ?? hesap.rol}` : "Giriş yap ya da hesap oluştur");
  d.title = hesap ? "Hesap" : "Giriş yap ya da hesap oluştur";
}
function atolyeKilidiGuncelle() {
  const acik = atolyeAcik();
  $("#pane-kalfa").classList.toggle("kilitli", !acik);
  $("#atolye-kilit").hidden = acik;
}
async function hesabiYukle() {
  if (!jetonOku()) return;
  try {
    const y = await fetch("/api/hesap/ben", { headers: hesapBasligi() });
    if (y.status === 401) { jetonYaz(""); hesap = null; }
    else if (y.ok) hesap = await y.json();
  } catch { /* sunucuya ulaşılamadı: jeton kalır, sonraki açılışta yeniden denenir */ }
}

// Giriş / kayıt penceresi. Başarılıysa true döner; "Yönetici şifresiyle gir" de geçerli bir yoldur.
// kapi: Studio'nun giriş kapısı; pencere kapatılamaz (Vazgeç yok, Escape çalışmaz).
function hesapPenceresiAc({ kip = "giris", kapi = false } = {}) {
  const d = $("#hesap-pencere"), f = $("#hesap-formu");
  let simdiki = kip;
  const uygula = () => {
    const kayit = simdiki === "kayit";
    for (const b of d.querySelectorAll("[data-hesap-kip]")) {
      const secili = b.dataset.hesapKip === simdiki;
      b.classList.toggle("secili", secili);
      b.setAttribute("aria-checked", String(secili));
    }
    $("#hesap-baslik-metin").textContent = kayit ? "Hesap oluştur" : "Giriş yap";
    $("#hesap-gonder").textContent = kayit ? "Hesap oluştur" : "Giriş yap";
    $("#hesap-kayit-notu").hidden = !kayit;
    $("#hesap-sifre").autocomplete = kayit ? "new-password" : "current-password";
    // En az 8 karakter yalnızca yeni hesapta; hazır hesapların ilk şifresi daha kısa olabilir.
    if (kayit) $("#hesap-sifre").minLength = 8; else $("#hesap-sifre").removeAttribute("minlength");
    $("#hesap-sifre").placeholder = kayit ? "En az 8 karakter" : "";
    $("#hesap-yonetici").hidden = !yonetimSifreli;
    $("#hesap-vazgec").hidden = kapi;
  };
  $("#hesap-hata").textContent = "";
  $("#hesap-sifre").value = "";
  uygula();
  const kipSec = (e) => { const b = e.target.closest("[data-hesap-kip]"); if (b) { simdiki = b.dataset.hesapKip; $("#hesap-hata").textContent = ""; uygula(); } };
  const iptal = (e) => { if (kapi) e.preventDefault(); };
  let yoneticiyle = false;
  const yoneticiTik = () => { yoneticiyle = true; d.close("yonetici"); };
  d.addEventListener("click", kipSec);
  d.addEventListener("cancel", iptal);
  $("#hesap-yonetici").addEventListener("click", yoneticiTik);
  // Gönderimi pencere içinde ele al: hata olursa pencere açık kalır, yazılanlar silinmez.
  const gonder = async (e) => {
    if (e.submitter?.value !== "gonder") return;
    e.preventDefault();
    const kayit = simdiki === "kayit";
    const govde = { kimlik: $("#hesap-kimlik").value.trim(), sifre: $("#hesap-sifre").value };
    $("#hesap-gonder").disabled = true;
    $("#hesap-hata").textContent = "";
    try {
      const y = await fetch(kayit ? "/api/hesap/kayit" : "/api/hesap/giris", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(govde),
      });
      const veri = await y.json().catch(() => ({}));
      if (!y.ok) { $("#hesap-hata").textContent = veri.hata ?? `İşlem başarısız (${y.status})`; return; }
      if (!["usta", "editor"].includes(veri.hesap?.rol)) { $("#hesap-hata").textContent = "Bu hesabın Studio yetkisi yok."; return; }
      jetonYaz(veri.jeton);
      hesap = veri.hesap;
      d.close("tamam");
    } catch { $("#hesap-hata").textContent = "Sunucuya ulaşılamadı."; }
    finally { $("#hesap-gonder").disabled = false; }
  };
  f.addEventListener("submit", gonder);
  d.showModal();
  (simdiki === "kayit" || !$("#hesap-kimlik").value ? $("#hesap-kimlik") : $("#hesap-sifre")).focus();
  return new Promise((coz) => {
    d.addEventListener("close", async () => {
      d.removeEventListener("click", kipSec);
      d.removeEventListener("cancel", iptal);
      f.removeEventListener("submit", gonder);
      $("#hesap-yonetici").removeEventListener("click", yoneticiTik);
      let tamam = d.returnValue === "tamam";
      // İlk şifreyle giren hazır hesap, yeni şifresini belirlemeden devam edemez.
      if (tamam && hesap?.sifreDegismeli) tamam = await sifrePenceresiAc({ zorunlu: true });
      if (tamam) { yetkiGuncelle(); bildirim(`Hoş geldin, ${hesap.kimlik}.`); }
      if (yoneticiyle) return coz(await girisIste());
      coz(tamam);
    }, { once: true });
  });
}
// Şifre değiştirme. zorunlu: ilk girişte; pencere kapatılamaz, yalnızca kaydet ya da çıkış.
function sifrePenceresiAc({ zorunlu = false } = {}) {
  const d = $("#sifre-pencere"), f = $("#sifre-formu");
  $("#sifre-aciklama").textContent = zorunlu
    ? `Hoş geldin, ${hesap.kimlik}. Bu ilk girişin; devam etmek için kendi şifreni belirle.`
    : "Mevcut şifreni ve yeni şifreni yaz.";
  $("#sifre-kimlik").value = hesap.kimlik;
  $("#sifre-eski-etiketi").hidden = zorunlu;
  $("#sifre-eski").required = !zorunlu;
  $("#sifre-vazgec").hidden = zorunlu;
  $("#sifre-cikis").hidden = !zorunlu;
  for (const g of ["#sifre-eski", "#sifre-yeni", "#sifre-tekrar"]) $(g).value = "";
  $("#sifre-hata").textContent = "";
  const iptal = (e) => { if (zorunlu) e.preventDefault(); };
  const gonder = async (e) => {
    if (e.submitter?.value !== "gonder") return;
    e.preventDefault();
    const yeniSifre = $("#sifre-yeni").value;
    if (yeniSifre !== $("#sifre-tekrar").value) { $("#sifre-hata").textContent = "Yeni şifreler birbirini tutmuyor."; $("#sifre-tekrar").focus(); return; }
    $("#sifre-gonder").disabled = true;
    $("#sifre-hata").textContent = "";
    try {
      const y = await fetch("/api/hesap/sifre", {
        method: "PUT", headers: { "content-type": "application/json", ...hesapBasligi() },
        body: JSON.stringify(zorunlu ? { yeniSifre } : { eskiSifre: $("#sifre-eski").value, yeniSifre }),
      });
      const veri = await y.json().catch(() => ({}));
      if (!y.ok) { $("#sifre-hata").textContent = veri.hata ?? `İşlem başarısız (${y.status})`; return; }
      hesap = veri;
      d.close("tamam");
    } catch { $("#sifre-hata").textContent = "Sunucuya ulaşılamadı."; }
    finally { $("#sifre-gonder").disabled = false; }
  };
  d.addEventListener("cancel", iptal);
  f.addEventListener("submit", gonder);
  d.showModal();
  (zorunlu ? $("#sifre-yeni") : $("#sifre-eski")).focus();
  return new Promise((coz) => {
    d.addEventListener("close", () => {
      d.removeEventListener("cancel", iptal);
      f.removeEventListener("submit", gonder);
      const tamam = d.returnValue === "tamam";
      if (tamam) bildirim("Şifren güncellendi.");
      else if (zorunlu) hesapCikis();
      coz(tamam);
    }, { once: true });
  });
}
// Giriş kapısı: oturum yoksa Studio gizlenir ve giriş (gerekirse ilk şifre değişimi) tamamlanana kadar açık kalır.
let kapiAcik = false;
async function kapiyiAc() {
  if (oturumVar() || kapiAcik) return;
  kapiAcik = true;
  document.body.classList.add("kapali");
  $("#giris-kapisi").hidden = false;
  $("#kapi-amblem").innerHTML = $("#amblem").innerHTML;
  while (!oturumVar()) {
    if (hesap?.sifreDegismeli) await sifrePenceresiAc({ zorunlu: true });
    else await hesapPenceresiAc({ kapi: true });
  }
  document.body.classList.remove("kapali");
  $("#giris-kapisi").hidden = true;
  kapiAcik = false;
  yetkiGuncelle();
  sayfayiYenile();
  oturumlariBaslat();
}
// 401 alan istekler için. Oturum düştüyse (jeton süresi doldu, hesap silindi) giriş kapısı açılır;
// oturum sürüyorsa 401 yetki yokluğudur (ör. usta bir admin işlemi denedi): yeniden giriş sorulmaz.
async function oturumIste() {
  if (!hesapGerekli) { const sonuc = await girisIste(); yetkiGuncelle(); return sonuc; }
  if (hesap) await hesabiYukle();
  yetkiGuncelle();
  if (oturumVar()) return false;
  await kapiyiAc();
  return true;
}
// Editör listeleri (Modüller, İçerik) yetki ister; çıkışta onları yeniden istemek yerine atölyeye dönülür.
function hesapCikis() {
  taslakKaydet({ sayfaKapaniyor: true });
  jetonYaz(""); hesap = null;
  try { sessionStorage.removeItem(SIFRE_ANAHTARI); } catch {}
  atolyeyiSifirla();
  yetkiGuncelle();
  sayfaAc("atolye");
  bildirim("Çıkış yapıldı.");
  kapiyiAc();
}
$("#hesap-d").addEventListener("click", () => {
  if (!hesap) return hesapPenceresiAc().then((t) => { if (t) { sayfayiYenile(); oturumlariBaslat(); } });
  $("#hesap-kart-ad").textContent = `${hesap.kimlik} · ${ROL_ADI[hesap.rol] ?? hesap.rol}`;
  $("#hesap-kart-rol").textContent = ROL_ACIKLAMA[hesap.rol] ?? "";
  const k = $("#hesap-kart");
  k.addEventListener("close", () => {
    if (k.returnValue === "cikis") hesapCikis();
    else if (k.returnValue === "sifre") sifrePenceresiAc();
  }, { once: true });
  k.returnValue = "";
  k.showModal();
});
$("#kilit-giris").addEventListener("click", () => hesapPenceresiAc({ kip: "giris" }).then((t) => { if (t) oturumlariBaslat(); }));
$("#kilit-kayit").addEventListener("click", () => hesapPenceresiAc({ kip: "kayit" }).then((t) => { if (t) oturumlariBaslat(); }));

// ---------- Atölye oturumu: sohbet ve taslak sunucuda (issue #26) ----------
// Kalfa sohbeti ve editördeki modül, hesaba bağlı olarak sunucuda saklanır (server/atolye.js). Studio açılınca son oturum
// geri gelir; kalfa isteği sürerken sayfa yenilenirse sunucu yanıtı oturuma yazar, Studio bekleyip sonucu gösterir.
const OTURUM_ANAHTARI = "lonca.studio.oturum";
const KARSILAMA = $("#mesajlar .mesaj p").textContent;
let oturumId = null;
let oturumSurumu = 0; // oturum değişince eski yoklamalar ve yanıtlar ekrana yazılmasın
const sonOturumYaz = (id) => { try { localStorage.setItem(OTURUM_ANAHTARI, id); } catch {} };
const sonOturumOku = () => { try { return localStorage.getItem(OTURUM_ANAHTARI) ?? ""; } catch { return ""; } };

async function oturumGerekli() {
  if (oturumId) return oturumId;
  const o = await yApi("/api/atolye/oturumlar", { method: "POST", govde: { taslak: editorHali() } });
  oturumId = o.id;
  sonOturumYaz(o.id);
  taslakBekliyor = false;
  return o.id;
}

// Editördeki değişiklikler kısa bir beklemeyle oturuma yazılır; boş editör için oturum açılmaz.
let taslakZamanlayici = null, taslakBekliyor = false;
function taslakDegisti() {
  if (!atolyeAcik()) return;
  taslakBekliyor = true;
  clearTimeout(taslakZamanlayici);
  taslakZamanlayici = setTimeout(() => taslakKaydet(), 1200);
}
async function taslakKaydet({ sayfaKapaniyor = false } = {}) {
  clearTimeout(taslakZamanlayici);
  if (!taslakBekliyor) return;
  const hal = editorHali();
  if (!oturumId && !hal.kod.trim()) return;
  taslakBekliyor = false;
  try {
    if (sayfaKapaniyor) {
      if (!oturumId) return;
      fetch(`/api/atolye/oturumlar/${oturumId}/taslak`, {
        method: "PUT", keepalive: true, body: JSON.stringify(hal),
        headers: { "content-type": "application/json", "x-yonetici-sifre": sifreOku(), ...hesapBasligi() },
      }).catch(() => {});
      return;
    }
    const id = await oturumGerekli();
    await yApi(`/api/atolye/oturumlar/${id}/taslak`, { method: "PUT", govde: hal, yeniden: false });
  } catch { taslakBekliyor = true; }
}
$("#kod").addEventListener("input", taslakDegisti);
for (const s of ["#ad", "#id", "#aciklama"]) $(s).addEventListener("input", taslakDegisti);
for (const s of ["#renk", "#ikon", "#kategori"]) $(s).addEventListener("change", taslakDegisti);
window.addEventListener("pagehide", () => taslakKaydet({ sayfaKapaniyor: true }));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") taslakKaydet(); });

function mesajlariTemizle() {
  $("#mesajlar").replaceChildren(el("li", { className: "mesaj kalfa" }, el("p", { textContent: KARSILAMA })));
}
function editoruDoldur(t = {}) {
  $("#kod").value = t.kod ?? ""; $("#ad").value = t.ad ?? ""; $("#id").value = t.id ?? ""; $("#aciklama").value = t.aciklama ?? "";
  $("#renk").value = t.renk ?? ""; $("#ikon").value = t.ikon ?? ""; $("#kategori").value = t.kategori ?? "";
  editoruGuncelle();
}

async function oturumuAc(id) {
  await taslakKaydet();
  const bu = ++oturumSurumu;
  akisNo++;
  const o = await yApi(`/api/atolye/oturumlar/${encodeURIComponent(id)}`, { yeniden: false });
  if (bu !== oturumSurumu) return;
  oturumId = o.id;
  sonOturumYaz(o.id);
  taslakBekliyor = false;
  mesajlariTemizle();
  sahneDurum(null);
  for (const m of o.mesajlar) {
    if (m.dalis) dalisIzle(m.dalis, dalisKutusu(), { geriYukleme: true, bu });
    else mesajEkle(m.rol, m.metin, { adimlar: m.ek ? adimlarYap(m.ek) : [], hata: !!m.hata, kaynaklar: m.ek?.kaynaklar });
  }
  kalfaOnerileriniAyarla(o.mesajlar.length ? sonOneriler(o.mesajlar) : null);
  editoruDoldur(o.taslak ?? {});
  if (o.taslak?.kod?.trim()) onizle();
  durumYaz("", "");
  $("#gonder").disabled = false;
  if (o.bekleyen) kalfayiBekle(o, bu);
}

// Oturumdaki son kalfa yanıtının önerileri (eski kayıtlarda yoktur: boş liste).
const sonOneriler = (mesajlar) => [...mesajlar].reverse().find((m) => m.rol === "kalfa" && !m.dalis)?.ek?.oneriler ?? [];

// Sayfa kalfa çalışırken yenilendi: istek sunucuda sürüyor; bitince yanıt ve kod oturumdan alınır.
async function kalfayiBekle(o, bu) {
  const yaziyor = yaziyorEkle("Kalfa hâlâ çalışıyor: sayfa yenilendi ama isteğin sunucuda sürüyor");
  const onceki = o.mesajlar.length;
  $("#gonder").disabled = true;
  sahneDurum("Kalfa düşünüyor…");
  try {
    let son = o;
    do {
      await bekle(3000);
      if (bu !== oturumSurumu) return;
      son = await yApi(`/api/atolye/oturumlar/${o.id}`, { yeniden: false });
    } while (son.bekleyen);
    if (bu !== oturumSurumu) return;
    yaziyor.remove();
    const yeni = son.mesajlar.slice(onceki);
    for (const m of yeni) mesajEkle(m.rol, m.metin, { adimlar: m.ek ? adimlarYap(m.ek) : [], hata: !!m.hata, kaynaklar: m.ek?.kaynaklar });
    kalfaOnerileriniAyarla(sonOneriler(son.mesajlar));
    if (yeni.at(-1)?.uretim && son.taslak?.kod) await taslagiAkit(son.taslak);
  } catch (h) {
    if (bu !== oturumSurumu) return;
    yaziyor.remove();
    mesajEkle("kalfa", `Kalfanın durumu alınamadı: ${h.message}`, { hata: true });
  } finally {
    if (bu === oturumSurumu) { $("#gonder").disabled = false; sahneDurum(null); }
  }
}

async function yeniSohbet() {
  await taslakKaydet();
  oturumSurumu++;
  akisNo++;
  surumSakla("yeni sohbetten önce");
  oturumId = null;
  sonOturumYaz("yeni");
  taslakBekliyor = false;
  mesajlariTemizle();
  editoruDoldur();
  kalfaOnerileriniAyarla(null);
  durumYaz("", "");
  sahneDurum(null);
  $("#gonder").disabled = false;
  $("#istek").focus();
}

// Açılışta ve girişte: en son açık oturum (yoksa en yenisi) geri yüklenir. Kullanıcı "Yeni sohbet" dediyse boş başlar.
async function oturumlariBaslat() {
  if (oturumId || !atolyeAcik()) return;
  try {
    const { oturumlar } = await yApi("/api/atolye/oturumlar", { yeniden: false });
    const son = sonOturumOku();
    const hedef = oturumlar.find((o) => o.id === son) ?? (son === "yeni" ? null : oturumlar[0]);
    if (hedef && !oturumId) await oturumuAc(hedef.id);
  } catch { /* oturumlar alınamadı: atölye boş başlar */ }
}
function atolyeyiSifirla() {
  oturumSurumu++;
  akisNo++;
  oturumId = null;
  taslakBekliyor = false;
  clearTimeout(taslakZamanlayici);
  clearTimeout(canliZamanlayici);
  mesajlariTemizle();
  editoruDoldur();
  kalfaOnerileriniAyarla(null);
  sahneDurum(null);
  $("#gonder").disabled = false;
}

async function sohbetleriGoster() {
  const d = $("#sohbetler-pencere"), ul = $("#sohbet-listesi");
  ul.replaceChildren(el("li", { className: "aciklama", textContent: "Yükleniyor…" }));
  d.returnValue = "";
  d.showModal();
  await taslakKaydet();
  let liste;
  try { liste = (await yApi("/api/atolye/oturumlar")).oturumlar; }
  catch (h) { ul.replaceChildren(el("li", { className: "aciklama", textContent: h.message })); return; }
  if (!liste.length) { ul.replaceChildren(el("li", { className: "aciklama", textContent: "Henüz kayıtlı sohbet yok. Kalfaya bir fikir anlattığında burada görünür." })); return; }
  ul.replaceChildren(...liste.map((o) => {
    const ac = el("button", { type: "button", className: "sohbet-ac" },
      el("b", { textContent: o.baslik || (o.modul ? `${o.modul} (sohbetsiz taslak)` : "Adsız sohbet") }),
      el("small", { textContent: [tarihYaz(o.guncelleme), `${o.mesajSayisi} mesaj`, o.modul && o.baslik ? o.modul : null, o.bekliyor ? "kalfa çalışıyor" : null].filter(Boolean).join(" · ") }));
    ac.addEventListener("click", async () => {
      d.close("ac");
      try { await oturumuAc(o.id); } catch (h) { bildirim(h.message); }
    });
    const sil = el("button", { type: "button", className: "tehlike", textContent: "Sil" });
    sil.setAttribute("aria-label", `“${o.baslik || "Adsız sohbet"}” sohbetini sil`);
    sil.addEventListener("click", async () => {
      if (!sil.dataset.emin) { sil.dataset.emin = "1"; sil.textContent = "Emin misin?"; setTimeout(() => { delete sil.dataset.emin; sil.textContent = "Sil"; }, 4000); return; }
      sil.disabled = true;
      try {
        await yApi(`/api/atolye/oturumlar/${o.id}`, { method: "DELETE" });
        li.remove();
        if (o.id === oturumId) yeniSohbet();
        if (!ul.children.length) ul.append(el("li", { className: "aciklama", textContent: "Kayıtlı sohbet kalmadı." }));
      } catch (h) { sil.disabled = false; bildirim(h.message); }
    });
    const li = el("li", { className: `sohbet-ogesi${o.id === oturumId ? " secili" : ""}` }, ac, sil);
    if (o.id === oturumId) ac.setAttribute("aria-current", "true");
    return li;
  }));
}
$("#sohbetler-d").addEventListener("click", sohbetleriGoster);
$("#sohbetler-pencere").addEventListener("close", () => { if ($("#sohbetler-pencere").returnValue === "yeni") yeniSohbet(); });
$("#yeni-sohbet-d").addEventListener("click", yeniSohbet);

// ---------- Sayfalar ----------
function sayfaAc(ad) {
  for (const b of document.querySelectorAll(".sekme-d")) {
    const secili = b.dataset.sayfa === ad;
    b.classList.toggle("secili", secili);
    secili ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  }
  for (const s of document.querySelectorAll(".sayfa")) s.hidden = s.id !== `sayfa-${ad}`;
  if (ad === "moduller") modulleriListele();
  if (ad === "icerik") icerikYukle();
}
document.querySelectorAll(".sekme-d").forEach((b) => b.addEventListener("click", async () => { if (await ayrilabilirMi()) sayfaAc(b.dataset.sayfa); }));

function durumYaz(tur, metin, ayrintilar = [], hedef = "#durum") {
  const d = $(hedef);
  d.className = `durum ${tur}`;
  d.replaceChildren(metin);
  if (ayrintilar.length) d.append(el("ul", {}, ...ayrintilar.map((a) => el("li", { textContent: a }))));
}

// Özel modül onaya gitmez: düğme ne yapacağını söylesin.
function gonderDugmesiniYaz() { $("#onaya-gonder").textContent = $("#gorunurluk").value === "ozel" ? "Kaydet ve paylaş" : "Onaya gönder"; }
$("#gorunurluk").addEventListener("change", gonderDugmesiniYaz);
$("#onaya-gonder").addEventListener("click", async (olay) => {
  const kod = $("#kod").value;
  const dugme = olay.currentTarget;
  if (!dugme.dataset.emin) {
    let var_ = null;
    try { var_ = (await yApi("/api/moduller?durum=hepsi", { yeniden: false })).find((m) => m.id === $("#id").value.trim()); } catch {}
    if (var_) {
      dugme.dataset.emin = "1";
      const eski = dugme.textContent;
      dugme.textContent = "Üzerine yaz?";
      durumYaz("kotu", `“${var_.ad}” (${DURUM_ADI[var_.durum]}) bu kimlikle zaten var. Gönderirsen kodu değişir: yayındaysa ve editörsen uygulamada hemen güncellenir, değilse yeniden onay bekler. Yeni bir modül istiyorsan önce kimliği değiştir; yine de göndermek için düğmeye tekrar bas.`);
      setTimeout(() => { delete dugme.dataset.emin; dugme.textContent = eski; }, 6000);
      return;
    }
  }
  delete dugme.dataset.emin;
  const govde = {
    id: $("#id").value.trim(), ad: $("#ad").value.trim(), aciklama: $("#aciklama").value.trim(),
    renk: $("#renk").value || undefined, ikon: $("#ikon").value || undefined, kategori: $("#kategori").value || undefined,
    izinler: /eserler\.yakindaki/.test(kod) ? ["konum"] : [], kod, gorunurluk: $("#gorunurluk").value,
  };
  try {
    const s = await yApi("/api/moduller", { method: "POST", govde });
    if (s.durum === "ozel") {
      durumYaz("iyi", `“${s.ad}” özel olarak kaydedildi (${kaynakMetni(s.kaynak)}). Uygulamada listelenmez; bağlantıyı ya da davet kodunu paylaştığın herkes açabilir.`);
      $("#durum").append(el("div", { className: "durum-eylem" }, ...paylasimDugmeleri(s)));
      return;
    }
    if (s.durum === "onayli") {
      durumYaz("iyi", `“${s.ad}” güncellendi ve yayında kaldı (${kaynakMetni(s.kaynak)}). Uygulama birkaç saniye içinde yeni sürümü görür.`);
      $("#durum").append(el("div", { className: "durum-eylem" }, ...paylasimDugmeleri(s)));
      sayaclariGuncelle(); durumCubugu();
      return;
    }
    durumYaz("iyi", `“${s.ad}” onaya gönderildi (${kaynakMetni(s.kaynak)}). ${yoneticiMi() ? "Yayınlayınca" : "Admin onaylayınca"} uygulamada hemen görünür; paylaşım bağlantısı da o zaman açılır.`);
    const yayinla = el("button", { type: "button", className: "birincil kucuk-d", textContent: "Şimdi yayınla" });
    const listeyeGit = el("button", { type: "button", className: "ikincil kucuk-d", textContent: "Modüllerde gör" });
    yayinla.addEventListener("click", async () => {
      yayinla.disabled = true;
      try {
        await yApi(`/api/moduller/${encodeURIComponent(s.id)}/durum`, { method: "POST", govde: { durum: "onayli" } });
        durumYaz("iyi", `“${s.ad}” yayında; uygulamayı açan herkes görür.`);
        sayaclariGuncelle(); durumCubugu();
      } catch (h) { yayinla.disabled = false; durumYaz("kotu", h.message, h.ayrintilar); }
    });
    listeyeGit.addEventListener("click", () => sayfaAc("moduller"));
    $("#durum").append(el("div", { className: "durum-eylem" }, ...(yoneticiMi() ? [yayinla] : []), listeyeGit));
    sayaclariGuncelle();
  } catch (h) { durumYaz("kotu", h.message, h.ayrintilar); }
});

// Modülün kaynağı sunucuda belirlenir: kod kalfanın ürettiğiyle birebir aynıysa "kalfa", değilse "elle".
function kaynakMetni(k) {
  if (k?.tur === "kalfa") return k.sahte ? "sahte kalfa şablonu" : `kalfa yazdı · ${k.model}`;
  if (k?.tur === "elle") return "elle yazıldı/düzenlendi";
  return "kaynak kaydı yok";
}
// Paylaşım bağlantısı: özel modülde tahmin edilemez anahtar, yayındaki modülde kimlik. Android'de uygulamayı açar.
const paylasimAdresi = (m) => `${location.origin}/m/${encodeURIComponent(m.durum === "ozel" ? m.paylasim : m.id)}`;
const paylasilabilir = (m) => m.durum === "onayli" || (m.durum === "ozel" && m.paylasim);
function kopyalaDugmesi(etiket, deger, baslik) {
  const b = el("button", { type: "button", className: "ikincil kucuk-d", textContent: etiket, title: deger });
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(deger); b.textContent = "Kopyalandı"; }
    catch { window.prompt(baslik, deger); }
    setTimeout(() => { b.textContent = etiket; }, 2000);
  });
  return b;
}
// Asıl paylaşım yolu: cihazın paylaşım menüsü (Android'de WhatsApp vb.); yoksa bağlantı panoya kopyalanır.
function paylasDugmesi(m, adres) {
  const b = el("button", { type: "button", className: "birincil kucuk-d", title: adres });
  b.replaceChildren("Paylaş");
  b.addEventListener("click", async () => {
    const metin = m.durum === "ozel" && m.davetKodu ? `Lonca'da “${m.ad}” modülünü aç. Uygulamada davet kodu: ${m.davetKodu}` : `Lonca'da “${m.ad}” modülünü aç.`;
    if (navigator.share) {
      try { await navigator.share({ title: m.ad, text: metin, url: adres }); return; }
      catch (h) { if (h?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(adres); b.textContent = "Bağlantı kopyalandı"; }
    catch { window.prompt("Paylaşım bağlantısı", adres); }
    setTimeout(() => b.replaceChildren("Paylaş"), 2000);
  });
  return b;
}
function paylasimDugmeleri(m) {
  if (!paylasilabilir(m)) return [];
  const adres = paylasimAdresi(m);
  const ac = el("a", { className: "ikincil kucuk-d dugme-bag", href: adres, target: "_blank", rel: "noopener", textContent: "Aç" });
  // Özel modül uygulamada ve webde "Davet koduyla eriş" alanına yazılan kısa kodla da açılır.
  const davet = m.durum === "ozel" && m.davetKodu ? [kopyalaDugmesi(`Davet kodu: ${m.davetKodu}`, m.davetKodu, "Davet kodu")] : [];
  return [paylasDugmesi(m, adres), kopyalaDugmesi("Bağlantıyı kopyala", adres, "Paylaşım bağlantısı"), ...davet, ac];
}
const DURUM_ADI = { bekliyor: "Onay bekliyor", onayli: "Yayında", ozel: "Özel", kaldirildi: "Yayından kaldırıldı", arsiv: "Arşivde", reddedildi: "Reddedildi" };
const EYLEMLER = {
  bekliyor: [["Atölyede aç", "ac", "ikincil"], ["Yayınla", "onayli", "birincil"], ["Reddet", "reddedildi", "ikincil"], ["Sil", "sil", "tehlike"]],
  onayli: [["Atölyede aç", "ac", "ikincil"], ["Yayından kaldır", "kaldirildi", "ikincil"], ["Arşivle", "arsiv", "ikincil"]],
  ozel: [["Atölyede aç", "ac", "ikincil"], ["Arşivle", "arsiv", "ikincil"], ["Sil", "sil", "tehlike"]],
  kaldirildi: [["Atölyede aç", "ac", "ikincil"], ["Yeniden yayınla", "onayli", "birincil"], ["Arşivle", "arsiv", "ikincil"], ["Sil", "sil", "tehlike"]],
  arsiv: [["Arşivden çıkar", "kaldirildi", "ikincil"], ["Sil", "sil", "tehlike"]],
  reddedildi: [["Atölyede aç", "ac", "ikincil"], ["Yeniden değerlendir", "bekliyor", "ikincil"], ["Sil", "sil", "tehlike"]],
};
let modulSuzgeci = "hepsi";
const tarihYaz = (t) => (t ? new Date(t).toLocaleString(yerelDil(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

async function modulleriListele() {
  // Sunucu ustaya yalnızca kendi modüllerini döndürür; onay kuyruğu admin'e özeldir.
  $("#sayfa-moduller .sayfa-h").textContent = yoneticiMi() ? "Modüller" : "Modüllerim";
  $("#moduller-aciklama").textContent = yoneticiMi()
    ? "Atölyeden onaya gönderilen modüller. Yayınladığın modül uygulamada hemen görünür."
    : "Atölyede yazıp onaya gönderdiğin modüller. Admin onaylayınca uygulamada görünür.";
  let moduller;
  try { moduller = await yApi("/api/moduller?durum=hepsi"); }
  catch (h) { $("#liste").replaceChildren(el("li", { className: "aciklama", textContent: h.message })); return; }
  const sayilar = Object.fromEntries(Object.keys(DURUM_ADI).map((d) => [d, moduller.filter((m) => m.durum === d).length]));
  $("#modul-suzgec").replaceChildren(...[["hepsi", `Hepsi (${moduller.length})`], ...Object.entries(DURUM_ADI).map(([d, a]) => [d, `${a} (${sayilar[d]})`])].map(([d, a]) => {
    const b = el("button", { className: `cip-d${modulSuzgeci === d ? " secili" : ""}`, textContent: a, type: "button" });
    b.setAttribute("aria-pressed", String(modulSuzgeci === d));
    b.addEventListener("click", () => { modulSuzgeci = d; modulleriListele(); });
    return b;
  }));
  const liste = moduller.filter((m) => modulSuzgeci === "hepsi" || m.durum === modulSuzgeci)
    .sort((a, b) => (a.durum === "bekliyor" ? -1 : 0) - (b.durum === "bekliyor" ? -1 : 0) || String(b.guncelleme).localeCompare(String(a.guncelleme)));
  if (!liste.length) {
    $("#liste").replaceChildren(el("li", { className: "aciklama", textContent: moduller.length ? "Bu durumda modül yok." : "Henüz modül yok. Atölyede kalfaya bir fikir anlat, modülü onaya gönder." }));
    return;
  }
  $("#liste").replaceChildren(...liste.map((m) => {
    const karo = el("span", { className: "mini-karo", ariaHidden: "true" });
    karo.style.backgroundImage = ciniArkaPlan(m.id, m.renk);
    const eylemler = el("div", { className: "modul-eylemler" }, ...(EYLEMLER[m.durum] ?? []).filter(([, eylem]) => eylem === "ac" || yoneticiMi()).map(([etiket, eylem, sinif]) => {
      const b = el("button", { className: sinif, type: "button", textContent: etiket });
      b.addEventListener("click", async () => {
        if (eylem === "sil" && !b.dataset.emin) { b.dataset.emin = "1"; b.textContent = "Emin misin? Kalıcı sil"; setTimeout(() => { delete b.dataset.emin; b.textContent = etiket; }, 4000); return; }
        b.disabled = true;
        try {
          if (eylem === "ac") return await atolyedeAc(m);
          if (eylem === "sil") await yApi(`/api/moduller/${encodeURIComponent(m.id)}`, { method: "DELETE" });
          else await yApi(`/api/moduller/${encodeURIComponent(m.id)}/durum`, { method: "POST", govde: { durum: eylem } });
          modulleriListele(); sayaclariGuncelle();
        } catch (h) { alert(h.message); b.disabled = false; }
      });
      return b;
    }));
    return el("li", { className: "modul-ogesi" },
      karo,
      el("div", { className: "modul-bilgi" },
        el("span", { className: "ad", textContent: m.ad }),
        el("span", { className: "alt", textContent: `${m.id} · ${tarihYaz(m.guncelleme)}${m.aciklama ? ` · ${m.aciklama}` : ""}` }),
        el("span", { className: `kaynak-etiket${m.kaynak?.tur === "kalfa" && !m.kaynak.sahte ? " kalfa" : ""}`, textContent: kaynakMetni(m.kaynak),
          title: m.kaynak?.uretim ? `Kalfa üretimi: ${tarihYaz(m.kaynak.uretim)}` : "" })),
      el("span", { className: `etiket ${m.durum}`, textContent: DURUM_ADI[m.durum] ?? m.durum }),
      (eylemler.prepend(...paylasimDugmeleri(m)), eylemler));
  }));
}

const SURUM_ANAHTARI = "lonca.studio.surumler";
const editorHali = () => ({ kod: $("#kod").value, ad: $("#ad").value, id: $("#id").value, aciklama: $("#aciklama").value,
  renk: $("#renk").value, ikon: $("#ikon").value, kategori: $("#kategori").value });
function surumleriOku() { try { return JSON.parse(localStorage.getItem(SURUM_ANAHTARI) ?? "[]"); } catch { return []; } }
function surumSakla(neden) {
  const hal = editorHali();
  if (!hal.kod.trim()) return;
  const liste = surumleriOku();
  if (liste[0]?.kod === hal.kod) return;
  liste.unshift({ ...hal, neden, zaman: Date.now() });
  try { localStorage.setItem(SURUM_ANAHTARI, JSON.stringify(liste.slice(0, 20))); } catch {}
  surumleriCiz();
}
function surumleriCiz() {
  const liste = surumleriOku(), sec = $("#surumler");
  sec.hidden = !liste.length;
  sec.replaceChildren(el("option", { value: "", textContent: `↶ Önceki sürümler (${liste.length})` }),
    ...liste.map((s, i) => el("option", { value: String(i),
      textContent: `${new Date(s.zaman).toLocaleTimeString(yerelDil(), { hour: "2-digit", minute: "2-digit" })} · ${s.ad || s.id || "adsız"} · ${s.neden} · ${s.kod.split("\n").length} satır` })));
}
$("#surumler").addEventListener("change", (e) => {
  const s = surumleriOku()[Number(e.target.value)];
  e.target.value = "";
  if (!s) return;
  akisNo++;
  surumSakla("geri yüklemeden önce");
  $("#kod").value = s.kod; $("#ad").value = s.ad; $("#id").value = s.id; $("#aciklama").value = s.aciklama;
  $("#renk").value = s.renk; $("#ikon").value = s.ikon; $("#kategori").value = s.kategori;
  editoruGuncelle();
  taslakDegisti();
  durumYaz("iyi", `Önceki sürüm geri yüklendi: ${s.ad || s.id} (${s.neden}).`);
  onizle();
});
surumleriCiz();

async function atolyedeAc(m) {
  const kod = await yApi(`/api/moduller/${encodeURIComponent(m.id)}/kod`);
  surumSakla(`“${m.ad}” açılmadan önce`);
  sayfaAc("atolye");
  $("#kod").value = kod; $("#ad").value = m.ad; $("#id").value = m.id; $("#aciklama").value = m.aciklama ?? "";
  $("#renk").value = m.renk ?? ""; $("#ikon").value = m.ikon ?? ""; $("#kategori").value = m.kategori ?? "";
  $("#gorunurluk").value = m.durum === "ozel" ? "ozel" : "herkes"; gonderDugmesiniYaz();
  editoruGuncelle();
  taslakDegisti();
  durumYaz("iyi", `“${m.ad}” atölyede açıldı (${DURUM_ADI[m.durum]}). Değiştirip yeniden onaya gönderebilirsin.`);
  onizle();
}

const TURLER = ["cami", "mescit", "medrese", "han", "hamam", "cesme", "turbe", "kulliye", "imaret", "kopru", "tekke", "hazire", "carsi", "kutuphane", "sivil", "diger"];
const TUR_ADI = { cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe", kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı", kutuphane: "Kütüphane", sivil: "Sivil mimari", diger: "Diğer" };
$("#eser-formu").elements.tur.replaceChildren(...TURLER.map((t) => el("option", { value: t, textContent: TUR_ADI[t] })));
let tumEserler = [], seciliEser = null, formFotolari = [], formOneri = null;

const ALAN_ADLARI = { ad: "Ad", tur: "Tür", il: "İl", ilce: "İlçe", yuzyil: "Yüzyıl", konum: "Konum (enlem/boylam)", adres: "Adres", tarihce: "Tarihçe", fotograf: "Fotoğraf", ad_en: "İngilizce ad", tarihce_en: "İngilizce tarihçe" };
const tamlikDurumu = { hazir: "", alanlar: {} }; // hazir: "" | "tam" | "eksik:alan"
let tamlikOzeti = null, temelAlanlar = [];

function tamlikSorgusu() {
  const q = new URLSearchParams();
  if (tamlikDurumu.hazir === "tam") q.set("tam", "1");
  else if (tamlikDurumu.hazir.startsWith("eksik:")) q.set("eksik", tamlikDurumu.hazir.slice(6));
  const gerekli = Object.entries(tamlikDurumu.alanlar).filter(([, d]) => d === "var").map(([a]) => a);
  const olmayan = Object.entries(tamlikDurumu.alanlar).filter(([, d]) => d === "yok").map(([a]) => a);
  if (gerekli.length) q.set("gerekli", gerekli.join(","));
  if (olmayan.length) q.set("olmayan", olmayan.join(","));
  return q;
}

function tamlikCiz() {
  const o = tamlikOzeti;
  if (!o) return;
  const yuzde = Math.round((o.tam / Math.max(1, o.toplam)) * 100);
  const hazirlar = [["", `Hepsi (${o.toplam})`], ["tam", `Bilgisi tam (${o.tam})`],
    ...Object.entries(o.tekEksik).sort((a, b) => b[1] - a[1]).map(([a, n]) => [`eksik:${a}`, `Yalnızca ${ALAN_ADLARI[a].toLocaleLowerCase("tr")} eksik (${n})`])];
  const hazir = el("div", { className: "tamlik-hazir", role: "group", ariaLabel: "Hazır süzgeçler" }, ...hazirlar.map(([d, ad]) => {
    const b = el("button", { type: "button", className: `cip-d${tamlikDurumu.hazir === d ? " secili" : ""}`, textContent: ad });
    b.setAttribute("aria-pressed", String(tamlikDurumu.hazir === d));
    b.addEventListener("click", () => { tamlikDurumu.hazir = d; eserleriSuz(); });
    return b;
  }));
  const alanlar = el("div", { className: "alan-suzgec", role: "group", ariaLabel: "Alanlara göre süz: her tıklama fark etmez → var → yok" },
    ...Object.entries(o.alanlar).map(([a, { var: v }]) => {
      const durum = tamlikDurumu.alanlar[a] ?? "";
      const b = el("button", { type: "button", className: "alan", title: "Fark etmez → var → yok" },
        el("b", { textContent: ALAN_ADLARI[a] ?? a }),
        el("span", { className: "durum-isaret", textContent: durum === "var" ? "✓ var" : durum === "yok" ? "✗ yok" : "· ·" }),
        el("small", { textContent: `${v}/${o.toplam} eserde var${temelAlanlar.includes(a) ? "" : " · ek alan"}` }),
        el("span", { className: "alan-cubuk" }, Object.assign(el("span"), { style: `width:${(v / o.toplam) * 100}%` })));
      b.dataset.durum = durum;
      b.setAttribute("aria-label", `${ALAN_ADLARI[a]}: ${durum === "var" ? "bilinenler" : durum === "yok" ? "bilinmeyenler" : "fark etmez"}`);
      b.addEventListener("click", () => {
        tamlikDurumu.alanlar[a] = durum === "" ? "var" : durum === "var" ? "yok" : "";
        if (!tamlikDurumu.alanlar[a]) delete tamlikDurumu.alanlar[a];
        eserleriSuz();
      });
      return b;
    }));
  const temizle = el("button", { type: "button", textContent: "süzgeçleri temizle" });
  temizle.addEventListener("click", () => { tamlikDurumu.hazir = ""; tamlikDurumu.alanlar = {}; eserleriSuz(); });
  $("#tamlik").replaceChildren(
    el("div", { className: "tamlik-ust" },
      el("span", { className: "tamlik-sayi", innerHTML: `${o.tam}<small>/ ${o.toplam} eserin bilgisi tam · %${yuzde}</small>` }),
      el("span", { className: "tamlik-cubuk", role: "img", ariaLabel: `Yüzde ${yuzde} tam` }, Object.assign(el("span"), { style: `width:${yuzde}%` }))),
    hazir, alanlar,
    el("div", { className: "sonuc-satiri" }, el("span", { id: "suz-sonuc", textContent: "" }), temizle));
}

async function eserleriSuz() {
  tamlikCiz();
  tumEserler = await (await fetch(`/api/eserler?${tamlikSorgusu()}`)).json();
  eserListesiniCiz();
}

async function icerikYukle() {
  [tamlikOzeti] = await Promise.all([fetch("/api/eserler-tamlik").then((y) => y.json())]);
  temelAlanlar = tamlikOzeti.temelAlanlar ?? [];
  await eserleriSuz();
  await onerileriCiz();
  await gecmisiCiz();
}

const ALAN_VAR = {
  ad: (e) => !!e.ad, tur: (e) => !!e.tur, il: (e) => !!e.il, ilce: (e) => !!e.ilce, yuzyil: (e) => Number.isInteger(e.yuzyil),
  konum: (e) => Number.isFinite(e.konum?.lat), adres: (e) => !!e.adres?.trim?.(), tarihce: (e) => !!e.tarihce?.tr,
};
function eserListesiniCiz() {
  const kelime = $("#eser-ara").value.trim().toLocaleLowerCase("tr");
  const liste = tumEserler.filter((e) => !kelime || e.ad.toLocaleLowerCase("tr").includes(kelime));
  const sonuc = $("#suz-sonuc");
  if (sonuc) sonuc.textContent = `${liste.length} eser listeleniyor`;
  $("#eser-listesi").replaceChildren(...liste.slice(0, 400).map((e) => {
    const eksik = Object.entries(ALAN_VAR).filter(([, f]) => !f(e)).map(([a]) => ALAN_ADLARI[a]);
    const noktalar = el("span", { className: "noktalar", role: "img", ariaLabel: eksik.length ? `Eksik: ${eksik.join(", ")}` : "Bilgisi tam" },
      ...Object.values(ALAN_VAR).map((f) => el("i", { className: f(e) ? "var" : "" })));
    noktalar.title = eksik.length ? `Eksik: ${eksik.join(", ")}` : "Bilgisi tam";
    const b = el("button", { type: "button", className: `eser-satir${seciliEser?.id === e.id ? " secili" : ""}` },
      e.fotograflar?.[0] ? el("img", { src: e.fotograflar[0], alt: "", loading: "lazy" }) : el("span", { className: "foto-yok", textContent: "—" }),
      el("span", {}, el("strong", { textContent: e.ad }),
        el("small", { textContent: [TUR_ADI[e.tur], e.yuzyil ? `${e.yuzyil}. yy` : null, `${e.fotograflar?.length ?? 0} foto`].filter(Boolean).join(" · ") }),
        noktalar));
    b.addEventListener("click", () => formuAc(e));
    return el("li", {}, b);
  }));
}
$("#eser-ara").addEventListener("input", eserListesiniCiz);

let formIlkHali = "";
const formAnahtari = () => { const v = formVerisi(); delete v.fotograflar; return JSON.stringify(v); };
const formKirli = () => !$("#eser-formu").hidden && formAnahtari() !== formIlkHali;
// Yönetici olmayan uzman (ya da "Onaya gönder" diyen yönetici) değişikliği öneri olarak yollar; yayın editör onayıyla olur.
const onayaGiderMi = () => !formOneri && !yoneticiMi();
const fotoAnindaMi = () => !!seciliEser && !formOneri && yoneticiMi();
let formIlkVeri = {};

function kirliIsaretiniGuncelle() {
  const k = formKirli();
  $("#kirli").hidden = !k;
  $("#eser-formu").classList.toggle("kirli", k);
}
$("#eser-formu").addEventListener("input", kirliIsaretiniGuncelle);
$("#eser-formu").addEventListener("change", kirliIsaretiniGuncelle);

async function ayrilabilirMi() {
  if (!formKirli()) return true;
  const d = $("#kaydedilmedi");
  d.showModal();
  const cevap = await new Promise((coz) => d.addEventListener("close", () => coz(d.returnValue), { once: true }));
  if (cevap === "kaydet") return await formuKaydet();
  return cevap === "at";
}
window.addEventListener("beforeunload", (e) => { if (formKirli()) e.preventDefault(); });

async function formuAc(eser, { oneri = null, onerilenVeri = null, sorma = false } = {}) {
  if (!sorma && !(await ayrilabilirMi())) return;
  seciliEser = eser; formOneri = oneri;
  const f = $("#eser-formu"), v = { ...(eser ?? {}), ...(onerilenVeri ?? {}) };
  // Usta eseri yalnızca görür: alanlar kilitli, kaydet/sil/fotoğraf düğmeleri .yalniz-admin ile gizli.
  const saltOkunur = !yoneticiMi();
  for (const a of f.querySelectorAll("input, select, textarea")) a.disabled = saltOkunur;
  $("#form-baslik").textContent = saltOkunur ? "Eser bilgisi" : oneri ? "Öneriyi incele ve onayla" : eser ? "Eseri düzenle" : "Yeni eser";
  f.elements.ad.value = v.ad ?? ""; f.elements.ad_en.value = v.ad_en ?? ""; f.elements.tur.value = v.tur ?? "cami";
  f.elements.il.value = v.il ?? "Bursa"; f.elements.ilce.value = v.ilce ?? ""; f.elements.yuzyil.value = v.yuzyil ?? "";
  f.elements.lat.value = v.konum?.lat ?? ""; f.elements.lng.value = v.konum?.lng ?? ""; f.elements.yaklasik.checked = !!v.konum?.yaklasik;
  f.elements.adres.value = v.adres ?? ""; f.elements.tarihce_tr.value = v.tarihce?.tr ?? ""; f.elements.tarihce_en.value = v.tarihce?.en ?? "";
  f.elements.kaynak.value = v.kaynak ?? "";
  formFotolari = [...(v.fotograflar ?? [])];
  fotolariCiz();
  const eksik = { ad: !v.ad, tur: !v.tur, il: !v.il, ilce: !v.ilce, yuzyil: !Number.isInteger(v.yuzyil), lat: !v.konum, lng: !v.konum, adres: !v.adres, tarihce_tr: !v.tarihce?.tr };
  for (const [ad, yok] of Object.entries(eksik)) f.elements[ad]?.closest("label")?.classList.toggle("eksik-alan", !!eser && yok);
  $("#eser-sil").hidden = !eser || !!oneri || !yoneticiMi();
  $("#eser-gecmisi-ac").hidden = !eser || !!oneri || !yoneticiMi();
  $("#eser-onaya").hidden = !!oneri || onayaGiderMi();
  oneriKutusunuAc(!saltOkunur && onayaGiderMi());
  f.elements.oneri_kaynak.value = ""; f.elements.oneri_not.value = "";
  $("#foto-ipucu").textContent = fotoAnindaMi() ? "değişiklikler hemen kaydedilir · ilk fotoğraf kapaktır" : "ilk fotoğraf kapak olur · kaydedince yayına girer";
  f.querySelector("[type=submit]").textContent = oneri ? "Onayla ve yayınla" : onayaGiderMi() ? "Onaya gönder" : "Kaydet ve yayınla";
  const kimden = [oneri?.oneren && `Öneren: ${oneri.oneren}`, oneri?.kaynak && `eklenen bilginin kaynağı: ${oneri.kaynak}`].filter(Boolean).join(" · ");
  durumYaz("", saltOkunur ? "Eserleri yalnızca admin hesapları düzenleyebilir." : kimden, [], "#eser-durum");
  f.hidden = false; $("#eser-bos").hidden = true;
  formIlkHali = formAnahtari();
  formIlkVeri = formVerisi();
  kirliIsaretiniGuncelle();
  eserListesiniCiz();
  f.elements.ad.focus({ preventScroll: true });
}
function oneriKutusunuAc(acik) {
  const k = $("#oneri-kutusu");
  k.hidden = !acik; k.disabled = !acik;
}
// Atölye önizlemesindeki "Bu eserde eksik var, düzenle" bağlantısı eseri İçerik sayfasında açar.
async function eserDuzenlemeyeAc(id) {
  if (!(await ayrilabilirMi())) return;
  sayfaAc("icerik");
  let eser = tumEserler.find((x) => x.id === id);
  if (!eser) { try { const y = await fetch(`/api/eserler/${encodeURIComponent(id)}`); if (y.ok) eser = await y.json(); } catch {} }
  if (!eser?.id) return durumYaz("kotu", "Önizlemedeki eser bulunamadı.");
  await formuAc(eser, { sorma: true });
  if (!yoneticiMi()) return;
  durumYaz("", onayaGiderMi() ? "Eksik bilgiyi ekle, kaynağını yaz ve onaya gönder." : "Eksik bilgiyi ekle; yayınlamadan önce bir uzman görüşü istersen “Onaya gönder”i kullan.", [], "#eser-durum");
}
async function onayaGonder() {
  const f = $("#eser-formu");
  if ($("#oneri-kutusu").hidden) {
    oneriKutusunuAc(true);
    f.elements.oneri_kaynak.focus();
    durumYaz("", "Eklediğin bilginin kaynağını yaz, sonra yeniden “Onaya gönder”e bas.", [], "#eser-durum");
    return false;
  }
  if (!f.reportValidity()) return false;
  const veri = formVerisi();
  const ek = { kaynak: f.elements.oneri_kaynak.value.trim(), oneren: f.elements.oneri_oneren.value.trim(), not: f.elements.oneri_not.value.trim() };
  let govde;
  if (seciliEser) {
    const fark = Object.fromEntries(Object.entries(veri).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(formIlkVeri[k])));
    if (!Object.keys(fark).length) { durumYaz("kotu", "Değişiklik yok: önce eksik bilgiyi forma ekle.", [], "#eser-durum"); return false; }
    govde = { tur: "duzenle", eserId: seciliEser.id, veri: fark, ...ek };
  } else govde = { tur: "yeni", veri, ...ek };
  try {
    await yApi("/api/eser-oneriler", { method: "POST", govde, yeniden: false });
    formIlkHali = formAnahtari(); formIlkVeri = veri;
    kirliIsaretiniGuncelle();
    f.elements.oneri_not.value = "";
    if (!onayaGiderMi()) oneriKutusunuAc(false);
    durumYaz("iyi", "Önerin editör onayına gönderildi. Onaylanınca uygulamada yayına girer.", [], "#eser-durum");
    if (yoneticiMi()) { onerileriCiz(); sayaclariGuncelle(); }
    return true;
  } catch (h) { durumYaz("kotu", h.message, h.ayrintilar, "#eser-durum"); return false; }
}
$("#eser-onaya").addEventListener("click", onayaGonder);
$("#yeni-eser").addEventListener("click", () => formuAc(null));
$("#eser-vazgec").addEventListener("click", async () => {
  if (!(await ayrilabilirMi())) return;
  $("#eser-formu").hidden = true; $("#eser-bos").hidden = false; seciliEser = null; formOneri = null; eserListesiniCiz();
});

async function fotoGoster(img, yol) {
  if (!yol.startsWith("/medya/yuklenen/")) { img.src = yol; return; }
  try { const y = await fetch(yol, { headers: { "x-yonetici-sifre": sifreOku(), ...hesapBasligi() } }); if (y.ok) img.src = URL.createObjectURL(await y.blob()); } catch {}
}

async function fotolariDegistir(yeni, neden) {
  const onceki = formFotolari.slice();
  formFotolari = yeni;
  fotolariCiz();
  if (!fotoAnindaMi()) return;
  const id = seciliEser.id;
  try {
    const kayit = await yApi(`/api/eserler/${encodeURIComponent(id)}`, { method: "PUT", govde: { fotograflar: yeni }, basliklar: { "x-degisiklik": encodeURIComponent(neden) } });
    eserGuncellendi(kayit);
    bildirim(`${seciliEser?.ad ?? "Eser"}: ${neden}`, async () => {
      const geri = await yApi(`/api/eserler/${encodeURIComponent(id)}`, { method: "PUT", govde: { fotograflar: onceki }, basliklar: { "x-degisiklik": encodeURIComponent(`Geri alındı: ${neden}`) } });
      eserGuncellendi(geri);
      if (seciliEser?.id === id) { formFotolari = [...geri.fotograflar]; fotolariCiz(); }
    });
  } catch (h) {
    formFotolari = onceki; fotolariCiz();
    durumYaz("kotu", `Kaydedilemedi: ${h.message}`, h.ayrintilar, "#eser-durum");
  }
}
function eserGuncellendi(kayit) {
  if (!kayit) return;
  const i = tumEserler.findIndex((e) => e.id === kayit.id);
  if (i >= 0) tumEserler[i] = kayit;
  if (seciliEser?.id === kayit.id) seciliEser = kayit;
  eserListesiniCiz();
  gecmisiCiz();
}

function fotolariCiz() {
  $("#foto-sayi").textContent = formFotolari.length ? `(${formFotolari.length})` : "";
  $("#foto-listesi").replaceChildren(...formFotolari.map((yol, i) => {
    const img = el("img", { alt: `Fotoğraf ${i + 1}${i === 0 ? " (kapak)" : ""}`, draggable: false });
    fotoGoster(img, yol);
    const tus = (metin, etiket, sinif, f, kapali = false) => {
      const b = el("button", { type: "button", className: `${sinif} yalniz-admin`, textContent: metin, ariaLabel: etiket, title: etiket, disabled: kapali });
      b.addEventListener("click", f); return b;
    };
    const tasi = (j, neden) => { const yeni = formFotolari.slice(); const [x] = yeni.splice(i, 1); yeni.splice(j, 0, x); fotolariDegistir(yeni, neden); };
    const n = formFotolari.length;
    return el("li", { className: i === 0 ? "kapak" : "" }, img,
      i === 0 ? el("span", { className: "kapak-rozet", textContent: "KAPAK" }) : null,
      tus("×", `Fotoğraf ${i + 1}'i kaldır`, "kaldir", () => fotolariDegistir(formFotolari.filter((_, j) => j !== i), `Fotoğraf ${i + 1} kaldırıldı`)),
      el("div", { className: "foto-eylemler" },
        tus("←", "Öne al", "", () => tasi(i - 1, "Fotoğraf sırası değişti"), i === 0),
        tus("★ Kapak", "Kapak yap", "kapak-yap", () => tasi(0, "Kapak fotoğrafı değişti"), i === 0),
        tus("→", "Geriye al", "", () => tasi(i + 1, "Fotoğraf sırası değişti"), i === n - 1)));
  }));
}
async function fotograflariYukle(dosyalar) {
  const liste = [...dosyalar].filter((d) => /^image\/(jpeg|png|webp)$/.test(d.type));
  if (!liste.length) return;
  const eklenen = [];
  for (const dosya of liste) {
    if (formFotolari.length + eklenen.length >= 12) { durumYaz("kotu", "Bir eserde en fazla 12 fotoğraf olabilir.", [], "#eser-durum"); break; }
    if (dosya.size > 6 * 1024 * 1024) { durumYaz("kotu", `${dosya.name}: en fazla 6 MB olabilir.`, [], "#eser-durum"); continue; }
    durumYaz("", `Yükleniyor ${eklenen.length + 1}/${liste.length}…`, [], "#eser-durum");
    const dataUrl = await new Promise((coz, reddet) => { const r = new FileReader(); r.onload = () => coz(r.result); r.onerror = reddet; r.readAsDataURL(dosya); });
    try { eklenen.push((await yApi("/api/medya", { method: "POST", govde: { dosya: dataUrl } })).yol); }
    catch (h) { durumYaz("kotu", h.message, h.ayrintilar, "#eser-durum"); break; }
  }
  if (!eklenen.length) return;
  await fotolariDegistir([...formFotolari, ...eklenen], `${eklenen.length} fotoğraf eklendi`);
  durumYaz("iyi", fotoAnindaMi() ? `${eklenen.length} fotoğraf eklendi ve kaydedildi.` : `${eklenen.length} fotoğraf eklendi. Kaydetmeyi unutma.`, [], "#eser-durum");
}
$("#foto-sec").addEventListener("change", (e) => { const d = [...(e.target.files ?? [])]; e.target.value = ""; fotograflariYukle(d); });
const birak = $("#foto-birak");
for (const olay of ["dragenter", "dragover"]) birak.addEventListener(olay, (e) => { e.preventDefault(); birak.classList.add("ustunde"); });
for (const olay of ["dragleave", "drop"]) birak.addEventListener(olay, () => birak.classList.remove("ustunde"));
birak.addEventListener("drop", (e) => { e.preventDefault(); fotograflariYukle(e.dataTransfer?.files ?? []); });

function formVerisi() {
  const f = $("#eser-formu").elements;
  const lat = f.lat.value.trim(), lng = f.lng.value.trim();
  return {
    ad: f.ad.value, ad_en: f.ad_en.value, tur: f.tur.value, il: f.il.value, ilce: f.ilce.value,
    yuzyil: f.yuzyil.value === "" ? null : Number(f.yuzyil.value),
    konum: lat && lng ? { lat: Number(lat), lng: Number(lng), yaklasik: f.yaklasik.checked } : null,
    adres: f.adres.value, tarihce: { tr: f.tarihce_tr.value, en: f.tarihce_en.value }, kaynak: f.kaynak.value,
    fotograflar: formFotolari,
  };
}
async function formuKaydet() {
  const f = $("#eser-formu");
  if (onayaGiderMi()) return onayaGonder();
  if (!f.reportValidity()) return false;
  const veri = formVerisi();
  try {
    let kayit;
    if (formOneri) kayit = (await yApi(`/api/eser-oneriler/${formOneri.id}/karar`, { method: "POST", govde: { karar: "onayla", veri } })).eser;
    else if (seciliEser) kayit = await yApi(`/api/eserler/${encodeURIComponent(seciliEser.id)}`, { method: "PUT", govde: veri });
    else kayit = await yApi("/api/eserler", { method: "POST", govde: veri });
    formIlkHali = formAnahtari();
    await icerikYukle();
    await formuAc(kayit ?? null, { sorma: true });
    durumYaz("iyi", "Kaydedildi; uygulamada hemen görünür. Geçmişten geri alınabilir.", [], "#eser-durum");
    sayaclariGuncelle();
    return true;
  } catch (h) { durumYaz("kotu", h.message, h.ayrintilar, "#eser-durum"); return false; }
}
$("#eser-formu").addEventListener("submit", (e) => { e.preventDefault(); formuKaydet(); });
$("#eser-sil").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (!seciliEser) return;
  if (!b.dataset.emin) { b.dataset.emin = "1"; b.textContent = "Emin misin? Sil"; setTimeout(() => { delete b.dataset.emin; b.textContent = "Sil"; }, 4000); return; }
  try {
    const silinen = seciliEser;
    const { gecmis } = await yApi(`/api/eserler/${encodeURIComponent(silinen.id)}`, { method: "DELETE" });
    formIlkHali = formAnahtari();
    seciliEser = null; $("#eser-formu").hidden = true; $("#eser-bos").hidden = false;
    await icerikYukle();
    bildirim(`“${silinen.ad}” silindi`, async () => { await yApi(`/api/eser-gecmisi/${gecmis}/geri-al`, { method: "POST" }); await icerikYukle(); });
  } catch (h) { durumYaz("kotu", h.message, [], "#eser-durum"); }
});

function bildirim(metin, geriAl) {
  const kutu = $("#bildirimler");
  const geriB = el("button", { type: "button", textContent: "Geri al" });
  const kapatB = el("button", { type: "button", className: "kapat", textContent: "×", ariaLabel: "Kapat" });
  const b = el("div", { className: "bildirim", role: "status" }, el("span", { textContent: metin }), geriAl ? geriB : null, kapatB);
  const kaldir = () => b.remove();
  const sure = setTimeout(kaldir, 10000);
  kapatB.addEventListener("click", () => { clearTimeout(sure); kaldir(); });
  geriB.addEventListener("click", async () => {
    clearTimeout(sure); geriB.disabled = true;
    try { await geriAl(); b.firstChild.textContent = "Geri alındı"; setTimeout(kaldir, 1800); gecmisiCiz(); }
    catch (h) { b.firstChild.textContent = `Geri alınamadı: ${h.message}`; }
  });
  kutu.append(b);
  while (kutu.children.length > 3) kutu.firstChild.remove();
}

const ISLEM_ADI = { ekle: "eklendi", duzenle: "düzenlendi", sil: "silindi", "geri-al": "geri alındı", "ice-aktar": "içe aktarma" };
let gecmisSuzgeci = false;
async function gecmisiCiz() {
  const liste = $("#gecmis-listesi");
  if (!liste) return;
  let kayitlar;
  try { kayitlar = await yApi(`/api/eser-gecmisi${gecmisSuzgeci && seciliEser ? `?eser=${encodeURIComponent(seciliEser.id)}` : ""}`, { yeniden: false }); }
  catch (h) { liste.replaceChildren(el("li", { className: "aciklama", textContent: h.message })); return; }
  if (!kayitlar.length) { liste.replaceChildren(el("li", { className: "aciklama", textContent: "Henüz değişiklik yok." })); return; }
  liste.replaceChildren(...kayitlar.slice(0, 40).map((g) => {
    const saat = new Date(g.zaman).toLocaleString(yerelDil(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const ayrinti = g.neden ?? (g.ozet?.length ? (g.islem === "ice-aktar" ? g.ozet.join(", ") : `${g.ozet.map((a) => ALAN_ADI[a] ?? a).join(", ")} değişti`) : "");
    const geriB = el("button", { type: "button", className: "kucuk-d ikincil yalniz-admin", textContent: g.geriAlindi ? "geri alındı" : "Geri al", disabled: g.geriAlindi });
    geriB.addEventListener("click", async () => {
      if (!(await ayrilabilirMi())) return;
      geriB.disabled = true;
      try {
        const r = await yApi(`/api/eser-gecmisi/${g.id}/geri-al`, { method: "POST" });
        await icerikYukle();
        if (seciliEser && seciliEser.id === g.eserId) await formuAc(r.eser ?? null, { sorma: true });
        bildirim(`Geri alındı: ${g.ad}`, async () => { await yApi(`/api/eser-gecmisi/${r.gecmis}/geri-al`, { method: "POST" }); await icerikYukle(); });
      } catch (h) { geriB.disabled = false; durumYaz("kotu", h.message, [], "#eser-durum"); }
    });
    const adB = el("button", { type: "button", className: "gecmis-ad", textContent: g.ad ?? "—" });
    adB.addEventListener("click", () => { const e = tumEserler.find((x) => x.id === g.eserId); if (e) formuAc(e); });
    return el("li", { className: `gecmis-ogesi islem-${g.islem}` },
      el("div", {}, el("span", { className: "gecmis-islem", textContent: ISLEM_ADI[g.islem] ?? g.islem }), el("time", { textContent: saat })),
      adB, ayrinti ? el("small", { textContent: ayrinti }) : null, geriB);
  }));
}
$("#gecmis-suz")?.addEventListener("change", (e) => { gecmisSuzgeci = e.target.checked; gecmisiCiz(); });
$("#eser-gecmisi-ac").addEventListener("click", () => { gecmisSuzgeci = true; $("#gecmis-suz").checked = true; gecmisiCiz(); $("#gecmis-baslik").scrollIntoView({ behavior: "smooth" }); });

$("#disa-aktar").addEventListener("click", async () => {
  try {
    const veri = await yApi("/api/eserler-disa-aktar");
    const url = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 1)], { type: "application/json" }));
    const a = el("a", { href: url, download: `lonca-eserler-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    durumYaz("iyi", `${veri.eserler.length} eser dışa aktarıldı.`, [], "#aktar-durum");
  } catch (h) { durumYaz("kotu", h.message, [], "#aktar-durum"); }
});
let iceAktarilacak = null;
$("#ice-aktar").addEventListener("click", () => $("#ice-dosya").click());
$("#ice-dosya").addEventListener("change", async (e) => {
  const dosya = e.target.files?.[0]; e.target.value = "";
  if (!dosya) return;
  try {
    const veri = JSON.parse(await dosya.text());
    const liste = Array.isArray(veri) ? veri : veri?.eserler;
    if (!Array.isArray(liste) || !liste.length) throw new Error("Dosyada eser listesi bulunamadı");
    const mevcut = new Set((await (await fetch("/api/eserler")).json()).map((x) => x.id));
    const eslesen = liste.filter((x) => mevcut.has(x?.id)).length;
    iceAktarilacak = liste;
    $("#ice-ozet").textContent = `${dosya.name}: ${liste.length} eser. ${eslesen} tanesi mevcut eserlerle aynı kimlikte (güncellenir), ${liste.length - eslesen} tanesi yeni.`;
    $("#ice-aktar-pencere").showModal();
  } catch (h) { durumYaz("kotu", `Dosya okunamadı: ${h.message}`, [], "#aktar-durum"); }
});
$("#ice-aktar-pencere").addEventListener("close", async () => {
  const kip = $("#ice-aktar-pencere").returnValue;
  if (!iceAktarilacak || !["birlestir", "degistir"].includes(kip)) { iceAktarilacak = null; return; }
  try {
    const r = await yApi("/api/eserler-ice-aktar", { method: "POST", govde: { kip, eserler: iceAktarilacak } });
    await icerikYukle();
    durumYaz("iyi", `İçe aktarıldı: ${r.eklenen} eklendi, ${r.guncellenen} güncellendi${r.silinen ? `, ${r.silinen} silindi` : ""}.`, [], "#aktar-durum");
    bildirim("İçe aktarma tamamlandı", async () => { await yApi(`/api/eser-gecmisi/${r.gecmis}/geri-al`, { method: "POST" }); await icerikYukle(); });
  } catch (h) { durumYaz("kotu", h.message, h.ayrintilar, "#aktar-durum"); }
  iceAktarilacak = null;
});

const ALAN_ADI = { ad: "Ad", ad_en: "İngilizce ad", tur: "Tür", il: "İl", ilce: "İlçe", yuzyil: "Yüzyıl", konum: "Konum", adres: "Adres", tarihce: "Tarihçe", kaynak: "Kaynak", fotograflar: "Fotoğraflar" };
const kisa = (x) => { const s = typeof x === "object" && x ? (x.tr ?? (x.lat != null ? `${x.lat}, ${x.lng}` : Array.isArray(x) ? `${x.length} fotoğraf` : JSON.stringify(x))) : String(x ?? "—"); return s.length > 140 ? s.slice(0, 140) + "…" : s; };

async function onerileriCiz() {
  let oneriler;
  try { oneriler = await yApi("/api/eser-oneriler", { yeniden: yoneticiMi() }); }
  catch (h) { $("#oneriler-listesi").replaceChildren(el("li", { className: "aciklama", textContent: h.message })); return; }
  if (!oneriler.length) { $("#oneriler-listesi").replaceChildren(el("li", { className: "aciklama", textContent: "Bekleyen öneri yok." })); return; }
  $("#oneriler-listesi").replaceChildren(...oneriler.map((o) => {
    const baslik = o.tur === "yeni" ? `Yeni eser: ${o.veri?.ad}` : o.tur === "duzenle" ? `Düzenleme: ${o.eser?.ad}` : `Hata bildirimi: ${o.eser?.ad}`;
    const govde = el("div", { className: "oneri-govde" });
    if (o.not) govde.append(el("p", { className: "oneri-not", textContent: `“${o.not}”` }));
    if (o.kaynak || o.oneren) govde.append(el("p", { className: "oneri-kaynak", textContent: [o.oneren && `Öneren: ${o.oneren}`, o.kaynak && `Kaynak: ${o.kaynak}`].filter(Boolean).join(" · ") }));
    if (o.tur === "duzenle" && o.veri) govde.append(el("ul", { className: "fark" }, ...Object.entries(o.veri).map(([k, v]) =>
      el("li", {}, el("b", { textContent: ALAN_ADI[k] ?? k }), el("del", { textContent: kisa(o.eser?.[k]) }), el("ins", { textContent: kisa(v) })))));
    if (o.tur === "yeni" && o.veri) govde.append(el("p", { className: "aciklama", textContent: `${TUR_ADI[o.veri.tur] ?? o.veri.tur} · ${o.veri.ilce ?? ""} · kaynak: ${o.veri.kaynak}` }));
    const incele = el("button", { className: "birincil yalniz-admin", type: "button", textContent: o.tur === "not" ? "Eseri düzenle" : "İncele ve onayla" });
    incele.addEventListener("click", () => formuAc(o.eser ?? null, { oneri: o.tur === "not" ? null : o, onerilenVeri: o.veri }));
    const kapat = el("button", { className: "ikincil yalniz-admin", type: "button", textContent: o.tur === "not" ? "Çözüldü" : "Reddet" });
    kapat.addEventListener("click", async () => {
      kapat.disabled = true;
      try { await yApi(`/api/eser-oneriler/${o.id}/karar`, { method: "POST", govde: { karar: o.tur === "not" ? "onayla" : "reddet" } }); onerileriCiz(); sayaclariGuncelle(); }
      catch (h) { alert(h.message); kapat.disabled = false; }
    });
    return el("li", { className: `oneri ${o.tur}` },
      el("div", { className: "oneri-ust" }, el("strong", { textContent: baslik }), el("small", { textContent: tarihYaz(o.tarih) })),
      govde, el("div", { className: "modul-eylemler" }, incele, kapat));
  }));
}

async function sayaclariGuncelle() {
  const yaz = (secici, n) => { const s = $(secici); s.hidden = !n; s.textContent = String(n); };
  if (yoneticiMi()) try { yaz("#sayac-modul", (await yApi("/api/moduller?durum=hepsi", { yeniden: false })).filter((m) => m.durum === "bekliyor").length); } catch {}
  try { yaz("#sayac-oneri", (await yApi("/api/eser-oneriler", { yeniden: false })).length); } catch {}
}

const saat = () => { $("#saat").textContent = new Date().toLocaleTimeString(yerelDil(), { hour: "2-digit", minute: "2-digit" }); };
saat(); setInterval(saat, 30000);

async function durumCubugu() {
  try {
    const t = tamlikOzeti ?? await (await fetch("/api/eserler-tamlik")).json();
    $("#dc-eser").innerHTML = `eserler: <b>${t.toplam}</b> · tam: <b>${t.tam}</b>`;
    const yayinda = (await (await fetch("/api/moduller")).json()).length;
    $("#dc-modul").innerHTML = `modüller: <b>${yayinda}</b> yayında`;
  } catch {}
}
setInterval(() => { $("#dc-saat").textContent = new Date().toLocaleString(yerelDil(), { weekday: "short", hour: "2-digit", minute: "2-digit" }); }, 1000);
durumCubugu();

function kalfaDurumu() {
  return fetch("/api/kalfa").then((y) => y.json()).then((k) => {
    const dc = $("#dc-kalfa");
    dc.textContent = "kalfa: ";
    dc.append(el("b", { textContent: k.sahte ? "sahte mod" : k.model }));
    $("#model").classList.toggle("sahte", !!k.sahte);
    $("#model").classList.toggle("canli", !k.sahte);
    $("#model-ad").textContent = k.sahte ? "Kalfa: sahte mod (yapay zekâ bağlı değil)" : `Kalfa: ${k.model}`;
  }).catch(() => { $("#model-ad").textContent = "Kalfa: sunucuya ulaşılamadı"; });
}
kalfaDurumu();

// ---------- Kalfa modelleri (UstaGPT) ----------
// Liste ve kayıt sunucudan geçer (/api/kalfa/modeller, /api/kalfa/ayarlar); UstaGPT anahtarı tarayıcıya gelmez.
const MODEL_ALANLARI = {
  kalfaModeli: { tur: "metin", coklu: false, ipucu: "Modül kalfasının fikri koda çevirirken kullandığı dil modeli. Araç çağırabilen (tool calling) bir model seç." },
  dalisMetinModelleri: { tur: "metin", coklu: true, ipucu: "Dalış planı ve fotoğraf tanıma için. Sırayla denenir: ilki yanıt vermezse ikincisine geçilir (en çok 5)." },
  dalisGorselModelleri: { tur: "gorsel", coklu: true, ipucu: "Dalış karelerini üreten görsel modeller. Sırayla denenir (en çok 5). \"sohbet:\" önekliler sohbet üzerinden görsel üretir." },
};
const modelDurumu = { modeller: [], secili: null, taslak: {}, alan: "kalfaModeli", yukleniyor: false, tarama: null };

// Kalfa taraması (/api/kalfa/modeller/tara): her metin modeline gerçek bir kalfa isteği gider. Modül kalfası
// sekmesinde yalnızca taramada çalışan (doğrulamadan geçen modül üreten) modeller listelenir.
const saniye = (ms) => `${Math.max(1, Math.round(ms / 1000))} sn`;
function saglikEtiketi(m) {
  const s = m.saglik;
  if (!s) return null;
  if (modelDurumu.tarama?.ilerleme?.suren?.includes(m.deger)) return { sinif: "suruyor", metin: "sınanıyor…", baslik: "Kalfa isteği sürüyor" };
  const tarih = s.tarih ? new Date(s.tarih).toLocaleString(yerelDil(), { dateStyle: "short", timeStyle: "short" }) : "";
  if (s.durum === "calisiyor") return { sinif: "iyi", metin: `✓ çalışıyor · ${saniye(s.sure)}`, baslik: `Kalfa testi ${tarih}: ${saniye(s.sure)}, ${s.deneme ?? "?"} deneme, ${s.satir ?? "?"} satır` };
  if (s.durum === "hata") return { sinif: "kotu", metin: `✗ ${s.hata}`, baslik: `Kalfa testi ${tarih}: ${s.hata}` };
  return { sinif: "", metin: "denenmedi", baslik: "Bu model henüz kalfa testinden geçmedi" };
}
const saglikSirasi = (m) => (m.saglik?.durum === "calisiyor" ? 0 : m.saglik?.durum === "hata" ? 2 : 1);

let taramaZamanlayici = null;
function taramaGoster() {
  const t = modelDurumu.tarama, yazi = $("#model-tarama"), d = $("#model-tara");
  d.disabled = !!t?.calisiyor;
  d.textContent = t?.calisiyor ? "Test sürüyor…" : "Modelleri test et";
  if (t?.calisiyor && t.ilerleme) {
    const { biten, toplam, suren } = t.ilerleme;
    yazi.textContent = `Kalfa testi sürüyor: ${biten}/${toplam} model bitti${suren.length ? ` · şu an: ${suren.join(", ")}` : ""}. Pencereyi kapatabilirsin; test arka planda sürer.`;
  } else if (t?.guncelleme) {
    const calisan = modelDurumu.modeller.filter((m) => m.saglik?.durum === "calisiyor").length;
    const denenen = modelDurumu.modeller.filter((m) => m.saglik && m.saglik.durum !== "denenmedi").length;
    yazi.textContent = `Son kalfa testi ${new Date(t.guncelleme).toLocaleString(yerelDil(), { dateStyle: "short", timeStyle: "short" })}: ${denenen} modelden ${calisan} tanesi modül üretebildi.`;
  } else yazi.textContent = "";
}
async function taramaYokla() {
  clearTimeout(taramaZamanlayici);
  try {
    const t = await yApi("/api/kalfa/modeller/tara");
    // Biten modellerin sonucunu listeye işle (sunucu sıralaması bir sonraki yüklemede gelir).
    for (const m of modelDurumu.modeller) if (m.tur === "metin" && t.sonuclar[m.deger]) m.saglik = t.sonuclar[m.deger];
    modelDurumu.tarama = { calisiyor: t.calisiyor, ilerleme: t.ilerleme, guncelleme: t.guncelleme };
    taramaGoster(); modelCiz();
    if (t.calisiyor) taramaZamanlayici = setTimeout(taramaYokla, 4000);
    else if ($("#kalfa-ayarlari").open) modelleriYukle();
  } catch (h) {
    const durum = $("#model-durum"); durum.className = "durum kotu"; durum.textContent = h.message;
  }
}
$("#model-tara").addEventListener("click", async () => {
  const durum = $("#model-durum");
  durum.className = "durum"; durum.textContent = "";
  try {
    const t = await yApi("/api/kalfa/modeller/tara", { method: "POST", govde: {} });
    modelDurumu.tarama = { ...modelDurumu.tarama, calisiyor: true, ilerleme: t.ilerleme };
    taramaGoster(); modelCiz();
    taramaZamanlayici = setTimeout(taramaYokla, 2000);
  } catch (h) {
    durum.className = "durum kotu"; durum.textContent = h.message;
  }
});

function fiyatYazisi(f) {
  if (!f) return "";
  if (f.per_request != null) return `${f.per_request} / istek`;
  if (f.input != null) return `${f.input} / ${f.output ?? "?"}`;
  return "";
}
const baglamYazisi = (n) => (!n ? "" : n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : `${Math.round(n / 1000)}K`);

function modelTaslagi(secili) {
  return {
    kalfaModeli: secili.kalfaModeli ?? null,
    dalisMetinModelleri: [...(secili.dalisMetinModelleri ?? [])],
    dalisGorselModelleri: [...(secili.dalisGorselModelleri ?? [])],
  };
}

async function modelleriYukle({ yenile = false } = {}) {
  modelDurumu.yukleniyor = true;
  const durum = $("#model-durum");
  durum.className = "durum"; durum.textContent = "Model listesi alınıyor…";
  $("#model-listesi").replaceChildren();
  try {
    const v = await yApi(`/api/kalfa/modeller${yenile ? "?yenile=1" : ""}`);
    modelDurumu.modeller = v.modeller;
    modelDurumu.secili = v.secili;
    modelDurumu.taslak = modelTaslagi(v.secili);
    modelDurumu.tarama = v.tarama ?? null;
    if (v.tarama?.calisiyor && !taramaZamanlayici) taramaZamanlayici = setTimeout(taramaYokla, 4000);
    const sahipler = [...new Set(v.modeller.map((m) => m.sahip).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    const sec = $("#model-sahip"), onceki = sec.value;
    sec.replaceChildren(el("option", { value: "", textContent: "Tüm sağlayıcılar" }), ...sahipler.map((x) => el("option", { value: x, textContent: x })));
    sec.value = sahipler.includes(onceki) ? onceki : "";
    const metin = v.modeller.filter((m) => m.tur === "metin").length;
    $("#model-bilgi").textContent = `UstaGPT: ${metin} metin, ${v.modeller.length - metin} görsel model · liste ${new Date(v.guncelleme).toLocaleTimeString(yerelDil(), { hour: "2-digit", minute: "2-digit" })} itibarıyla`;
    durum.textContent = "";
  } catch (h) {
    modelDurumu.modeller = [];
    durum.className = "durum kotu"; durum.textContent = h.message;
  } finally {
    modelDurumu.yukleniyor = false;
    taramaGoster();
    modelCiz();
  }
}

function modelCiz() {
  const { alan, taslak, modeller, secili } = modelDurumu;
  const tanim = MODEL_ALANLARI[alan];
  for (const b of document.querySelectorAll(".model-sekmeler button")) {
    const bu = b.dataset.alan === alan;
    b.classList.toggle("secili", bu); b.setAttribute("aria-selected", String(bu));
  }
  let ipucu = tanim.ipucu;
  if (alan === "kalfaModeli" && secili?.kalfa) {
    if (secili.kalfa.saglayici === "sahte") ipucu += " Not: kalfa şu an sahte modda (KALFA_SAHTE); seçim kaydedilir ama sahte mod kapanınca geçerli olur.";
    else if (!secili.kalfa.ustagpt) ipucu += " Not: modül kalfası şu an UstaGPT'ye bağlı değil (.env'deki KALFA_API_URL başka bir uç nokta); bu seçim uygulanmaz.";
  }
  if (alan !== "kalfaModeli" && secili?.dalis && !secili.dalis.ustagpt) ipucu += " Not: dalış kalfası şu an UstaGPT'ye bağlı değil (DALIS_API_URL); bu seçim uygulanmaz.";
  $("#model-ipucu").textContent = ipucu;

  const secimler = tanim.coklu ? taslak[alan] ?? [] : taslak[alan] ? [taslak[alan]] : [];
  const kutu = $("#model-secili");
  kutu.replaceChildren(...secimler.map((deger, i) => {
    const kaldir = el("button", { type: "button", className: "cip-d", textContent: "×", title: "Çıkar" });
    kaldir.setAttribute("aria-label", `${deger} modelini çıkar`);
    kaldir.addEventListener("click", () => modelSec(deger, false));
    const cip = el("li", { className: "model-cip" }, tanim.coklu ? el("span", { className: "cip-sira", textContent: String(i + 1) }) : null, el("span", { className: "mono", textContent: deger }));
    if (tanim.coklu && i > 0) {
      const one = el("button", { type: "button", className: "cip-d", textContent: "↑", title: "Öne al" });
      one.setAttribute("aria-label", `${deger} modelini öne al`);
      one.addEventListener("click", () => { const l = taslak[alan]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; modelCiz(); });
      cip.append(one);
    }
    if (tanim.coklu) cip.append(kaldir);
    return cip;
  }));
  kutu.hidden = !secimler.length;

  const ara = $("#model-ara").value.trim().toLocaleLowerCase("tr"), sahip = $("#model-sahip").value;
  const etkin = new Set(tanim.coklu ? secili?.[alan] ?? [] : [secili?.[alan]]);
  // Modül kalfası: yalnızca kalfa testinde çalışan modeller (ve şu an seçili/etkin olan, durumu ne olursa olsun).
  const yalnizCalisan = alan === "kalfaModeli";
  const gorunur = (m) => !yalnizCalisan || m.saglik?.durum === "calisiyor" || etkin.has(m.deger) || secimler.includes(m.deger);
  const uygun = modeller
    .filter((m) => m.tur === tanim.tur && gorunur(m) && (!sahip || m.sahip === sahip) && (!ara || m.deger.toLowerCase().includes(ara) || (m.sahip ?? "").includes(ara)))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => saglikSirasi(a.m) - saglikSirasi(b.m) || (saglikSirasi(a.m) === 0 ? a.m.saglik.sure - b.m.saglik.sure : 0) || a.i - b.i)
    .map(({ m }) => m);
  const liste = $("#model-listesi");
  if (!modeller.length) { liste.replaceChildren(); return; }
  const calisanYok = yalnizCalisan && !modeller.some((m) => m.tur === "metin" && m.saglik?.durum === "calisiyor");
  const not = calisanYok
    ? el("li", { className: "aciklama model-bos", textContent: modelDurumu.tarama?.guncelleme
      ? "Son kalfa testinde modül üretebilen model çıkmadı; şimdilik varsayılan model gösteriliyor. Daha sonra yeniden test et."
      : "Henüz kalfa testi yapılmadı; şimdilik varsayılan model gösteriliyor. Çalışan modelleri görmek için \"Modelleri test et\"." })
    : null;
  if (!uygun.length) { liste.replaceChildren(not ?? el("li", { className: "aciklama model-bos", textContent: "Aramaya uyan model yok." })); return; }
  liste.replaceChildren(...(not ? [not] : []), ...uygun.map((m) => {
    const secilmis = secimler.includes(m.deger);
    const girdi = el("input", { type: tanim.coklu ? "checkbox" : "radio", name: "model-sec", value: m.deger, checked: secilmis });
    girdi.addEventListener("change", () => modelSec(m.deger, girdi.checked));
    const ek = [m.sahip, m.baglam ? `${baglamYazisi(m.baglam)} bağlam` : "", fiyatYazisi(m.fiyat)].filter(Boolean).join(" · ");
    const satir = el("label", { className: "model-satir" }, girdi,
      el("span", { className: "model-ad mono", textContent: m.deger }),
      etkin.has(m.deger) ? el("span", { className: "model-etkin", textContent: "şu an etkin" }) : null,
      el("span", { className: "model-ek", textContent: ek, title: "Sağlayıcı · bağlam penceresi · UstaGPT fiyatı (giriş / çıkış)" }));
    const saglik = m.tur === "metin" ? saglikEtiketi(m) : null;
    if (saglik) satir.append(el("span", { className: `model-saglik ${saglik.sinif}`, textContent: saglik.metin, title: saglik.baslik }));
    return el("li", { className: secilmis ? "secili" : "" }, satir);
  }));
}

function modelSec(deger, ekle) {
  const { alan, taslak } = modelDurumu;
  const tanim = MODEL_ALANLARI[alan];
  const durum = $("#model-durum");
  durum.className = "durum"; durum.textContent = "";
  if (!tanim.coklu) taslak[alan] = ekle ? deger : taslak[alan] === deger ? null : taslak[alan];
  else {
    const l = taslak[alan];
    if (ekle && !l.includes(deger)) {
      if (l.length >= 5) { durum.className = "durum kotu"; durum.textContent = "En çok 5 model seçilebilir."; modelCiz(); return; }
      l.push(deger);
    } else if (!ekle) taslak[alan] = l.filter((x) => x !== deger);
  }
  modelCiz();
}

async function modelKaydet(govde, mesaj) {
  const durum = $("#model-durum"), d = $("#model-kaydet");
  d.disabled = true;
  try {
    const { secili } = await yApi("/api/kalfa/ayarlar", { method: "PUT", govde });
    modelDurumu.secili = secili;
    modelDurumu.taslak = modelTaslagi(secili);
    durum.className = "durum iyi"; durum.textContent = mesaj;
    kalfaDurumu();
  } catch (h) {
    durum.className = "durum kotu"; durum.textContent = h.message;
  } finally {
    d.disabled = false;
    modelCiz();
  }
}

$("#model-kaydet").addEventListener("click", () => {
  const { taslak, alan } = modelDurumu;
  const tanim = MODEL_ALANLARI[alan];
  if (tanim.coklu ? !taslak[alan].length : !taslak[alan]) {
    const durum = $("#model-durum"); durum.className = "durum kotu"; durum.textContent = "Önce en az bir model seç.";
    return;
  }
  // Yalnızca değişen alanlar gönderilir; öbür sekmelerdeki kaydedilmemiş seçimler de birlikte kaydedilir.
  const govde = {};
  for (const [k, t] of Object.entries(MODEL_ALANLARI)) {
    const yeni = taslak[k], eski = modelDurumu.secili?.[k];
    if (JSON.stringify(yeni) !== JSON.stringify(eski) && (t.coklu ? yeni.length : yeni)) govde[k] = yeni;
  }
  if (!Object.keys(govde).length) { const durum = $("#model-durum"); durum.className = "durum iyi"; durum.textContent = "Seçim zaten bu."; return; }
  modelKaydet(govde, "Kaydedildi. Kalfa bir sonraki istekte bu modelleri kullanır.");
});
$("#model-sifirla").addEventListener("click", () => {
  modelKaydet({ [modelDurumu.alan]: null }, "Bu sekmenin seçimi silindi; .env ya da varsayılan geçerli.");
});
$("#model-yenile").addEventListener("click", () => modelleriYukle({ yenile: true }));
$("#model-ara").addEventListener("input", modelCiz);
$("#model-sahip").addEventListener("change", modelCiz);
document.querySelector(".model-sekmeler").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-alan]");
  if (!b) return;
  modelDurumu.alan = b.dataset.alan;
  $("#model-ara").value = "";
  $("#model-durum").textContent = "";
  modelCiz();
});
function modelPenceresiniAc(alan) {
  if (!yoneticiMi()) return bildirim("Kalfa modellerini yalnızca admin hesapları değiştirebilir.");
  if (alan) modelDurumu.alan = alan;
  $("#model-durum").textContent = "";
  $("#kalfa-ayarlari").showModal();
  modelCiz();
  modelleriYukle();
}
$("#model").addEventListener("click", () => modelPenceresiniAc("kalfaModeli"));
$("#kalfa-ayar-d").addEventListener("click", () => modelPenceresiniAc(kip === "dalis" ? "dalisMetinModelleri" : "kalfaModeli"));

editoruGuncelle();
fetch("/api/ayarlar").then((y) => y.json()).then(async (a) => {
  yonetimSifreli = !!a.yonetim?.sifreli;
  hesapGerekli = !!a.hesap?.gerekli;
  if (hesapGerekli) await hesabiYukle();
  yetkiGuncelle();
  // Oturum yoksa (ya da ilk şifre değiştirilmemişse) Studio'nun yerine giriş kapısı.
  kapiyiAc();
  sayaclariGuncelle();
  oturumlariBaslat();
}).catch(() => {});
