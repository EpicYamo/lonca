import { ciniArkaPlan } from "/ortak/cini.js";
import { hareketAzalt } from "/ortak/animasyon.js";
import { loncaLogo } from "/ortak/logo.js";

const $ = (s) => document.querySelector(s);
const el = (etiket, ozellik = {}, ...cocuk) => {
  const d = Object.assign(document.createElement(etiket), ozellik);
  d.append(...cocuk.filter((c) => c != null));
  return d;
};

document.querySelector("#amblem").innerHTML = loncaLogo({ boyut: 38, baslik: "Lonca" });

const sohbet = [];

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
});

let akisNo = 0;
async function kodAkit(kod) {
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
function mesajEkle(rol, metin, { adimlar = [], hata = false } = {}) {
  const li = el("li", { className: `mesaj ${rol}${hata ? " hata" : ""}` }, el("p", { textContent: metin }));
  if (adimlar.length) li.append(el("ul", { className: "adimlar" }, ...adimlar.map(([m, sinif], i) => el("li", { className: `adim ${sinif ?? ""}`, textContent: m, style: `--i:${i}` }))));
  $("#mesajlar").append(li);
  sonaKaydir();
  return li;
}

// ---------- Kalfa kipi: Modül ya da Dalış ----------
// Dalış kipinde ustanın yazdığı her şey bir dalış isteğidir: dalış kalfası (server/dalis-kalfasi.js) eseri bulur,
// kaynakları toplar, geziyi planlar, kareleri üretir ve dalışı onay bekleyen olarak kaydeder.
let kip = "modul";
const KIP = {
  modul: { not: "Fikrini mini uygulamaya çevirir", ipucu: "Fikrini anlat… (Enter gönderir, Shift+Enter yeni satır)" },
  dalis: { not: "İsteğini uydudan eserin içine inen bir geziye çevirir (birkaç dakika sürer)", ipucu: "Hangi eser, neler anlatılsın? Örn. \"Ulu Cami'nin minberini ve şadırvanını anlatan bir dalış\"" },
};
function kipSec(yeni) {
  kip = yeni;
  for (const b of document.querySelectorAll(".kip button")) {
    const secili = b.dataset.kip === kip;
    b.classList.toggle("secili", secili);
    b.setAttribute("aria-checked", String(secili));
  }
  $("#kip-not").textContent = KIP[kip].not;
  $("#istek").placeholder = KIP[kip].ipucu;
  const ilk = $("#mesajlar").children.length <= 1;
  $("#oneriler").hidden = kip !== "modul" || !ilk;
  $("#dalis-oneriler").hidden = kip !== "dalis";
}
document.querySelectorAll(".kip button").forEach((b) => b.addEventListener("click", () => kipSec(b.dataset.kip)));
$("#dalis-oneriler").addEventListener("click", (e) => { if (e.target.matches("button")) gonder(e.target.textContent); });

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
async function dalisGonder(metin) {
  mesajEkle("usta", metin);
  $("#istek").value = "";
  $("#gonder").disabled = true;
  const cubuk = el("div", { className: "dalis-cubuk" }, el("span", { style: "width:3%" }));
  const gunluk = el("ul", { className: "dalis-gunluk" });
  const baslik = el("p", { textContent: "Dalış kalfası isteğini anlıyor…" });
  const li = el("li", { className: "mesaj kalfa" }, baslik, el("div", { className: "dalis-ilerleme" }, cubuk, gunluk));
  $("#mesajlar").append(li);
  sonaKaydir();
  try {
    const { is } = await yApi("/api/dalis-kalfasi", { method: "POST", govde: { istek: metin } });
    let goruldu = 0, durum;
    do {
      await bekle(1500);
      durum = await yApi(`/api/dalis-kalfasi/${is}`, { yeniden: false });
      for (const g of durum.gunluk.slice(goruldu)) gunluk.append(el("li", { textContent: `${String(g.t).padStart(3, " ")} sn  ${g.metin}` }));
      goruldu = durum.gunluk.length;
      gunluk.scrollTop = gunluk.scrollHeight;
      cubuk.firstChild.style.width = `${Math.max(3, (durum.adim / durum.toplamAdim) * 100)}%`;
      if (durum.ad) baslik.textContent = `${durum.ad} için dalış hazırlanıyor (adım ${durum.adim}/${durum.toplamAdim})…`;
    } while (durum.durum === "calisiyor");
    if (durum.durum === "hata") {
      li.classList.add("hata");
      baslik.textContent = durum.hata;
      return;
    }
    cubuk.firstChild.style.width = "100%";
    baslik.textContent = `${durum.ad} dalışı hazır: ${durum.sonuc.kareSayisi} durak. Önizlemede "onay bekliyor" olarak görünüyor; kartları kontrol edip yayınla.`;
    const onizleDugme = el("button", { type: "button", className: "ikincil", textContent: "Önizle" });
    const yayinla = el("button", { type: "button", className: "birincil", textContent: "Yayınla" });
    onizleDugme.addEventListener("click", () => dalisOnizle());
    yayinla.addEventListener("click", async () => {
      try {
        await yApi(`/api/dalislar/${durum.eser}/durum`, { method: "POST", govde: { durum: "onayli" } });
        yayinla.disabled = true; yayinla.textContent = "Yayında ✓";
      } catch (h) { mesajEkle("kalfa", h.message, { hata: true }); }
    });
    li.append(el("div", { className: "dalis-dugmeler" }, onizleDugme, yayinla));
    dalisOnizle();
  } catch (h) {
    li.classList.add("hata");
    baslik.textContent = h.message;
  } finally {
    $("#gonder").disabled = false;
    $("#istek").focus();
    sonaKaydir();
  }
}

// Önizlemede Vakıf Dalışları modülünü açar; önizleme kipinde onay bekleyen dalışlar da listelenir.
async function dalisOnizle() {
  try {
    const kod = await (await fetch("/api/moduller/vakif-dalislari/kod")).text();
    bekleyen = { kod, ad: "Vakıf Dalışları", id: "vakif-dalislari", renk: "altin", ikon: "cami", kategori: "gezi" };
    $("#cerceve").src = `/app/?onizleme=1&t=${Date.now()}`;
  } catch (h) { mesajEkle("kalfa", `Önizleme açılamadı: ${h.message}`, { hata: true }); }
}

async function gonder(metin) {
  metin = metin.trim();
  if (!metin || $("#gonder").disabled) return;
  if (kip === "dalis") return dalisGonder(metin);
  sohbet.push({ rol: "usta", metin });
  mesajEkle("usta", metin);
  $("#istek").value = "";
  $("#oneriler").hidden = true;
  $("#gonder").disabled = true;
  const yaziyor = el("li", { className: "mesaj kalfa" },
    el("div", { className: "yaziyor" }, el("i"), el("i"), el("i"), el("span", { textContent: "Kalfa çalışıyor: veriye bakıyor, yazıyor, denetliyor" })));
  $("#mesajlar").append(yaziyor);
  sonaKaydir();

  try {
    const y = await fetch("/api/kalfa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sohbet, kod: $("#kod").value || undefined }),
    });
    const s = await y.json();
    yaziyor.remove();
    if (!y.ok) {
      sohbet.pop();
      const ayrinti = s.ayrintilar?.length ? `\n• ${s.ayrintilar.join("\n• ")}` : "";
      mesajEkle("kalfa", `${s.hata}${ayrinti}`, { hata: true });
      return;
    }
    const adimlar = (s.aramalar ?? []).map((a) => {
      const sorgu = Object.entries(a.sorgu ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "tümü";
      return [`Veriye baktı: ${sorgu} → ${a.bulunan} eser`];
    });
    if (s.deneme > 1) adimlar.push([`Denetimde hata buldu, ${s.deneme}. denemede düzeltti`, "duzeltme"]);
    adimlar.push(["SDK tip denetiminden geçti"]);
    if (s.model) adimlar.push([s.model === "sahte" ? "Sahte kalfa: yapay zekâ bağlı değil, hazır şablon" : `Kodu yazan model: ${s.model}`]);
    sohbet.push({ rol: "kalfa", metin: s.aciklama_ustaya });
    mesajEkle("kalfa", s.aciklama_ustaya, { adimlar });

    surumSakla("kalfa yazmadan önce");
    if (!(await kodAkit(s.kod))) return;
    $("#ad").value = s.ad;
    $("#id").value = s.id;
    $("#aciklama").value = s.aciklama;
    $("#renk").value = s.renk ?? "";
    $("#ikon").value = s.ikon === "genel" ? "" : (s.ikon ?? "");
    $("#kategori").value = s.kategori ?? "";
    editoruGuncelle();
    durumYaz("iyi", "Modül hazır, önizlemede çalışıyor.");
    onizle();
  } catch (h) {
    yaziyor.remove();
    sohbet.pop();
    mesajEkle("kalfa", `Sunucuya ulaşılamadı: ${h.message}. Sunucunun çalıştığını kontrol et.`, { hata: true });
  } finally {
    $("#gonder").disabled = false;
    $("#istek").focus();
  }
}

$("#sohbet-formu").addEventListener("submit", (e) => { e.preventDefault(); gonder($("#istek").value); });
$("#istek").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gonder($("#istek").value); }
});
$("#oneriler").addEventListener("click", (e) => { if (e.target.matches("button")) gonder(e.target.textContent); });

