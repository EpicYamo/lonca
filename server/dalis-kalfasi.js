// Dalış kalfası: bir eser için uydudan içine kaydırmalı gezi ("dalış") hazırlayan ajan.
//
// Ustanın serbest isteğiyle çalışır ("Ulu Cami'nin minberini ve şadırvanını anlatan bir dalış yap").
// Adımlar (her biri Studio'da canlı izlenir):
//   0. İstek       isteğe uyan eser adayları yerelde puanlanır, dil modeli doğru eseri ve odağı seçer
//   1. Kaynaklar   eser kaydı (Vakıf envanteri) + Türkçe Vikipedi metni ve koordinatı
//   2. Fotoğraflar görsel model eserin fotoğraflarını tanır (hava / dış / iç / detay)
//   3. Plan        dil modeli, aşağıdaki DALIS_SISTEM istemiyle geziyi planlar: dış duraklar, giriş, merkez,
//                  kollar (ayrıntılar) ve her durağın kaynaklı bilgi kartları
//   4. Üretim      uydu inişi (Esri), gerçek fotoğrafların dikey kareye genişletilmesi, giriş ve merkez kareleri
//   5. Kollar      görsel model merkez karede her ayrıntının yerini bulur; ayrıntı o bölgenin kırpımından yakın
//                  çekim olarak üretilir (merkezden ayrıntıya dalış ve geri çekiliş dikişsiz olur)
//   6. İşaretler   görsel model bilgi kartlarının oklarının göstereceği noktaları bulur
//   7. Kayıt       data/dalislar/<eser>.json, durum "bekliyor": editör Studio'da inceleyip onaylar
//
// Bilgi kartları yalnızca verilen kaynaklardan yazılır (E: envanter, V: Vikipedi, G: kaynaksız genel kavram).
// Kartların doğruluğunu insan editör onaylar; kalfa yalnızca taslak üretir.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dalisUretici, dalisSohbet, dalisAyarlari } from "./dalis-uretim.js";

const UYDU_DUZEYLERI = [6, 9, 12, 14, 16, 18];
const CAPRAZ = [0.3, 0.3, 0.4];          // ortak noktası olmayan iki kare arasında yumuşak geçiş
const MAKS_KOL = 5;

export const DALIS_SISTEM = `Sen Lonca platformunun "dalış kalfası"sın. Bir vakıf eseri için kaydırarak gezilen, uydudan eserin içine inen bir gezi ("dalış") planlarsın. Planını yalnızca JSON olarak verirsin; görüntüleri ve uydu inişini platform üretir.

# Gezinin yapısı
1. Uydu inişi: platform kendisi yapar (Dünya → şehir → eser).
2. Dış duraklar: eserin gerçek fotoğraflarından 1–3 tanesi, uzaktan yakına sıralı (önce hava/uzak, sonra cephe).
3. Giriş (isteğe bağlı): son dış fotoğrafın ortasından kapıya/eşiğe yaklaşan bir canlandırma karesi.
4. Merkez: eserin içini (ya da avlusunu) gösteren GENİŞ bir canlandırma karesi. Yalnızca gerçek fotoğrafların desteklediği planı ve öğeleri kullan; referansta olmayan yeni mimari ayrıntı ekleme.
5. Kollar: 0–${MAKS_KOL} ayrıntı. Yalnızca hem kaynak metninde açıkça geçen hem de gerçek fotoğrafta seçilebilir olan ayrıntıları seç. Kaynakta desteklenmiyorsa kol üretme; az ama doğru durak, çok ama uydurma duraktan iyidir. Her kol için kaynakta aynen geçen kısa bir "kanıt" alıntısı ver.
6. Çıkış: platform kendisi yapar (gökyüzüne yükseliş).

# Bilgi kartları (bakışlar)
- Her durakta en çok 3 kart. Kart: { "u": üst etiket (en çok 20 harf), "b": başlık (en çok 45 harf), "m": metin (en çok 230 harf, sıcak ve sade Türkçe), "k": kaynak ("E" veya "V"), "kanit": ilgili kaynaktan aynen kopyalanmış 20–100 harflik kısa parça, "nerede": isteğe bağlı, gerçek fotoğrafta görülebilen şeyin İngilizce kısa tarifi }.
- "E" yalnızca ENVANTER, "V" yalnızca VİKİPEDİ. Her kartta "kanit" ZORUNLU; alıntı ilgili kaynakta kelimesi kelimesine bulunmalı. Karttaki ad, kişi ve sayılar bu alıntıyla desteklenmeli. Kaynakta açıkça bulunmayan bilgi, çıkarım veya efsaneyi yazma; emin değilsen kartı çıkar.
- "G" yalnızca vakıf, vakfiye, bani, külliye, imaret, kitabe, mihrap, minber, mahfil, şadırvan, revak, kubbe, kasnak, mukarnas, taç kapı, kavsara, söve, şebeke, çini, türbe, sanduka, hazire, han, bedesten, medrese, darüşşifa, tekke ve zaviye gibi genel kavramları tanımlamak için kullanılabilir. Platform tanımı uygular; G kartına tarih, kişi, sayı ya da bu esere özgü iddia koyma.
- "nerede" yalnızca verilen GERÇEK fotoğrafta açıkça görünen bir şey için yazılır. YZ ile üretilmiş karede sonradan uydurulan ayrıntıyı kanıt gibi anlatma.
- Kaynakta varsa bani, mimar, yapım tarihi, vakfın hizmeti/gelir bağı, onarım veya dönüşüm ve bugünkü kullanım bilgilerini kısa kartlara dağıt; özellikle bani, tarih ve vakıf boyutunu atlama. Kaynakta yoksa ekleme.
- İnsan hikâyesi varsa kaynağın ölçülü dilinde aktar; ölüm, savaş veya dinî bilgiyi dramatize etme.

# Görüntü istemleri (İngilizce)
- "onek": bütün görüntülere eklenecek tarz cümlesi: "Photorealistic, high-resolution documentary architectural photograph of the <eserin İngilizce adı/tarifi> in <şehir>, Turkey (<yüzyıl> century). Natural light, crisp detail. No people, no text, no captions, no watermark."
- Dış durakta "genislet": fotoğrafın dikey kareye genişletilirken üstüne/altına ne geleceği (gökyüzü, ağaçlar, avlu taşları…). Ana yapıyı tekrar çizdirme.
- "giris.istem": son dış fotoğrafın ortasındaki kapıya/girişe yaklaşan dikey kare.
- "merkez.istem": geniş, dikey, simetrik bir iç mekân/avlu karesi; her kolun nesnesini konumuyla birlikte say ("in the lower centre the marble fountain; on the left pier a framed calligraphy panel; in the background right the wooden pulpit…"). Fotoğraflarda iç mekân varsa ona sadık kal.
- "kollar[].aranacak": nesnenin merkez karede bulunması için İngilizce kısa tarif. "kollar[].istem": o nesnenin yakın çekimi (aynı konum ve kompozisyon, çok daha yakın ve net).

# Çıktı (yalnızca JSON)
{
  "ozet": "Lobide görünecek tek cümle",
  "onek": "...",
  "dis": [ { "foto": 1, "baslik": "...", "yazi": "alt|ust", "genislet": "...", "bakislar": [ ... ] } ],
  "giris": { "istem": "...", "baslik": "...", "bakislar": [ ... ] } | null,
  "merkez": { "istem": "...", "foto": null | iç mekân fotoğrafının numarası, "baslik": "...", "bakislar": [ ... ] },
  "kollar": [ { "baslik": "...", "aranacak": "...", "istem": "...", "k": "E|V", "kanit": "kaynakta aynen geçen kısa alıntı", "bakislar": [ ... ] } ]
}
"yazi": görüntünün alt kısmı önemliyse "ust" (kart üstte durur).

# Ustanın isteği
Gezi ustanın isteğinden doğar: istediği ayrıntıları kol yap, istediği konuyu (ör. ipek ticareti, hat sanatı, banisi) kartlarda öne çıkar, istediği uzunluğa ve tona uy. İstek kaynaklarla çelişirse ya da kaynaklarda olmayan bir bilgi isterse kaynağa sadık kal; uydurma.`;