let bekleyen = null;
function onizle() {
  const kod = $("#kod").value;
  if (!kod.trim()) return durumYaz("kotu", "Önizlenecek kod yok. Kalfaya bir fikir anlat ya da kodu elle yaz.");
  bekleyen = { kod, ad: $("#ad").value, id: $("#id").value, renk: $("#renk").value || undefined, ikon: $("#ikon").value || undefined, kategori: $("#kategori").value || undefined };
  $("#cerceve").src = `/app/?onizleme=1&t=${Date.now()}`;
  const telefon = $(".telefon");
  telefon.classList.remove("parla");
  void telefon.offsetWidth;
  telefon.classList.add("parla");
}
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.source !== $("#cerceve").contentWindow) return;
  if (e.data?.tur === "onizleme-hazir" && bekleyen) {
    $("#cerceve").contentWindow.postMessage({ tur: "onizle", ...bekleyen }, location.origin);
  }
});
$("#onizle").addEventListener("click", onizle);

const SIFRE_ANAHTARI = "lonca.yonetici";
const sifreOku = () => { try { return sessionStorage.getItem(SIFRE_ANAHTARI) ?? ""; } catch { return ""; } };
let yonetimSifreli = false;

async function yApi(yol, { method = "GET", govde, yeniden = true, basliklar = {} } = {}) {
  const y = await fetch(yol, {
    method, headers: { ...(govde !== undefined ? { "content-type": "application/json" } : {}), "x-yonetici-sifre": sifreOku(), ...basliklar },
    body: govde !== undefined ? JSON.stringify(govde) : undefined,
  });
  if (y.status === 401 && yeniden && await girisIste()) return yApi(yol, { method, govde, basliklar, yeniden: false });
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
      yoneticiRozeti(y.ok);
      if (!y.ok) { try { sessionStorage.removeItem(SIFRE_ANAHTARI); } catch {} return coz(await girisIste()); }
      coz(true);
    });
  });
}
function yoneticiRozeti(girildi) {
  const r = $("#yonetici");
  r.classList.toggle("canli", girildi || !yonetimSifreli);
  r.textContent = !yonetimSifreli ? "Geliştirme modu" : girildi ? "Yönetici ✓" : "Yönetici girişi";
  r.title = !yonetimSifreli ? "YONETICI_SIFRE tanımlı değil: onay işlemleri şifresiz" : "";
}
$("#yonetici").addEventListener("click", () => { if (yonetimSifreli) girisIste().then(() => { modulleriListele(); icerikYukle(); }); });

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
      durumYaz("kotu", `“${var_.ad}” (${DURUM_ADI[var_.durum]}) bu kimlikle zaten var. Gönderirsen kodu değişir ve yeniden onay bekler. Yeni bir modül istiyorsan önce kimliği değiştir; yine de göndermek için düğmeye tekrar bas.`);
      setTimeout(() => { delete dugme.dataset.emin; dugme.textContent = eski; }, 6000);
      return;
    }
  }
  delete dugme.dataset.emin;
  const govde = {
    id: $("#id").value.trim(), ad: $("#ad").value.trim(), aciklama: $("#aciklama").value.trim(),
    renk: $("#renk").value || undefined, ikon: $("#ikon").value || undefined, kategori: $("#kategori").value || undefined,
    izinler: /eserler\.yakindaki/.test(kod) ? ["konum"] : [], kod,
  };
  try {
    const s = await yApi("/api/moduller", { method: "POST", govde });
    durumYaz("iyi", `“${s.ad}” onaya gönderildi (${kaynakMetni(s.kaynak)}). Yayınlayınca uygulamada hemen görünür.`);
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
    $("#durum").append(el("div", { className: "durum-eylem" }, yayinla, listeyeGit));
    sayaclariGuncelle();
  } catch (h) { durumYaz("kotu", h.message, h.ayrintilar); }
});