export const ISTEK_SISTEM = `Sen Lonca'nın dalış kalfasısın. Usta bir vakıf eseri için kaydırmalı gezi ("dalış") istiyor. Verilen aday eserlerden ustanın kastettiğini seç ve isteğini planlama için özetle. Yalnızca JSON ver:
{ "eser": "<aday id'si ya da null>", "neden": "kısa Türkçe gerekçe", "odak": "ustanın istediği ayrıntılar, konu, uzunluk ve ton (Türkçe, en çok 400 harf)" }
Hiçbir aday isteğe uymuyorsa ya da istek bir eser belirtmiyorsa "eser": null ver ve "neden" alanında ustaya hangi bilgiyi yazması gerektiğini söyle.`;

const katla = (s) => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9 ]/g, " ");
const DOLGU = new Set("bir bu su ve ile icin icine dalis dalisi yap hazirla olustur gezi gezisi anlat anlatan istiyorum lutfen ne nasil olsun daha cok az".split(" "));
function adaylar(eserler, istek, adet = 15) {
  const kelimeler = katla(istek).split(/\s+/).filter((k) => k.length > 2 && !DOLGU.has(k));
  return eserler
    .filter((e) => Array.isArray(e.fotograflar) && e.fotograflar.length)
    .map((e) => {
      const ad = katla(e.ad), yer = katla(`${e.il} ${e.ilce ?? ""} ${e.tur}`);
      let puan = 0;
      for (const k of kelimeler) {
        if (ad.split(/\s+/).includes(k)) puan += 3;
        else if (ad.includes(k) || k.includes(ad.split(/\s+/)[0] ?? "--")) puan += 1.5;
        if (yer.includes(k)) puan += 0.5;
      }
      if (katla(istek).includes(ad)) puan += 6;
      return { e, puan };
    })
    .filter((x) => x.puan > 0)
    .sort((a, b) => b.puan - a.puan || (b.e.fotograflar.length - a.e.fotograflar.length))
    .slice(0, adet).map((x) => x.e);
}

const kisalt = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const kenet = (x, a, b) => Math.min(b, Math.max(a, x));

function jsonCikar(metin) {
  try { return JSON.parse(metin); } catch {}
  const parca = String(metin).match(/\{[\s\S]*\}/);
  try { return parca ? JSON.parse(parca[0]) : null; } catch { return null; }
}

function mesafe(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function vikipedi(eser) {
  const api = (p) => fetch(`https://tr.wikipedia.org/w/api.php?${new URLSearchParams({ ...p, format: "json", formatversion: "2" })}`, { headers: { "User-Agent": "lonca-dalis-kalfasi/1" }, signal: AbortSignal.timeout(20_000) }).then((y) => y.json());
  const ara = await api({ action: "query", list: "search", srsearch: `${eser.ad} ${eser.il ?? ""}`, srlimit: "6" });
  // Arama sonuçlarından eser adına en çok uyan başlık (ör. "Yeşil Türbe" ararken "Yeşil Cami" seçilmesin).
  const kelimeler = katla(eser.ad).split(/\s+/).filter((k) => k.length > 1);
  const puanla = (baslik) => {
    const b = katla(baslik).split(/\s+/);
    const ortak = kelimeler.filter((k) => b.includes(k)).length;
    return ortak / kelimeler.length - (b.length - ortak) * 0.05 + (katla(baslik).includes(katla(eser.il ?? "-")) ? 0.05 : 0);
  };
  const adaylar = (ara?.query?.search ?? []).map((x) => ({ baslik: x.title, puan: puanla(x.title) })).sort((a, b) => b.puan - a.puan);
  const baslik = adaylar[0]?.puan >= 0.6 ? adaylar[0].baslik : null;
  if (!baslik) return null;
  const sayfa = (await api({ action: "query", prop: "extracts|coordinates|info", inprop: "url", explaintext: "1", redirects: "1", titles: baslik }))?.query?.pages?.[0];
  if (!sayfa?.extract) return null;
  const metin = sayfa.extract.replace(/\n== (Kaynakça|Dış bağlantılar|Galeri|Fotoğraflar|Ayrıca bakınız|Notlar) ==[\s\S]*?(?=\n== |$)/g, "").slice(0, 9000);
  const k = sayfa.coordinates?.[0];
  return { baslik: sayfa.title, url: sayfa.fullurl, metin, konum: k ? { lat: k.lat, lng: k.lon } : null };
}

// Görsel modelden kutular: [{ ad, kutu: [x, y, w, h] }] (0–1, sol üst köşe). Model anahtarları değiştirirse sıra kullanılır;
// 0–1000 ölçeğinde koordinat dönerse ölçeklenir.
async function konumBul(yol, nesneler, ortam, gunluk = () => {}) {
  if (!nesneler.length) return [];
  const { metin, model } = await dalisSohbet({
    ortam, maks: 1500, zamanAsimi: 90_000, gorseller: [yol],
    metin: `Find these objects in the image and return ONLY JSON: {"kutular":[{"ad": "<key>", "kutu":[x,y,w,h]}]} where "ad" is EXACTLY the given key (e.g. "${nesneler[0].ad}"), x,y,w,h are fractions (0-1) of image width/height and (x,y) is the top-left corner. Omit objects that are not visible.\nObjects:\n${nesneler.map((n) => `- "${n.ad}": ${n.tarif}`).join("\n")}`,
  });
  const j = jsonCikar(metin);
  const ham = Array.isArray(j?.kutular) ? j.kutular : Array.isArray(j) ? j : [];
  const sonuc = ham.map((k, i) => {
    let kutu = Array.isArray(k?.kutu) ? k.kutu.map(Number) : Array.isArray(k?.box) ? k.box.map(Number) : null;
    if (!kutu || kutu.length !== 4 || !kutu.every(Number.isFinite)) return null;
    if (kutu.some((v) => v > 1.5)) kutu = kutu.map((v) => v / 1000);
    const ad = nesneler.some((n) => n.ad === String(k.ad)) ? String(k.ad) : (ham.length === nesneler.length ? nesneler[i].ad : String(k.ad));
    return { ad, kutu: kutu.map((v) => kenet(v, 0, 1)) };
  }).filter((k) => k && k.kutu[2] > 0.005 && k.kutu[3] > 0.005);
  if (!sonuc.length) gunluk(`  Görsel model (${model}) yer bulamadı: ${kisalt(metin, 200)}`);
  return sonuc;
}

const GENEL_BILGI = new Map([
  ["kubbe", "Yapının üstünü örten yarım küre biçimli örtü."],
  ["vakif", "Bir mülkün gelirinin, sahibinin mülkiyetinden çıkarılarak kalıcı biçimde bir hayır işine ayrılması; bu düzenle kurulan kurum."],
  ["vakfiye", "Vakfın kuruluş belgesi: vakfedilen mülkleri, gelirin nereye harcanacağını ve görevlileri yazar."],
  ["bani", "Bir yapıyı yaptıran kişi (mimar değil)."],
  ["mutevelli", "Vakfı vakfiyeye göre yöneten görevli."],
  ["kulliye", "Cami çevresinde medrese, imaret, hamam, türbe gibi yapılardan oluşan, aynı vakıfla yaşayan yapı topluluğu."],
  ["imaret", "Külliyede yoksullara, öğrencilere ve yolculara yemek dağıtılan aşevi."],
  ["kitabe", "Yapının üzerindeki, çoğu zaman yapım tarihini ve baniyi bildiren yazıt."],
  ["mihrap", "Kıble yönünü gösteren duvar nişi."],
  ["minber", "İmamın cuma ve bayram hutbesini okuduğu, merdivenli yüksek kürsü."],
  ["vaaz kursusu", "Vaizin oturarak vaaz verdiği kürsü."],
  ["mahfil", "Cami içinde yükseltilmiş, belli bir topluluğa ayrılmış bölüm (müezzin mahfili, hünkâr mahfili)."],
  ["son cemaat yeri", "Caminin girişindeki revaklı bölüm; geç kalanların namaz kıldığı yer."],
  ["sadirvan", "Abdest almak için çevresinde musluklar bulunan su yapısı."],
  ["revak", "Sütun ya da ayaklara oturan kemerlerle önü açık, üstü örtülü galeri."],
  ["avlu", "Yapının ortasındaki ya da önündeki açık alan."],
  ["kasnak", "Kubbenin oturduğu silindirik ya da çokgen gövde."],
  ["pandantif", "Kare bir mekândan yuvarlak kubbeye geçişi sağlayan öğe."],
  ["tromp", "Kare bir mekândan yuvarlak kubbeye geçişi sağlayan öğe."],
  ["turk ucgeni", "Kare bir mekândan yuvarlak kubbeye geçişi sağlayan öğe."],
  ["mukarnas", "Kademeli, peteği andıran nişlerden oluşan süsleme; taç kapı ve başlıklarda görülür."],
  ["tac kapi", "Anıtsal yapılarda yüksek, bezemeli giriş cephesi."],
  ["kavsara", "Taç kapının üst kısmındaki yarım kubbe ya da mukarnaslı niş."],
  ["sove", "Kapı ve pencere boşluğunu çevreleyen çerçeve."],
  ["sebeke", "Pencerelerdeki demir ya da taş kafes."],
  ["almasik duvar", "Taş ve tuğla sıralarının dönüşümlü örüldüğü duvar tekniği."],
  ["kundekari", "Çivi ve tutkal kullanmadan, geometrik parçaları birbirine geçirerek yapılan ahşap işçiliği."],
  ["cini", "Sırlı, desenli seramik kaplama."],
  ["renkli sir", "Renklerin birbirine karışmaması için aralarına ayırıcı bir madde çekilerek yapılan çini tekniği."],
  ["cuerda seca", "Renklerin birbirine karışmaması için aralarına ayırıcı bir madde çekilerek yapılan çini tekniği."],
  ["sulus", "Hat yazı türü: iri ve anıtsal."],
  ["talik", "Hat yazı türü: eğik ve akıcı."],
  ["turbe", "Önemli bir kişinin mezarının üzerine yapılan anıtsal yapı."],
  ["sanduka", "Mezarın üzerindeki sandık biçimli anıtsal üst yapı."],
  ["hazire", "Cami ya da türbe çevresindeki çevrili mezarlık."],
  ["han", "Tüccarların konakladığı, mallarını sakladığı ve ticaret yaptığı, çoğunlukla avlulu yapı."],
  ["bedesten", "Değerli malların saklanıp satıldığı, kalın duvarlı, kubbeli çarşı yapısı."],
  ["medrese", "Yükseköğretim kurumu; avlu çevresinde öğrenci odaları ve dershaneden oluşur."],
  ["darussifa", "Hastane."],
  ["tekke", "Bir tarikatın toplandığı, yolcuları da ağırlayan yapı."],
  ["zaviye", "Bir tarikatın toplandığı, yolcuları da ağırlayan yapı."],
]);

const rakamlar = (s) => [...String(s ?? "").matchAll(/\d+(?:[.,]\d+)?/g)].map((x) => x[0].replace(",", "."));
const SAYI_SOZ = new Set("bir iki üç dört beş altı yedi sekiz dokuz on yirmi otuz kırk elli altmış yetmiş seksen doksan yüz bin".split(" ").map(katla));
const BUYUK_HARF_ISTISNA = new Set("Bu Bir Burada Buradan Şimdi Her İçeride Gezi Ama Ancak Böylece Ayrıca İki Üç Dört Beş Altı Yedi Sekiz Dokuz On Yirmi Kırk Yüz Bin Kare Kıble Hat İslam Kur'an".split(" "));

function olgular(metin) {
  const sayilar = rakamlar(metin);
  const sozler = katla(metin).split(/[^a-z0-9]+/).filter((kelime) => SAYI_SOZ.has(kelime));
  const adlar = [];
  for (const cumle of String(metin ?? "").split(/(?<=[.!?:;"“”])\s+/)) {
    for (const [i, kelime] of cumle.split(/\s+/).entries()) {
      const temiz = kelime.replace(/^[“"(«]+|[”")»,.;:!?]+$/g, "");
      if (i === 0 || !/^[A-ZÇĞİÖŞÜÂÎÛ]/.test(temiz) || BUYUK_HARF_ISTISNA.has(temiz)) continue;
      adlar.push(temiz.split(/['’]/)[0]);
    }
  }
  return { sayilar, sozler, adlar: [...new Set(adlar)].filter((ad) => ad.length > 2) };
}

function ifadeGeciyor(metin, ifade) {
  const kaynak = katla(metin), aranan = katla(ifade);
  if (kaynak.includes(aranan)) return true;
  const govde = aranan.slice(0, Math.max(4, aranan.length - 3));
  return govde.length >= 4 && kaynak.includes(govde);
}

function iddialarAlintidaMi(baslik, metin, kanit) {
  const m = olgular(metin), b = olgular(baslik);
  const alintiMetni = katla(kanit);
  return [
    ...m.sayilar, ...b.sayilar,
  ].every((sayi) => alintiMetni.includes(katla(sayi)))
    && [...m.sozler, ...b.sozler].every((sayi) => alintiMetni.split(/[^a-z0-9]+/).includes(sayi))
    && m.adlar.every((ad) => ifadeGeciyor(kanit, ad));
}

export function kaynakKaniti(kaynak, kanit, kaynakMetinleri = {}) {
  if (kaynak !== "E" && kaynak !== "V") return false;
  const alinti = katla(kisalt(kanit, 100));
  const metin = katla(kaynakMetinleri[kaynak]);
  return alinti.length >= 20 && !!metin && metin.includes(alinti);
}

export function bakislariTemizle(liste, izinliKaynak, kaynakMetinleri = {}) {
  return (Array.isArray(liste) ? liste : []).slice(0, 4).flatMap((ham) => {
    const k = ham?.k;
    if (!izinliKaynak.has(k)) return [];
    if (k === "G") {
      const sozluk = GENEL_BILGI.get(katla(ham?.b));
      return sozluk ? [{ u: kisalt(ham?.u, 24), b: kisalt(ham?.b, 60), m: sozluk, k: "G" }] : [];
    }
    if (!kaynakKaniti(k, ham?.kanit, kaynakMetinleri)) return [];
    const metin = kisalt(ham?.m, 300), baslik = kisalt(ham?.b, 60);
    const alinti = kisalt(ham?.kanit, 100);
    if (!metin || !iddialarAlintidaMi(baslik, metin, alinti)) return [];
    return [{ u: kisalt(ham?.u, 24), b: baslik, m: metin, k, nerede: ham?.nerede ? kisalt(ham.nerede, 120) : undefined }];
  });
}

// Dalış üretimi dış araçlara dayanır (ffmpeg/ffprobe kırpma ve ölçek için, python3 + Pillow karo dikme için).
// Biri eksikse iş dakikalar sonra "spawnSync ffprobe ENOENT" ile düşmesin diye en başta denetlenir.
const ARACLAR = [
  ["ffmpeg", ["-version"], "ffmpeg (macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg · Windows: winget install Gyan.FFmpeg)"],
  ["ffprobe", ["-version"], "ffprobe (ffmpeg ile birlikte kurulur)"],
  ["python3", ["-c", "import PIL"], "python3 ve Pillow (pip3 install Pillow)"],
];
export function eksikAraclar() {
  return ARACLAR.filter(([komut, arg]) => { try { execFileSync(komut, arg, { stdio: "ignore", timeout: 15_000 }); return false; } catch { return true; } })
    .map(([, , tarif]) => tarif);
}

export function dalisKalfasiKur({ kok, eserler, dalisDizini = path.join(kok, "data", "dalislar"), ortam = process.env }) {
  const isler = new Map();
  let etkin = null;
  const hazir = () => { const a = dalisAyarlari(ortam); return !!(a.api && a.anahtar); };

  function baslat({ istek = "", eserId = null, uzerineYaz = false }) {
    if (!hazir()) throw Object.assign(new Error("Dalış kalfası için .env'de DALIS_API_URL ve DALIS_API_ANAHTARI gerekli"), { kod: 503 });
    const eksik = eksikAraclar();
    if (eksik.length) throw Object.assign(new Error(`Dalış kalfası için bu bilgisayarda şu araçlar eksik: ${eksik.join("; ")}. Kurup sunucuyu yeniden başlat.`), { kod: 503 });
    if (etkin) throw Object.assign(new Error("Kalfa şu an başka bir dalış hazırlıyor; bitince tekrar dene"), { kod: 409 });
    if (eserId && !eserler.some((e) => e.id === eserId)) throw Object.assign(new Error("eser bulunamadı"), { kod: 404 });
    if (!eserId && !String(istek).trim()) throw Object.assign(new Error("Kalfaya ne istediğini yaz"), { kod: 400 });
    const is = { id: randomUUID(), istek: kisalt(istek, 1000), eser: eserId, ad: null, durum: "calisiyor", adim: 0, toplamAdim: 7, gunluk: [], basla: Date.now() };
    isler.set(is.id, is);
    etkin = is;
    (async () => {
      const { eser, odak } = await istegiCoz(is, eserId);
      const tanimYolu = path.join(dalisDizini, `${eser.id}.json`);
      if (existsSync(tanimYolu) && !uzerineYaz && JSON.parse(readFileSync(tanimYolu, "utf8")).durum === "onayli")
        throw new Error(`${eser.ad} için yayında bir dalış var; yenisini yapmak için önce Dalışlar listesinden onu kaldır`);
      return calistir(is, eser, kisalt(odak, 1000), tanimYolu);
    })()
      .then((sonuc) => { is.durum = "bitti"; is.sonuc = sonuc; yaz(is, `Hazır: ${sonuc.kareSayisi} durak. Studio'da inceleyip onayla.`); })
      .catch((h) => { is.durum = "hata"; is.hata = h.message; yaz(is, `Hata: ${h.message}`); })
      .finally(() => { etkin = null; is.bitis = Date.now(); });
    return is;
  }

  function yaz(is, metin, adim) {
    if (adim) is.adim = adim;
    is.gunluk.push({ t: Math.round((Date.now() - is.basla) / 1000), metin });
    if (is.gunluk.length > 300) is.gunluk.shift();
  }

  // 0. Ustanın isteğinden eseri ve odağı çıkar
  async function istegiCoz(is, eserId) {
    yaz(is, `İstek: "${is.istek || "(eser seçildi)"}"`, 0);
    let eser = eserId ? eserler.find((e) => e.id === eserId) : null;
    if (eser && !is.istek) { is.eser = eser.id; is.ad = eser.ad; return { eser, odak: "" }; }
    const aday = eser ? [eser] : adaylar(eserler, is.istek);
    if (!aday.length) throw new Error("İstekte adı geçen bir eser bulunamadı (yalnızca fotoğrafı olan eserler için dalış yapılabilir). Eserin adını yaz.");
    yaz(is, `Adaylar: ${aday.slice(0, 6).map((e) => e.ad).join(", ")}${aday.length > 6 ? "…" : ""}`);
    const { metin, model } = await dalisSohbet({
      ortam, sistem: ISTEK_SISTEM, maks: 800,
      metin: `# İSTEK\n${is.istek}\n\n# ADAYLAR\n${aday.map((e) => JSON.stringify({ id: e.id, ad: e.ad, tur: e.tur, il: e.il, ilce: e.ilce, yuzyil: e.yuzyil, foto: e.fotograflar.length })).join("\n")}`,
    });
    const j = jsonCikar(metin);
    eser = aday.find((e) => e.id === j?.eser) ?? null;
    if (!eser) throw new Error(kisalt(j?.neden, 300) || "İstekteki eser anlaşılamadı; eserin adını yaz.");
    is.eser = eser.id; is.ad = eser.ad;
    yaz(is, `Eser: ${eser.ad} (${eser.il}) — ${kisalt(j?.neden, 160)} [${model}]`);
    if (j?.odak) yaz(is, `Odak: ${kisalt(j.odak, 300)}`);
    return { eser, odak: [is.istek, j?.odak].filter(Boolean).join("\n") };
  }

  async function calistir(is, eser, not, tanimYolu) {
    // 1. Kaynaklar
    yaz(is, "Kaynaklar toplanıyor: eser kaydı ve Vikipedi…", 1);
    const viki = await vikipedi(eser).catch(() => null);
    yaz(is, viki ? `Vikipedi: "${viki.baslik}" (${viki.metin.length} harf)` : "Vikipedi'de uygun madde bulunamadı; yalnızca envanter kullanılacak.");
    let hedef = null;
    if (viki?.konum && (!eser.konum || mesafe(viki.konum, eser.konum) < 20_000)) hedef = viki.konum;
    else if (eser.konum) hedef = { lat: eser.konum.lat, lng: eser.konum.lng };
    yaz(is, hedef ? `Uydu hedefi: ${hedef.lat.toFixed(5)}, ${hedef.lng.toFixed(5)} (${viki?.konum ? "Vikipedi" : "eser kaydı"})` : "Konum yok: uydu inişi atlanacak.");

    const fotolar = (eser.fotograflar ?? []).filter((f) => typeof f === "string" && existsSync(path.join(kok, "public", f))).slice(0, 4);
    if (!fotolar.length) throw new Error("Eserin fotoğrafı yok; dalış için en az bir gerçek fotoğraf gerekli");

    // 2. Fotoğrafları tanı
    yaz(is, `${fotolar.length} fotoğraf görsel modelle inceleniyor…`, 2);
    // Her fotoğraf ayrı ve paralel tanınır; biri başarısız olursa gezi yine de sürer.
    const fotoBilgi = await Promise.all(fotolar.map(async (f, i) => {
      try {
        const { metin } = await dalisSohbet({
          ortam, maks: 300, zamanAsimi: 60_000, gorseller: [path.join(kok, "public", f)],
          metin: `This photo shows (part of) the Ottoman heritage building "${eser.ad}" (${eser.tur}). Return ONLY JSON: {"tur":"hava|dis|ic|detay|diger","tarif":"short English description of what is visible"}. "hava" = aerial view, "dis" = exterior from the ground, "ic" = interior, "detay" = close-up detail.`,
        });
        const j = jsonCikar(metin);
        return { no: i + 1, tur: String(j?.tur ?? "diger"), tarif: kisalt(j?.tarif, 200) };
      } catch (h) {
        yaz(is, `  Fotoğraf ${i + 1} tanınamadı (${kisalt(h.message, 80)}), devam ediliyor`);
        return { no: i + 1, tur: "diger", tarif: "" };
      }
    }));
    for (const f of fotoBilgi) yaz(is, `  Fotoğraf ${f.no}: ${f.tur} — ${kisalt(f.tarif, 90)}`);

    // 3. Plan
    yaz(is, "Gezi planlanıyor…", 3);
    const envanter = eser.tarihce?.tr ? kisalt(eser.tarihce.tr, 6000) : "";
    const istem = [
      `# ESER\n${JSON.stringify({ id: eser.id, ad: eser.ad, tur: eser.tur, yuzyil: eser.yuzyil, il: eser.il, ilce: eser.ilce, adres: eser.adres })}`,
      `# ENVANTER (k: "E")\n${envanter || "(tarihçe yok)"}\nKaynak: ${eser.kaynak ?? "Vakıf Katılım"}`,
      `# VİKİPEDİ (k: "V")\n${viki ? `${viki.baslik}\n${viki.metin}` : "(yok — V kartı yazma)"}`,
      `# FOTOĞRAFLAR\n${fotoBilgi.map((f) => `${f.no}. ${f.tur}: ${f.tarif}`).join("\n") || fotolar.map((_, i) => `${i + 1}. (bilinmiyor)`).join("\n")}`,
      not ? `# USTANIN İSTEĞİ\n${not}` : "",
    ].filter(Boolean).join("\n\n");
    // Plan: her metin modeli sırayla denenir; yanıt çözülemez ya da eksikse sıradakine geçilir.
    let plan = null, planYanit = null;
    for (const model of dalisAyarlari(ortam).metinModelleri) {
      try {
        planYanit = await dalisSohbet({ ortam, sistem: DALIS_SISTEM, metin: istem, maks: 16000, zamanAsimi: 240_000, modeller: [model] });
        const aday = jsonCikar(planYanit.metin);
        if (aday?.merkez?.istem && Array.isArray(aday?.kollar)) { plan = aday; break; }
        yaz(is, `  ${model} planı eksik/çözülemedi: ${kisalt(planYanit.metin, 220)}`);
      } catch (h) {
        yaz(is, `  ${model} plan veremedi: ${kisalt(h.message, 160)}`);
      }
    }
    if (!plan) throw new Error("Kalfa geçerli bir plan üretemedi (günlüğe bak)");
    const izinli = new Set(["E", "G", ...(viki ? ["V"] : [])]);
    const kaynakMetinleri = { E: envanter, V: viki?.metin ?? "" };
    const dis = (Array.isArray(plan.dis) ? plan.dis : [])
      .filter((d) => Number.isInteger(d?.foto) && d.foto >= 1 && d.foto <= fotolar.length && ["hava", "dis"].includes(fotoBilgi[d.foto - 1]?.tur))
      .sort((a, b) => (fotoBilgi[a.foto - 1].tur === "hava" ? 0 : 1) - (fotoBilgi[b.foto - 1].tur === "hava" ? 0 : 1))
      .slice(0, 3);
    if (!dis.length) {
      const foto = fotoBilgi.find((f) => f.tur !== "ic" && f.tur !== "detay") ?? fotoBilgi[0];
      dis.push({ foto: foto.no, baslik: "Envanter fotoğrafı", bakislar: [], genislet: false });
      yaz(is, "  Dış görünüş olarak doğrulanmış fotoğraf yok; ayrıntı iddiası olmadan kaynak fotoğraf kullanılacak");
    }
    const adayKollar = plan.kollar.filter((k) => k?.aranacak && k?.istem).slice(0, MAKS_KOL);
    const kollar = adayKollar.filter((k) => kaynakKaniti(k.k, k.kanit, kaynakMetinleri));
    if (kollar.length < adayKollar.length) yaz(is, `  ${adayKollar.length - kollar.length} ayrıntı kaynakta doğrulanamadığı için çıkarıldı`);
    yaz(is, `Plan (${planYanit.model}): ${dis.length} dış durak, ${plan.giris?.istem ? "giriş, " : ""}merkez ve ${kollar.length} kol: ${kollar.map((k) => kisalt(k.baslik, 30)).join(", ")}`);

    const u = dalisUretici({ kok, eser: eser.id, onek: kisalt(plan.onek, 400), ortam, gunluk: (m) => yaz(is, m.trim()) });
    try {
      const kareler = [];
      // 4a. Uydu inişi
      yaz(is, "Uydu inişi hazırlanıyor (Esri World Imagery)…", 4);
      const uydular = hedef ? UYDU_DUZEYLERI.map((z) => ({ ad: `u${z}`, uydu: { lat: hedef.lat, lng: hedef.lng, z } })) : [];
      for (const [i, k] of uydular.entries()) {
        await u.uyduKare(k);
        kareler.push({ g: k.ad, t: "uydu", u: [hedef.lat, hedef.lng, k.uydu.z, 0], p: uydular[i + 1] ? u.uyduPortal(k.uydu, uydular[i + 1].uydu) : CAPRAZ });
      }
      // 4b. Dış duraklar
      for (const [i, d] of dis.entries()) {
        const ad = `d${i + 1}`, kaynak = fotolar[d.foto - 1];
        const netlestir = u.genislik(u.yerel(kaynak)) < 1000;
        let r;
        const genislet = d.genislet !== false;
        try { r = await u.gercekKare({ ad, kaynak, genislet, netlestir, genisletIstem: kisalt(d.genislet, 400) }); }
        catch (h) { yaz(is, `  ${ad}: genişletilemedi (${kisalt(h.message, 80)}), fotoğraf kırpılarak kullanılıyor`); r = await u.gercekKare({ ad, kaynak }); }
        kareler.push({ g: ad, t: r.yz ? "yeniden-cizim" : netlestir ? "netlestirilmis" : genislet ? "genisletilmis" : "gercek", p: CAPRAZ,
           b: kisalt(d.baslik, 60), y: d.yazi === "ust" ? "ust" : undefined, k: bakislariTemizle(d.bakislar, izinli, kaynakMetinleri) });
      }
      // 4c. Giriş
      if (plan.giris?.istem) try {
        const kirp = [0.3, 0.35, 0.4];
        await u.uretilenKare({ ad: "g1", uret: { ref: [{ kare: kareler.at(-1).g, kirp }], istem: `Vertical photo continuing the reference: ${kisalt(plan.giris.istem, 900)}` } });
        kareler.at(-1).p = kirp;
         kareler.push({ g: "g1", t: "canlandirma", p: CAPRAZ, b: kisalt(plan.giris.baslik, 60), k: bakislariTemizle(plan.giris.bakislar, izinli, kaynakMetinleri) });
      } catch { yaz(is, "  Giriş karesi üretilemedi, atlandı"); }
      // 4d. Merkez
      yaz(is, "Merkez karesi üretiliyor…");
      const icFotoNo = Number.isInteger(plan.merkez.foto) ? plan.merkez.foto : 0;
      const icFoto = fotoBilgi.find((f) => f.no === icFotoNo && f.tur === "ic") ? fotolar[icFotoNo - 1] : null;
      if (icFotoNo && !icFoto) yaz(is, "  Merkez için seçilen fotoğraf iç mekân olarak doğrulanmadı; gerçek dış fotoğraf referans alınacak");
      await u.uretilenKare({ ad: "m", uret: { ref: [icFoto || u.kareYolu(kareler.at(-1).g).replace(path.join(kok, "public"), "")], istem: `Vertical wide photo. ${kisalt(plan.merkez.istem, 1400)}` } });

      // 5. Kollar: merkezde yerlerini bul, kırpımdan yakın çekim üret
      yaz(is, "Merkezde ayrıntıların yeri bulunuyor…", 5);
      let kutular = [];
      for (let deneme = 1; kollar.length > 0 && deneme <= 2 && !kutular.length; deneme++) {
        kutular = await konumBul(u.kareYolu("m"), kollar.map((k, i) => ({ ad: `kol${i}`, tarif: k.aranacak })), ortam, (m) => yaz(is, m))
          .catch((h) => { yaz(is, `  Yer bulma denemesi ${deneme} başarısız: ${kisalt(h.message, 80)}`); return []; });
      }
      const bulunan = [];
      for (const [i, kol] of kollar.entries()) {
        const k = kutular.find((x) => x.ad === `kol${i}`);
        if (!k) { yaz(is, `  "${kisalt(kol.baslik, 30)}" merkez karede bulunamadı, atlandı`); continue; }
        const [x, y, w, h] = k.kutu;
        const g = kenet(Math.max(w, h) * 1.7, 0.22, 0.65);
        const kirp = [kenet(x + w / 2 - g / 2, 0, 1 - g), kenet(y + h / 2 - g / 2, 0, 1 - g), Math.round(g * 1000) / 1000].map((v) => Math.round(v * 1000) / 1000);
        try {
          await u.uretilenKare({ ad: `k${i + 1}`, uret: { ref: [{ kare: "m", kirp }], istem: `Vertical photo, much closer view of the same scene as the reference, same position and composition, now sharp and detailed: ${kisalt(kol.istem, 900)}` } });
          bulunan.push({ kol, ad: `k${i + 1}`, kirp });
        } catch (h) { yaz(is, `  "${kisalt(kol.baslik, 30)}" üretilemedi, atlandı`); }
      }
      if (kollar.length && !bulunan.length) yaz(is, "  Ayrıntılar gerçek görselde doğrulanamadı; uydurma yakın çekim yerine merkez karesiyle devam ediliyor");

      const merkezBakis = bakislariTemizle(plan.merkez.bakislar, izinli, kaynakMetinleri);
      if (bulunan.length) merkezBakis.push({ u: "Gezi", b: `${bulunan.length} doğrulanmış ayrıntı`, m: `${bulunan.map((x) => kisalt(x.kol.baslik, 30)).join(", ")}; her birinden sonra bu noktaya döneceğiz.`, k: "" });
      else merkezBakis.push({ u: "Kaynak notu", b: "Burada duruyoruz", m: "Bu eserin kaynaklarında fotoğraftaki ayrıntılarla güvenle eşleştirilebilecek başka bir öğe bulunmadı.", k: "" });
      kareler.at(-1).p = CAPRAZ;
      if (bulunan.length) {
        bulunan.forEach((b, i) => {
          kareler.push({ g: "m", t: "canlandirma", p: b.kirp, b: i === 0 ? kisalt(plan.merkez.baslik, 60) || "İçeride" : `Şimdi: ${kisalt(b.kol.baslik, 45)}`, k: i === 0 ? merkezBakis : undefined });
          const kb = bakislariTemizle(b.kol.bakislar, izinli, kaynakMetinleri);
          if (kb[0] && !kb[0].nerede) kb[0].n = [0.5, 0.5];
          kareler.push({ g: b.ad, t: "canlandirma", c: b.kirp, b: kisalt(b.kol.baslik, 60), k: kb });
        });
        kareler.push({ g: "m", t: "canlandirma", p: CAPRAZ, b: "" });
      } else kareler.push({ g: "m", t: "canlandirma", p: CAPRAZ, b: kisalt(plan.merkez.baslik, 60) || "Eserin merkezinde", k: merkezBakis });

      // 6. İşaretler: "nerede" verilen kartların noktaları
      yaz(is, "Bilgi kartlarının okları yerleştiriliyor…", 6);
      for (const kare of kareler) {
        const istenen = (kare.k ?? []).map((b, j) => ({ b, j })).filter(({ b }) => b.nerede && kare.t !== "canlandirma");
        if (!istenen.length) continue;
        const bulunanlar = await konumBul(u.kareYolu(kare.g), istenen.map(({ b, j }) => ({ ad: `n${j}`, tarif: b.nerede })), ortam).catch(() => []);
        for (const { b, j } of istenen) {
          const k = bulunanlar.find((x) => x.ad === `n${j}`);
          if (k) b.n = [Math.round((k.kutu[0] + k.kutu[2] / 2) * 1000) / 1000, Math.round((k.kutu[1] + k.kutu[3] / 2) * 1000) / 1000];
        }
      }
      for (const kare of kareler) for (const b of kare.k ?? []) delete b.nerede;

      // Çıkış: gökyüzüne
      if (uydular.length) {
        const ters = [...uydular].reverse();
        ters.forEach((k, i) => kareler.push({ g: k.ad, t: "uydu", u: [hedef.lat, hedef.lng, k.uydu.z, 1], c: ters[i + 1] ? u.uyduPortal(ters[i + 1].uydu, k.uydu) : undefined, b: i === 0 ? "Gökyüzüne" : "" }));
      }

      // 7. Kayıt
      yaz(is, "Dalış kaydediliyor (onay bekliyor)…", 7);
      for (const k of kareler) for (const a of Object.keys(k)) if (k[a] === undefined || (Array.isArray(k[a]) && !k[a].length && a === "k")) delete k[a];
      const tanim = {
        eser: eser.id, ozet: kisalt(plan.ozet, 160) || `${eser.ad} gezisi`, hedef, durum: "bekliyor", kaynak: "kalfa",
        vikipedi: viki ? { baslik: viki.baslik, url: viki.url } : null, istek: is.istek || undefined,
        model: { plan: planYanit.model, gorsel: dalisAyarlari(ortam).modeller[0] },
        olusturma: new Date().toISOString(), guncelleme: new Date().toISOString(), kareler,
      };
      mkdirSync(path.dirname(tanimYolu), { recursive: true });
      writeFileSync(tanimYolu, JSON.stringify(tanim, null, 1) + "\n");
      return { eser: eser.id, kareSayisi: kareler.length };
    } finally {
      u.temizle();
    }
  }

  return { hazir, baslat, is: (id) => isler.get(id) ?? null, etkin: () => etkin };
}