// Modülün kaynağı sunucuda belirlenir: kod kalfanın ürettiğiyle birebir aynıysa "kalfa", değilse "elle".
function kaynakMetni(k) {
  if (k?.tur === "kalfa") return k.sahte ? "sahte kalfa şablonu" : `kalfa yazdı · ${k.model}`;
  if (k?.tur === "elle") return "elle yazıldı/düzenlendi";
  return "kaynak kaydı yok";
}
const DURUM_ADI = { bekliyor: "Onay bekliyor", onayli: "Yayında", kaldirildi: "Yayından kaldırıldı", arsiv: "Arşivde", reddedildi: "Reddedildi" };
const EYLEMLER = {
  bekliyor: [["Atölyede aç", "ac", "ikincil"], ["Yayınla", "onayli", "birincil"], ["Reddet", "reddedildi", "ikincil"], ["Sil", "sil", "tehlike"]],
  onayli: [["Atölyede aç", "ac", "ikincil"], ["Yayından kaldır", "kaldirildi", "ikincil"], ["Arşivle", "arsiv", "ikincil"]],
  kaldirildi: [["Atölyede aç", "ac", "ikincil"], ["Yeniden yayınla", "onayli", "birincil"], ["Arşivle", "arsiv", "ikincil"], ["Sil", "sil", "tehlike"]],
  arsiv: [["Arşivden çıkar", "kaldirildi", "ikincil"], ["Sil", "sil", "tehlike"]],
  reddedildi: [["Atölyede aç", "ac", "ikincil"], ["Yeniden değerlendir", "bekliyor", "ikincil"], ["Sil", "sil", "tehlike"]],
};
let modulSuzgeci = "hepsi";
const tarihYaz = (t) => (t ? new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

async function modulleriListele() {
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
    const eylemler = el("div", { className: "modul-eylemler" }, ...(EYLEMLER[m.durum] ?? []).map(([etiket, eylem, sinif]) => {
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
      eylemler);
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
      textContent: `${new Date(s.zaman).toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" })} · ${s.ad || s.id || "adsız"} · ${s.neden} · ${s.kod.split("\n").length} satır` })));
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
  editoruGuncelle();
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
const fotoAnindaMi = () => !!seciliEser && !formOneri;

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
  $("#form-baslik").textContent = oneri ? "Öneriyi incele ve onayla" : eser ? "Eseri düzenle" : "Yeni eser";
  f.elements.ad.value = v.ad ?? ""; f.elements.ad_en.value = v.ad_en ?? ""; f.elements.tur.value = v.tur ?? "cami";
  f.elements.il.value = v.il ?? "Bursa"; f.elements.ilce.value = v.ilce ?? ""; f.elements.yuzyil.value = v.yuzyil ?? "";
  f.elements.lat.value = v.konum?.lat ?? ""; f.elements.lng.value = v.konum?.lng ?? ""; f.elements.yaklasik.checked = !!v.konum?.yaklasik;
  f.elements.adres.value = v.adres ?? ""; f.elements.tarihce_tr.value = v.tarihce?.tr ?? ""; f.elements.tarihce_en.value = v.tarihce?.en ?? "";
  f.elements.kaynak.value = v.kaynak ?? "";
  formFotolari = [...(v.fotograflar ?? [])];
  fotolariCiz();
  const eksik = { ad: !v.ad, tur: !v.tur, il: !v.il, ilce: !v.ilce, yuzyil: !Number.isInteger(v.yuzyil), lat: !v.konum, lng: !v.konum, adres: !v.adres, tarihce_tr: !v.tarihce?.tr };
  for (const [ad, yok] of Object.entries(eksik)) f.elements[ad]?.closest("label")?.classList.toggle("eksik-alan", !!eser && yok);
  $("#eser-sil").hidden = !eser || !!oneri;
  $("#eser-gecmisi-ac").hidden = !eser || !!oneri;
  $("#foto-ipucu").textContent = fotoAnindaMi() ? "değişiklikler hemen kaydedilir · ilk fotoğraf kapaktır" : "ilk fotoğraf kapak olur · kaydedince yayına girer";
  f.querySelector("[type=submit]").textContent = oneri ? "Onayla ve yayınla" : "Kaydet ve yayınla";
  durumYaz("", "", [], "#eser-durum");
  f.hidden = false; $("#eser-bos").hidden = true;
  formIlkHali = formAnahtari();
  kirliIsaretiniGuncelle();
  eserListesiniCiz();
  f.elements.ad.focus({ preventScroll: true });
}
$("#yeni-eser").addEventListener("click", () => formuAc(null));
$("#eser-vazgec").addEventListener("click", async () => {
  if (!(await ayrilabilirMi())) return;
  $("#eser-formu").hidden = true; $("#eser-bos").hidden = false; seciliEser = null; formOneri = null; eserListesiniCiz();
});

async function fotoGoster(img, yol) {
  if (!yol.startsWith("/medya/yuklenen/")) { img.src = yol; return; }
  try { const y = await fetch(yol, { headers: { "x-yonetici-sifre": sifreOku() } }); if (y.ok) img.src = URL.createObjectURL(await y.blob()); } catch {}
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
      const b = el("button", { type: "button", className: sinif, textContent: metin, ariaLabel: etiket, title: etiket, disabled: kapali });
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
  const b = el("div", { className: "bildirim", role: "status" }, el("span", { textContent: metin }), geriB, kapatB);
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
    const saat = new Date(g.zaman).toLocaleString("tr", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const ayrinti = g.neden ?? (g.ozet?.length ? (g.islem === "ice-aktar" ? g.ozet.join(", ") : `${g.ozet.map((a) => ALAN_ADI[a] ?? a).join(", ")} değişti`) : "");
    const geriB = el("button", { type: "button", className: "kucuk-d ikincil", textContent: g.geriAlindi ? "geri alındı" : "Geri al", disabled: g.geriAlindi });
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
  try { oneriler = await yApi("/api/eser-oneriler"); }
  catch (h) { $("#oneriler-listesi").replaceChildren(el("li", { className: "aciklama", textContent: h.message })); return; }
  if (!oneriler.length) { $("#oneriler-listesi").replaceChildren(el("li", { className: "aciklama", textContent: "Bekleyen öneri yok." })); return; }
  $("#oneriler-listesi").replaceChildren(...oneriler.map((o) => {
    const baslik = o.tur === "yeni" ? `Yeni eser: ${o.veri?.ad}` : o.tur === "duzenle" ? `Düzenleme: ${o.eser?.ad}` : `Hata bildirimi: ${o.eser?.ad}`;
    const govde = el("div", { className: "oneri-govde" });
    if (o.not) govde.append(el("p", { className: "oneri-not", textContent: `“${o.not}”` }));
    if (o.tur === "duzenle" && o.veri) govde.append(el("ul", { className: "fark" }, ...Object.entries(o.veri).map(([k, v]) =>
      el("li", {}, el("b", { textContent: ALAN_ADI[k] ?? k }), el("del", { textContent: kisa(o.eser?.[k]) }), el("ins", { textContent: kisa(v) })))));
    if (o.tur === "yeni" && o.veri) govde.append(el("p", { className: "aciklama", textContent: `${TUR_ADI[o.veri.tur] ?? o.veri.tur} · ${o.veri.ilce ?? ""} · kaynak: ${o.veri.kaynak}` }));
    const incele = el("button", { className: "birincil", type: "button", textContent: o.tur === "not" ? "Eseri düzenle" : "İncele ve onayla" });
    incele.addEventListener("click", () => formuAc(o.eser ?? null, { oneri: o.tur === "not" ? null : o, onerilenVeri: o.veri }));
    const kapat = el("button", { className: "ikincil", type: "button", textContent: o.tur === "not" ? "Çözüldü" : "Reddet" });
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
  try { yaz("#sayac-modul", (await yApi("/api/moduller?durum=hepsi", { yeniden: false })).filter((m) => m.durum === "bekliyor").length); } catch {}
  try { yaz("#sayac-oneri", (await yApi("/api/eser-oneriler", { yeniden: false })).length); } catch {}
}

const saat = () => { $("#saat").textContent = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); };
saat(); setInterval(saat, 30000);

async function durumCubugu() {
  try {
    const t = tamlikOzeti ?? await (await fetch("/api/eserler-tamlik")).json();
    $("#dc-eser").innerHTML = `eserler: <b>${t.toplam}</b> · tam: <b>${t.tam}</b>`;
    const yayinda = (await (await fetch("/api/moduller")).json()).length;
    $("#dc-modul").innerHTML = `modüller: <b>${yayinda}</b> yayında`;
  } catch {}
}
setInterval(() => { $("#dc-saat").textContent = new Date().toLocaleString("tr-TR", { weekday: "short", hour: "2-digit", minute: "2-digit" }); }, 1000);
durumCubugu();

fetch("/api/kalfa").then((y) => y.json()).then((k) => {
  $("#dc-kalfa").innerHTML = `kalfa: <b>${k.sahte ? "sahte mod" : k.model}</b>`;
  $("#model").classList.add(k.sahte ? "sahte" : "canli");
  $("#model-ad").textContent = k.sahte ? "Kalfa: sahte mod (yapay zekâ bağlı değil)" : `Kalfa: ${k.model}`;
}).catch(() => { $("#model-ad").textContent = "Kalfa: sunucuya ulaşılamadı"; });

editoruGuncelle();
fetch("/api/ayarlar").then((y) => y.json()).then((a) => {
  yonetimSifreli = !!a.yonetim?.sifreli;
  yoneticiRozeti(!!sifreOku());
  sayaclariGuncelle();
}).catch(() => {});
