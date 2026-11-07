// Modül kalfası. Sağlayıcı ve model seçimi server/kalfa-ayarlari.js'de:
//   openai-uyumlu → UstaGPT (birincil; USTAGPT_*) ya da KALFA_API_URL'deki başka bir uç nokta
//   anthropic     → Claude (ANTHROPIC_API_KEY)
import Anthropic from "@anthropic-ai/sdk";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { kalfaSaglayicisi, secimOku } from "./kalfa-ayarlari.js";
import { ESER_TURLERI } from "./dogrulama.js";
import { DIS_KAYNAK_ADI, vikipediAra, vikipediOku, vikipediIlListesi, adresAnahtari, koddakiDisBaglantilar, kaynaktaDayanakVar, yuzyilKaynaktaVar } from "./dis-kaynak.js";

ts.validateLocaleAndSetLanguage("tr", ts.sys);

const MAKS_DENEME = 3;   
const MAKS_ADIM = 8;     
// Admin turunda il listesi + en çok 12 madde okuma + izin kartı tek tek gelirse 8 adım yetmez.
const MAKS_ADIM_ADMIN = 18;
const MAKS_SATIR = 2000;
// Sağlayıcıya giden tek bir isteğin en uzun süresi (KALFA_ZAMAN_ASIMI_SN ile değişir). Takılan bir model
// Studio'yu dakikalarca bekletmesin diye; 5xx'te yapılan yeniden denemelerin her biri ayrı sayılır.
const ISTEK_ZAMAN_ASIMI_SN = 150;

// Kod yazma kararını model ustanın niyetinden verir (yalnızca "yap" kelimesine bağlı değil). Sunucu yalnızca açıkça
// bir SORU olan ve içinde hiçbir yapım isteği geçmeyen mesajda modul_yaz'ı reddeder: "Koza Han'ı kim yaptırdı?" gibi.
// insaIstegiMi kaba bir sezgidir (sahte kalfa ve bu denetim için); kelime listesi bilerek geniştir.
const INSA_KOKLERI = ["yap", "oluştur", "inşa", "kodla", "hazırla", "üret", "geliştir", "güncelle", "değiştir", "düzelt", "ekle",
  "kaldır", "çıkar", "sil", "dönüştür", "çevir", "uygula", "başla", "devam", "evet", "tamam", "olur", "olsun", "hadi", "haydi", "yaz",
  "kur", "koy", "getir", "göster", "build", "make", "create"];
const SORU_EKLERI = new Set("mı mi mu mü mısın misin musun müsün mıdır midir mudur müdür mıyız miyiz muyuz müyüz mıydı miydi muydu müydü".split(" "));
const SORU_SOZCUKLERI = new Set("ne neden niçin niye nasıl kim kimin kime hangi hangisi nerede nereye nereden kaç neler nedir".split(" "));
export function soruMu(metin) {
  const t = String(metin ?? "").trim();
  if (t.endsWith("?")) return true;
  return t.toLocaleLowerCase("tr").split(/[^\p{L}]+/u).some((k) => SORU_EKLERI.has(k) || SORU_SOZCUKLERI.has(k));
}
// Sunucunun modul_yaz'a izin verip vermediği: soru değilse model karar verir; soruysa içinde bir yapım isteği geçmeli.
export const insaIzniVar = (metin) => !soruMu(metin) || insaIstegiMi(metin);
export function insaIstegiMi(metin) {
  const kelimeler = String(metin ?? "").toLocaleLowerCase("tr").split(/[^\p{L}]+/u).filter(Boolean);
  return kelimeler.some((k) => {
    if (k.startsWith("yapı") && !k.startsWith("yapıl") && !k.startsWith("yapıver")) return false; // yapı, yapıt (bina)
    if (k.startsWith("yazı") || k.startsWith("inşaat")) return false; // yazı, yazıt, inşaat
    if (/^(yap|yaz|kur)(tı|tır|dı|mış|an|ıldı|ılmış|ılan|ılır)/.test(k)) return false; // tarih anlatımı: yaptırdı, yapılmış, yazan
    if (k.startsWith("kur") && !/^kur(alım|ar|sana|ulsun|un|)$/.test(k)) return false; // kurucu, kuruluş, kurşun
    if (k.startsWith("göster") && !/^göster(elim|ir|sin|sene|)$/.test(k)) return false; // gösterilmiş
    return INSA_KOKLERI.some((kok) => k.startsWith(kok));
  });
}

const MAKS_ONERI = 3;
// Modelin önerdiği soru düğmeleri: kısa, tekrarsız, en çok üç.
function onerileriTemizle(liste) {
  if (!Array.isArray(liste)) return [];
  const gorulen = new Set();
  const sonuc = [];
  for (const o of liste) {
    if (typeof o !== "string") continue;
    let t = o.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length > 80) t = `${t.slice(0, 79)}…`;
    const anahtar = t.toLocaleLowerCase("tr");
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    sonuc.push(t);
    if (sonuc.length >= MAKS_ONERI) break;
  }
  return sonuc;
}

// Ustanın dili: İngilizce yazdıysa ya da İngilizce istediyse "en". Kaba bir sezgidir; asıl kararı model verir,
// bu yalnızca öneri üretimine ve yedek önerilere dil ipucu olarak gider.
const INGILIZCE_SOZCUKLER = new Set("the a an and for of to in with about make build create please can you what when who where how is are was were it this that me my i want game guide quiz map kids children".split(" "));
export function ingilizceMi(metin) {
  const t = String(metin ?? "").toLocaleLowerCase("tr");
  if (/\b(ingilizce|english|in english)\b/.test(t)) return !/\b(türkçe|turkish)\b/.test(t);
  if (/[çğışöü]/.test(t)) return false;
  const k = t.split(/[^a-z]+/).filter(Boolean);
  return k.length >= 3 && k.filter((x) => INGILIZCE_SOZCUKLER.has(x)).length / k.length >= 0.25;
}

// Eser türlerinin öneri cümlelerindeki adları.
const TUR_ADLARI = {
  cami: ["camileri", "mosques"], han: ["hanları", "inns"], hamam: ["hamamları", "bathhouses"], medrese: ["medreseleri", "madrasas"],
  cesme: ["çeşmeleri", "fountains"], turbe: ["türbeleri", "tombs"], kulliye: ["külliyeleri", "complexes"], mescit: ["mescitleri", "small mosques"],
  tekke: ["tekkeleri", "dervish lodges"], imaret: ["imaretleri", "soup kitchens"],
};
const karistir = (dizi) => dizi.map((e) => [Math.random(), e]).sort((a, b) => a[0] - b[0]).map(([, e]) => e);

// Bilgi bankasından öneri cümleleri: açılıştaki örnek fikirler ve yapay zekâ öneri veremediğinde yedek.
// Yalnızca eser adı, il ve tür kullanılır (hiçbir tarihî bilgi cümleye girmez).
export function veridenOneriler(eserler, { dil = "tr", kod = false } = {}) {
  const en = dil === "en";
  const fotolu = karistir(eserler.filter((e) => e.fotograflar?.length));
  const e1 = fotolu[0], e2 = fotolu.find((e) => e.tur !== e1?.tur && TUR_ADLARI[e.tur]) ?? fotolu[1];
  if (!e1) return [];
  const ad = (e) => (en ? e.ad_en || e.ad : e.ad);
  const turAdi = (e) => TUR_ADLARI[e.tur]?.[en ? 1 : 0] ?? (en ? "heritage sites" : "vakıf eserlerini");
  if (kod) {
    return en
      ? ["Add achievements to this module", `Add ${ad(e1)} to this module`, "How does this module work?"]
      : ["Bu modüle başarımlar ekle", `${ad(e1)} da bu modülde olsun`, "Bu modül nasıl çalışıyor?"];
  }
  return en
    ? [`A treasure hunt for kids around ${ad(e1)}`, `A night-themed map guide to the ${turAdi(e2)} of ${e2.il}`, `Tell me about ${ad(fotolu[2] ?? e1)}`]
    : [`${ad(e1)} çevresinde çocuklar için bir hazine avı`, `${e2.il} ${turAdi(e2)} gece temasıyla gezdiren haritalı bir rehber`, `${ad(fotolu[2] ?? e1)} hakkında bilgi verir misin?`];
}

// Yetki kipleri: usta yalnızca bilgi bankasıyla çalışır (olmayan eser için admin'e öneri gönderebilir); admin izin vererek
// Vikipedi'den içerik çektirebilir, bilgi bankasına ekletebilir ya da içeriği yalnızca modüle özel tutabilir.
// disFetch: Vikipedi istekleri (testler sahtesini verir); eserEkle: bilgi bankasına kayıt yazan geri çağırma (uygulama.js).
export const IZIN_KARARLARI = { dis_kaynak: ["ver", "reddet"], kayit: ["bilgi-bankasi", "modul", "reddet"] };
const MAKS_DIS_KAYNAK = 12;
const MAKS_TOPLU_KAYIT = 10;
// Karar turunda izinli maddelerin metni kalfaya yeniden verilir (yeniden okumasın diye): madde başına ve toplamda sınır.
const MAKS_MADDE_METNI = 2500;
const MAKS_MADDE_TOPLAMI = 25000;
const MAKS_MODUL_HEDEF = 400;

export function kalfaHazirla({ kok, eserler, iliskiler = [], ortam = process.env, disFetch = (...a) => fetch(...a), eserEkle = null }) {
  const sdkTipleri = readFileSync(path.join(kok, "sdk", "lonca-sdk.d.ts"), "utf8");
  const ornek = (ad) => readFileSync(path.join(kok, "sdk", "ornekler", `${ad}.js`), "utf8");
  const ornekUygulama = ornek("hanlar-rehberi"), ornekOyun = ornek("yuzyil-avi"), ornekTuval = ornek("cini-yakala");
  const iller = [...new Set(eserler.map((e) => e.il))];
  const turler = [...new Set(eserler.map((e) => e.tur))];
  // Sağlayıcı ve model her istekte yeniden çözülür (Studio'daki model seçimi yeniden başlatmadan geçerli olsun).
  const saglayiciAl = () => kalfaSaglayicisi(ortam, secimOku(ortam));
  saglayiciAl(); // yanlış yapılandırma sunucu açılırken fark edilsin
  const zamanAsimiMs = (Number(ortam.KALFA_ZAMAN_ASIMI_SN) > 0 ? Number(ortam.KALFA_ZAMAN_ASIMI_SN) : ISTEK_ZAMAN_ASIMI_SN) * 1000;

  // Kapsam satırları: usta istemi bunlarla kurulur; admin istemi aynı satırları admin sürümleriyle DEĞİŞTİRİR (istemDegistir).
  const USTA_KAPSAM = `- KAPSAM: Yalnızca bilgi bankamızdaki (Lonca veritabanı) vakıf eserleri üzerine çalışırsın. İnternetten, ezberinden ya da başka bir kaynaktan bilgi GETİRME; bir eser, kişi, tarih ya da olay hakkında söylediğin her şey eser_ara / eser_bilgisi sonuçlarında aynen geçmeli.`;
  const USTA_BILGI = `- Eserlerle ilgili soruları BİLGİ BANKASINDAN yanıtla: önce eser_ara ile eseri bul, sonra eser_bilgisi ile kaydını (tarihçe, yüzyıl, kaynak, kaynaklı tarihsel bağlar) oku. Bilgi bankasında yoksa "bilgi bankamızda bu bilgi yok" de, tahmin yürütme.`;
  const USTA_YONLENDIRME = `- Usta bilgi bankasında OLMAYAN bir eser (eser_ara boş döner) ya da başka bir konunun BİLGİSİNİ (başka şehirlerin tarihi, ünlüler, güncel olaylar…) isterse onu yapma, modül yazma: bunu kısaca söyle, eser_ara ile bilgi bankasından ona en yakın 2–3 eseri bul (aynı tür, aynı il ya da adı benzeyen), bunları öner ve "Nasıl devam edelim?" diye sor. Bu önerileri "oneriler" alanına da koy. Bir oyun, araç ya da mini uygulama TÜRÜ (ping pong, yılan, bulmaca, çizim, ritim oyunu, sayaç…) istemek konu dışı DEĞİLDİR: onu yönlendirme, isteneni yap ve vakıf eserlerini içine kat (aşağıda "Uygulama içinde uygulama").`;
  const USTA_MODUL_KAPSAMI = `Modül yalnızca bilgi bankasındaki eserlerle çalışır: eserler.getir / eserler.iliskiler'e yalnızca eser_ara ile bulduğun gerçek kimlikleri ver; eserler.liste'de yalnızca kayıtlı il ve türleri kullan.`;
  const USTA_ILLER = `Şu an kayıtlı iller: ${iller.join(", ")}.`;

  const sistem = `Sen Lonca platformunun "kalfa"sısın. Usta (kullanıcı) seninle vakıf eserleri ve Lonca modülleri hakkında konuşur; istediğinde fikrini bir Lonca modülüne dönüştürürsün. Modül, Lonca Android uygulamasının ve web sitesinin İÇİNDE çalışan tam ekran, dokunmatik bir mini uygulamadır: rehber, harita gezisi, bilgi yarışması olabileceği gibi gerçek zamanlı bir oyun (ping pong, yılan, tuğla kırma, sonsuz koşu, ritim, yakalama), bir bulmaca, bir çizim/boyama aracı ya da bambaşka bir deneyim de olabilir. Usta kod bilmeyebilir: ona sade Türkçe ile konuş.

# Uygulama içinde uygulama
- Ustanın istediğini BİREBİR ve oynanabilir/kullanılabilir biçimde yap. "Ping pong" deniyorsa raketi parmakla sürüklenen, topu sekip giden, bilgisayara karşı oynanan gerçek bir ping pong yaz; "yılan" deniyorsa ızgarada büyüyen gerçek bir yılan oyunu yaz. Bir oyun ya da araç isteğini ASLA bilgi yarışmasına, soru-cevaba ya da kart listesine indirgeme; quiz yalnızca usta quiz/yarışma/soru istediğinde yazılır.
- Bunun için SDK'da "tuval" düğümü ve oyun.* vardır: oyun.dongu (saniyede ~60 kare, dt ile), oyun.ciz (dikdörtgen, daire, çizgi, çokgen, yazı, eser fotoğrafı, döndürme), oyun.dokunmalar / oyun.dinle (dokunma, tut-sürükle, çoklu parmak, klavye ok tuşları), oyun.ses (hazır efektler ya da ton), oyun.titres (titreşim), oyun.bekle. Tuvalin cocuklar'ı tuvalin ÜSTÜNDE katmandır (gol kartı, duraklat, oyun sonu). "SDK'da tuval/animasyon/dokunma konumu yok" DEME: var, aşağıdaki sözleşmede ve "Çini Yakala" örneğinde.
- Gerçekten yapılamayan bir parça istenirse (internet üzerinden çok oyunculu, kamera, mikrofon, dış API, dosya yükleme) bunu bir cümleyle söyle ve en yakın GERÇEK karşılığını yap: çok oyunculu yerine bilgisayara karşı ya da aynı telefonda iki kişi (ekranın iki yarısı), kamera yerine eser fotoğrafları… Yerine quiz koyma.
- Vakıf eseri bağlamını isteği BOZMADAN, yaratıcı biçimde kat: her golde/seviyede bilgi bankasından bir eserin gerçek fotoğrafı ve adı tuvalin üstünde kart olarak açılsın, oyunun arka planı ya da toplanan ödüller eser fotoğrafları olsun, seviyeler eserlerin adını taşısın, oyun sonunda kazanılan eserin kaynaklı kısa bilgisi gösterilsin. Eserler oyunun süsü ve ödülüdür; oyunun kendisi istenen oyundur.
- Oyunun kuralları, fiziği, yapay zekâsı (bilgisayar rakibi), zorluk seviyeleri, skor/rekor, duraklatma ve yeniden başlatma senin işindir: eksiksiz yaz. Telefon dikey tutulur: tuvali dikey kur (ör. en 360, boy 640) ve kontrolleri başparmakla rahat oynanacak yere koy.

# Konuşma ve inşa
- Varsayılan iş SOHBETTİR: soruları yanıtla, fikri birlikte geliştir, gerekirse bir iki netleştirici soru sor, modülün nasıl olacağını kısaca öner. Bunu yanit_ver aracıyla yap.
- modul_yaz'ı usta modülün yazılmasını, kurulmasını ya da değiştirilmesini İSTEDİĞİNDE çağır. Bunu tek bir kelimeye bakarak değil, ustanın niyetinden anla; istek her biçimde gelebilir: "yap", "oluştur", "inşa et", "hazırla", "başlayalım", "şunu ekleyelim", "renkler mavi olsun", "haritası da olsun", "bunu kodla", "yazar mısın", senin önerine "evet / olur / tamam / devam" demesi… Mevcut bir modülde istenen her değişiklik de bir yapım isteğidir.
- Usta bir SORU soruyorsa (bir eser, SDK ya da modül nasıl çalışır), bir fikri tartışıyorsa ya da düşüncesini anlatıyorsa kod YAZMA: yanıtla, fikri konuş, planı 2–4 maddede anlat ve hazır olduğunda yazmanı istemesini söyle. Emin değilsen sor.
${USTA_KAPSAM}
${USTA_BILGI}
${USTA_YONLENDIRME}
- SDK ve modül yapımıyla ilgili soruları sözleşmeden yanıtla (aşağıda tamamı var; belirli bir konuyu sdk_bilgisi ile de arayabilirsin); sözleşmede olmayan bir özellik uydurma, yapılamıyorsa dürüstçe söyle.
- DİL: Ustaya onun yazdığı dilde yanıt ver. Usta İngilizce yazıyorsa ya da modülün İngilizce olmasını isterse ("İngilizce yap", "in English") yanıtlarını, önerileri ve modülün BÜTÜN metinlerini (başlık, düğmeler, sorular, açıklamalar, modul_yaz'daki ad/aciklama/aciklama_ustaya) İngilizce yaz. Bilgi bankasının İngilizce alanlarını kullan: eser adı için eser.ad_en || eser.ad, tarihçe için eser.tarihce.en || eser.tarihce.tr (İngilizcesi olmayan eserde Türkçesini göster ve bunu belirt). Ustanın dili tanımadığı bir dil değilse Türkçe varsay.
- Her yanıtta (yanit_ver ya da modul_yaz) "kaynaklar" alanına yanıtında bilgisini kullandığın eserlerin id'lerini, "sdk" alanına dayandığın SDK parçalarını yaz ("eserler.liste", "ekran.uc", düğüm tipi için yalnızca adı: "kapak"). "oneriler" alanına ustanın tek dokunuşla gönderebileceği 2–3 kısa soru ya da istek yaz: sohbetin şimdiki hâline uysun, ustanın ağzından yazılsın, en çok 80 harf; biri genelde modülü yaptırmak ya da geliştirmek olsun.

# Modül kuralları (modul_yaz)
- Tek bir JavaScript dosyası. Yalnızca şu satırla içe aktarma yapılır: import { ... } from "@lonca/sdk";
- Dosya şunu dışa aktarır: export default async function basla() { ... }
- Modül yalıtılmış bir ortamda çalışır: document, window, fetch, localStorage, setTimeout, setInterval, requestAnimationFrame, canvas, Audio gibi tarayıcı API'leri YOKTUR. Her şey SDK ile yapılır: animasyon ve oyun döngüsü için oyun.dongu, çizim için "tuval" düğümü + oyun.ciz, bekleme için oyun.bekle, ses için oyun.ses, kalıcı veri için depo, puan için profil.
- Ekranı uygulama çizer; HTML yazma. Yalnızca sözleşmedeki ekran.* bileşenleri, sahne.ciz düğüm tipleri ve tuvale oyun.ciz ile çizilenler vardır.
- Tarihî bilgi UYDURMA ve dışarıdan getirme. Belirli bir esere ait ad, yüzyıl, tarih, kişi, sayı, tarihçe ve kaynak her zaman SDK'dan gelen eser verisinden okunur. ${USTA_MODUL_KAPSAMI}
- Liste boş gelebilir; bu durumu nazikçe karşıla. Her eserde her bilgi yoktur: ihtiyacın olan alanları sunucuda süz — eserler.liste({ gerekli: ["konum"] }) harita için, { gerekli: ["yuzyil"] } yüzyıl sorusu için, { gerekli: ["fotograf"] } görsel oyunlar için, { tam: true } bütün bilgileri bilinen eserler için. eserler.tamlik(eser) bir eserde neyin bilindiğini söyler.
- Zengin ve ayrıntılı yaz: ustanın fikrini derinlemesine işle (birden çok bölüm, ilerleme, puanlama, başarımlar, kayıtlı rekor…). En fazla ${MAKS_SATIR} satır. Açıklayıcı Türkçe adlar ve kısa yorumlar kullan; ekranları ayrı fonksiyonlara böl.
- id: küçük harf, rakam ve tire (örn. "cesme-avi").

Lonca bir uygulama mağazası gibidir: modül açılınca TÜM EKRAN modülündür, Lonca'dan yalnızca sağ üstte küçük bir kapatma kapsülü kalır. Kullanıcı bir web sayfasında "ileri-geri" gezdiğini değil, ayrı bir uygulamaya/oyuna girdiğini hissetmeli.
Her modülde şunlar ZORUNLU:
1. İlk iş sahne.ayarla({ baslik, tema: { zemin, renk, yazi } }). Temayı konuya göre seç: oyun/gece gezisi → "gece" ya da "koyu"; tarih/arşiv → "parsomen"; ferah rehber → "acik". renk: kobalt | firuze | mercan | altin | zumrut | murdum. yazi: "serif" (zarif) ya da "sans" (oyun gibi).
2. Açılış ekranı bir "kapak" düğümü: tam ekran, eserin gerçek fotoğrafı (eser verilirse), büyük başlık ve alttaki düğmeler (Başla, Koleksiyon…). Oyunlarda lobi budur.
3. Kapak dışındaki her ekranın başında modülün kendi "ust_cubuk"u; derin ekranlarda geri: "geri" ile ← düğmesi. İstisna: oyun sırasında tuval ekranı tek başına (ust_cubuk'suz) tam ekran olabilir; skoru ve canı tuvale çiz, duraklat/menü için tuvalde bir dokunma alanı ya da katman düğmesi koy. Gezinmeyi bir ekran yığınıyla yap (ileri → push, ← → pop). Uygulama ileri/geri geçişleri kendisi canlandırır.
4. Durumu bir nesnede tut; arayüzü durumdan üreten fonksiyonlar yaz; her olaydan sonra sahne.ciz. for await (const olay of sahne.olaylar()) döngüsü bitmez; kullanıcı kapsülden kapatır. Bu yüzden döngüden sonra yazılan yardımcılar "function ad()" olmalı (const/let döngüden sonra hiç tanımlanmaz).
5. Alt sekmeler (sahne.ayarla sekmeler) yalnızca gerçekten 3+ eşdeğer bölüm varsa; çoğu modülde kapak + yığın daha iyidir.
6. ekran.* (soru, kart, uc, harita…) uygulamanın ÜSTÜNDE açılan bir penceredir ve kullanıcı her an kapatabilir: dönüş değeri boş olabilir (soru → { secim: -1, dogru: null }, harita/galeri → null). Asıl deneyimi sahne düğümleriyle kur; pencereleri kısa anlar (3B gezi, tek bir soru) için kullan. Uygulama açılır açılmaz pencere AÇMA.
7. Fotoğraf: eserlerin çoğunda kitaptan gerçek fotoğraflar var (eser.fotograflar). Ayrıntı ekranında "fotograflar" düğümünü kullan; listelerde "eser" düğümü fotoğrafı kendisi gösterir.
8. Bir eserin ayrıntısını gösterdiğin ekranda kaynağı (eser.kaynak) yaz ve "Bir hata mı gördün? Bildir" düğmesiyle ekran.duzeltme(eser) çağır (topluluk düzeltmeleri editör onayına gider).
9. Her ekran boyutuna sığsın (320 px telefondan geniş ekrana): düğümlerde genişlik alanı yoktur, uygulama her düğümü ekran genişliğine yayar. "kapak" ve "afis" ekranın en üstünde, ana sütunda dursun (satır, kart ya da ızgara içine koyma). "izgara"da sutun en çok 2 olsun (3 yalnızca küçük "eser" kartları ya da kısa "istatistik"ler için). "satir"a en çok 2–3 kısa düğme ya da istatistik koy; uzun metni "satir" yerine "sutun"a koy. Başlıklar kısa olsun (kapak başlığı 2–4 sözcük); bağlantı ya da uzun kimlik gibi bölünmeyen metni ekrana yazma.

- Gerçek zamanlı oyunlar (tuval): ekran = [{ tip: "tuval", id, en, boy, cocuklar: katman }]. oyun.dongu((dt) => { girdiyi oku; durumu dt ile ilerlet; çarpışmaları denetle; oyun.ciz(id, k => { k.temizle(...); … }) }). Döngü içinde await ve sahne.ciz KULLANMA (sahne.ciz yalnızca katman değişince: gol, duraklat, oyun sonu; o an oyun.durdur() çağır, devamda oyun.dongu(adim) ile yeniden başlat). Tut-sürükle için her karede const p = oyun.dokunmalar(id)[0]; if (p) raket.x = p.x; (parmak bırakılınca dizi boşalır). Kısa dokunuş/zıplama için oyun.dinle("basla", …), kaydırma (swipe) için "basla"daki konumu "birak"takiyle karşılaştır. Web için ok tuşlarını da destekle: oyun.tus("ArrowLeft"). Vuruşta oyun.ses("vurus") + oyun.titres("hafif"), golde oyun.ses("gol"), oyun sonunda "kazandin"/"kaybettin". Izgara oyunlarında (yılan, mayın, eşleştirme) hücre için oyun.tamSayi(a, b), diziden rastgele öğe için oyun.sec(dizi) kullan (oyun.rastgele ondalıklıdır, dizi indeksi olmaz); ızgara adımını bir sayaçla yap: d.sayac += dt; if (d.sayac >= adimSuresi) { d.sayac = 0; bir hücre ilerle }. Fiziği karesel hıza bağlama, hep "* dt" kullan; topun tünellemesini önlemek için hızı sınırla. Eser fotoğrafını tuvale k.gorsel(eser, x, y, en, boy) ile çiz ya da katmanda "eser" düğümüyle göster.
- Yarışma/quiz oyunlarında (yalnızca istenirse): "sure" ile geri sayım, seri/bonus puanı, sahne.efekt("yildiz") doğruda, "titre" yanlışta, "konfeti" büyük başarıda.
- Her oyunda: depo ile rekor; profil.puanEkle ile oyuncuya puan; lobi (kapak) → oyun → oyun sonu (puan, rekor, "Yeniden").
- basarim.tanimla ile 3–6 başarım; anlamlı anlarda basarim.kazan; bir koleksiyon/başarımlar ekranında "rozet" düğümleri (durumu basarim.liste() ile oku).
- Keşif uygulamalarında: "izgara" içinde "eser" kartları, "secenekler" ile filtre, "girdi" ile arama, gömülü "harita".
- 3B: Yalnızca GERÇEK 3B vardır (Google'ın uydu fotoğraflarından modeli, eserin konumunda). Her ortamda bulunmaz: önce "await ekran.ucVarMi(eser)" ile sor; false ise 3B düğmesi GÖSTERME, 3B'den hiç söz etme. true ise ekran.uc({ eser, duraklar: [{ odak: "genel", metin }, { odak: "yakin", metin }, { odak: "ust", metin }] }) (odaklar: genel, yakin, cati, yan, arka, ust). Kubbe, minare gibi parçalara odaklanılamaz; duraklarda yapının parçalarından değil bakış açısından söz et.
- Tarihsel bağlar hazır veridir: "await eserler.iliskiler()" bütün bağları, "await eserler.iliskiler(eser.id)" bir eserin bağlarını (diger eser ve yon ile) verir. Bağları kendin uydurma, ad benzerliğinden çıkarma; yalnızca bu veriyi kullan. Bağ türleri: kulliye (aynı külliye), bani (aynı bani), mimar (aynı mimar), vakif (bir vakfın geliri), aile (hanedan), ticaret (ticaret ağı), metin (envanterde açıkça anılıyor), komsu (tarihî komşuluk), tipoloji (mimari gelenek). Her bağda baslik ve aciklama vardır.
- Harita düğümünde kaynaklı eserbagi çizmek için baglantilar: [{ id, a: eserId, b: eserId, tur, baslik, aciklama, kaynak }] ver; id verilirse çizgiye dokununca id="bag:<id>" olayı gelir. Bağ çizgisi yol/rota değildir. Şehirler arası ağı yalnızca açık nedensel bağlarla (bani, mimar, vakıf, hanedan, ticaret) kur; tipoloji/metinde anılma/komşuluk tek başına şehirler arası tarihsel bağ sayılmaz. Sis perdesi için sis: { acik: [{ lat, lng, yaricap }], minPiksel?: number } ver; şehir etiketleri için etiketler: [{ lat, lng, metin, alt? }] ver. Bir eserin bağlarını görsel ağ olarak göstermek için "graf" düğümü: { tip: "graf", merkez: eser, iliskiler: [{ eser, tur, baslik, aciklama, kaynak }] }; açıklama ve künyeyi göster, düğüme dokununca { tur:"dokun", id, eser } gelir. Detay ekranında graf + kaynaklı bağ listesi birlikte iyi çalışır.
- Dalışlar: bazı eserlerin uydudan içine inen kaydırmalı gezisi ("dalış") hazırdır: "await dalislar.liste()". Bir dalışı göstermek için "dalis" düğümünü kullan ve sözleşmedeki DalisTanimi açıklamasındaki gibi kareleri DalisKaresi'ne çevir; uydu karelerinin (k.u) bakışları boş gelebilir. dalis düğümü tam ekran kaydırmalıdır: ekranda ondan önce yalnızca "ust_cubuk" olsun, kaynak/düğmeleri cocuklar ile sahnenin sonuna koy. Dalış yoksa (liste boşsa ya da istenen eser listede değilse) bunu söyle; yeni dalışı editörler Studio'daki Dalışlar sekmesinden dalış kalfasıyla hazırlar.
- Metinler kısa, sıcak ve davetkâr. Cevabı ele vermemek için yüzyılı cevaptan SONRA göster.
modul_yaz'da "renk" (ana ekrandaki çini karonun rengi), "ikon" (karodaki çizim; modülün konusuna en yakın eser türü) ve "kategori" (rehber | oyun | gezi | ogren) seç.

# Veri
${USTA_ILLER} Kayıtlı eser türleri: ${turler.join(", ")} (veri setiyle artacak).

\`\`\`ts
${sdkTipleri}
\`\`\`

Örnek 1 — sahne düğümleriyle bir rehber uygulaması:
\`\`\`js
${ornekUygulama}
\`\`\`

Örnek 2 — tuval + oyun.* ile gerçek zamanlı, dokunmatik bir oyun (ping pong, yılan, tuğla kırma… böyle yazılır):
\`\`\`js
${ornekTuval}
\`\`\`

Örnek 3 — bilgi yarışması (YALNIZCA usta yarışma/quiz isterse bu kalıbı kullan):
\`\`\`js
${ornekOyun}
\`\`\`

- eser_ara: Bilgi bankasında hangi eserlerin bulunduğunu öğrenmek için (il, tür ya da ad ile). Usta belirli eserlerden, bir ilçeden ya da "hangi eserler var" gibi bir şeyden söz ediyorsa ÖNCE bunu kullan. Modül yazarken sonuçlar yalnızca eser kimliklerini ve varlığını öğrenmen içindir: ekranda gösterilecek bilgiyi koda elle YAZMA, modül çalışırken eserler.getir / eserler.liste ile oku.
- eser_ara'da "metin" ile tarihçelerin içinde (Türkçe ve İngilizce) arama yapabilirsin: bir kişi, olay ya da kavram geçen eserleri bulmak için ("Mimar Sinan", "kervansaray", "Orhan Gazi").
- eser_bilgisi: Bir eserin bilgi bankasındaki tam kaydı (Türkçe ve İngilizce ad ve tarihçe, yüzyıl, adres, kaynak, kaynaklı tarihsel bağlar). Ustanın bir eserle ilgili sorusunu yanıtlarken kullan.
- sdk_bilgisi: SDK sözleşmesinde (@lonca/sdk) bir konuyu arar ve ilgili tip tanımlarını döndürür ("harita", "basarim", "DalisKaresi").
- yanit_ver: Sohbet yanıtı (kod yok). Kod yazmadığın her turu bununla bitir.
- modul_yaz: Modülü teslim eder; yalnızca usta açıkça istediğinde.

modul_yaz'daki "aciklama_ustaya" alanında ustaya modülün ne yaptığını 1–3 cümleyle anlat. İstediği bir şeyin bir parçası SDK ile gerçekten yapılamıyorsa bunu dürüstçe söyle ve en yakın GERÇEK karşılığını yap (oyun isteğini quiz'e çevirmek karşılık değildir). Harita istenirse harita düğümünü (ya da ekran.harita) kullan.`;

  const USTA_EK = `

# Bilgi bankasında olmayan eser (usta)
- Bu usta admin değil: bilgi bankasına eser ekleyemez, sen de ekleyemezsin ve dışarıdan bilgi getiremezsin. Usta bilgi bankasında olmayan bir eser isterse en yakın eserleri önermenin yanında, bu eserin bilgi bankasına eklenmesi için admin'e öneri gönderebileceğini söyle ve eser_istegi aracıyla öneri kartını hazırla (eserin adı, ili, ustanın kısa notu). Öneriyi usta karttaki düğmeyle kendisi gönderir; eseri admin inceler ve ekler. eser_istegi'nde eser hakkında tarih, kişi gibi bilgi YAZMA.`;

  const ADMIN_EK = `

# ADMİN KİPİ
Bu usta bir admin. Bilgi bankasında olmayan eserlerle, illerle ve bölgelerle de modül yapabilirsin; ama her adımda adminden izin alırsın ve UYDURMAZSIN.
- Bilgi bankasında olmayan bir eser, il ya da bölge istenirse yönlendirme yapma: izin_iste (tur: "dis_kaynak", konu: eserin ya da ilin adı) ile Vikipedi'den bilgi toplamak için izin iste. İzin verilmeden dis_kaynak_liste / dis_kaynak_ara / dis_kaynak_oku çağıramazsın. Admin reddederse bilgi bankasındaki en yakın eserleri öner.
- İzin verilince: bir il ya da bölge istendiyse ÖNCE dis_kaynak_liste (il, isteğe bağlı tur) ile o ildeki tarihî yapıların maddelerini listele; tek bir eser istendiyse dis_kaynak_ara ile maddeyi bul. Sonra uygun maddeleri dis_kaynak_oku ile oku (okuyacağın maddelerin hepsini AYNI yanıtta birlikte çağır; bir oturumda en çok ${MAKS_DIS_KAYNAK} madde; vakıf eserlerine (cami, han, hamam, türbe, çeşme, medrese…) öncelik ver). Yalnızca okuduğun maddede AÇIKÇA geçen bilgiyi kullan; ezberinden ya da başka bir yerden hiçbir ad, tarih, kişi ekleme. Uygun madde yoksa bunu söyle.
- Maddeleri okuduktan sonra içeriğin nereye gideceğini izin_iste (tur: "kayit", konu, kaynak_urller: okuduğun maddelerin adresleri, en çok ${MAKS_TOPLU_KAYIT}) ile TEK kartta sor: bilgi bankasına mı eklensin (herkes kullanır; "doğrulanmamış" işaretlenir, kaynak bağlantısı kayıtta kalır) yoksa yalnızca bu modüle mi özel kalsın. Tek madde için kaynak_url de verebilirsin. İzin her madde için bir eklemeliktir.
- Admin "bilgi bankasına ekle" derse her madde için ayrı bilgi_bankasina_ekle çağır: tarihçe maddedeki cümlelere sadık bir özet (maddede olmayan yıl yazma), yüzyıl yalnızca maddede açıkça geçiyorsa. Konum ve kaynak künyesini sunucu maddeden alır. Sonra modülde o eserleri dönen kimliklerle eserler.getir ile oku.
- Admin "yalnızca bu modüle" derse maddedeki bilgiyi modülün koduna sabit olarak koy: const DIS_ICERIK = [{ ad, metin, kaynak: { ad: "Vikipedi", url: "<okuduğun maddenin adresi>" } }, …]. Bu içeriği gösterdiğin her ekranın başında "Kaynak doğrulanmamış: Vikipedi" yaz ve bağlantıyı göster. Ölçülü ol: madde başına 2–4 kısa bilgi ya da soru, modül en çok ~${MAKS_MODUL_HEDEF} satır.
- Bilgi bankasında "dogrulanmis: false" taşıyan kayıtlar dış kaynaktan gelmiştir; ekranda "Doğrulanmamış (Vikipedi)" ya da "Kaynak doğrulanmamış: <kaynak>" göster. Vakıf Katılım envanterinden gelen kayıtlar "Doğrulanmış vakıf eseri ✓" sayılır.
- Yanıtlarında izin istemek için yanit_ver değil izin_iste kullan; admin kartta bir düğmeye basarak yanıt verir.`;

  // Admin istemi: yalnızca ek yazmak yetmiyor; model temel istemdeki "yalnızca bilgi bankası / kayıtlı iller" satırlarını
  // baskın okuyup bilgi bankasında olmayan bir il (ör. İzmir) için "yalnızca kayıtlı illeri yapabilirim" diyordu.
  const sistemAdmin = istemDegistir(sistem, [
    [USTA_KAPSAM, "- KAPSAM: Bilgi bankası Vakıf Katılım envanteridir (doğrulanmış); önce onunla çalış. Bilgi bankasında olmayan bir eser, il ya da bölge (ör. İzmir) istenirse \"yalnızca kayıtlı illeri yapabilirim\" DEME: önce eser_ara ile bak, eksikse izin_iste (tur: \"dis_kaynak\") ile Vikipedi'den toplamak için izin iste. Ezberinden bilgi GETİRME: bir eser, kişi, tarih ya da olay hakkında söylediğin her şey eser_ara / eser_bilgisi sonuçlarında ya da admin izniyle okuduğun Vikipedi maddesinde (dis_kaynak_oku) aynen geçmeli."],
    [USTA_BILGI, "- Eserlerle ilgili soruları önce BİLGİ BANKASINDAN yanıtla: eser_ara ile eseri bul, eser_bilgisi ile kaydını oku. Bilgi bankasında yoksa tahmin yürütme; aşağıdaki ADMİN KİPİ kurallarıyla dış kaynak için izin iste."],
    [USTA_YONLENDIRME, "- Bir oyun, araç ya da mini uygulama TÜRÜ (ping pong, yılan, bulmaca, çizim…) istemek konu dışı DEĞİLDİR: isteneni yap ve vakıf eserlerini içine kat (\"Uygulama içinde uygulama\"). Vakıf eserleriyle ilgisi olmayan bir konunun BİLGİSİ istenirse modül yazma: bunu kısaca söyle, eser_ara ile bilgi bankasından 2–3 yakın eser öner ve \"Nasıl devam edelim?\" diye sor (önerileri \"oneriler\" alanına da koy). Bilgi bankasında olmayan bir eser, il ya da bölge ise yönlendirme yapma; ADMİN KİPİ'ndeki izin akışını uygula."],
    [USTA_MODUL_KAPSAMI, "Modül bilgi bankasındaki eserlerle çalışır: eserler.getir / eserler.iliskiler'e yalnızca eser_ara ile bulduğun ya da bilgi_bankasina_ekle'nin döndürdüğü gerçek kimlikleri ver; eserler.liste'de yalnızca bilgi bankasındaki il ve türleri kullan. Admin'in \"yalnızca bu modüle\" dediği dış içerik kodda DIS_ICERIK olarak durur (ADMİN KİPİ)."],
    [USTA_ILLER, `Bilgi bankasındaki (doğrulanmış) iller: ${iller.join(", ")}; diğer iller için izinle dış kaynak kullanılabilir.`],
  ]) + ADMIN_EK;
  const sistemUsta = sistem + USTA_EK;

  const araclar = [
    {
      ad: "modul_yaz",
      aciklama: "Lonca modülünü (kod + kimlik bilgileri) teslim eder. Yalnızca usta modülü yazmanı/değiştirmeni açıkça istediğinde.",
      sema: {
        type: "object",
        properties: {
          id: { type: "string", description: "küçük harf, rakam, tire" },
          ad: { type: "string", description: "Uygulamada görünecek kısa ad" },
          aciklama: { type: "string", description: "Uygulamadaki tek cümlelik açıklama" },
          kod: { type: "string", description: "Modülün tam JavaScript kaynağı" },
          aciklama_ustaya: { type: "string", description: "Ustaya sade Türkçe ile ne yapıldığı" },
          renk: { type: "string", enum: ["kobalt", "firuze", "mercan", "altin", "zumrut", "murdum"], description: "Çini karo rengi" },
          ikon: { type: "string", enum: ["cami", "han", "hamam", "medrese", "cesme", "turbe", "genel"], description: "Karodaki çizim" },
          kategori: { type: "string", enum: ["rehber", "oyun", "gezi", "ogren"], description: "Ana ekrandaki kategori: rehber (keşif/bilgi), oyun (gerçek zamanlı oyun, bulmaca ya da yarışma), gezi (harita/rota), ogren (ders/sözlük)" },
          kaynaklar: { type: "array", items: { type: "string" }, description: "Yanıtta bilgisi kullanılan eserlerin id'leri (eser_ara / eser_bilgisi sonuçlarından)" },
          sdk: { type: "array", items: { type: "string" }, description: "Dayanılan SDK parçaları: \"eserler.liste\", \"ekran.uc\", düğüm tipi \"kapak\"…" },
          oneriler: { type: "array", items: { type: "string" }, description: "Ustanın tıklayıp gönderebileceği 2–3 kısa soru/istek (en çok 80 harf)" },
        },
        required: ["id", "ad", "aciklama", "kod", "aciklama_ustaya"],
      },
    },
    {
      ad: "eser_ara",
      aciklama: "Eser veritabanında arama yapar (salt okunur). Eser kimliklerini, adlarını, türlerini, konumlarını döndürür.",
      sema: {
        type: "object",
        properties: {
          il: { type: "string", description: "Örn. İzmir" },
          ilce: { type: "string" },
          tur: { type: "string", description: "cami, han, hamam, medrese, cesme, turbe…" },
          ad: { type: "string", description: "Türkçe ya da İngilizce adda geçen kelime" },
          metin: { type: "string", description: "Tarihçede (Türkçe/İngilizce) ya da adda geçen kelime/ifade: kişi, olay, kavram" },
          limit: { type: "integer", description: "En fazla kaç sonuç (varsayılan 20, en çok 50)" },
        },
      },
    },
    {
      ad: "eser_bilgisi",
      aciklama: "Bir eserin bilgi bankasındaki tam kaydını döndürür (salt okunur): tarihçe, yüzyıl, adres, kaynak ve kaynaklı tarihsel bağlar.",
      sema: {
        type: "object",
        properties: { id: { type: "string", description: "Eser kimliği (eser_ara sonucundan)" } },
        required: ["id"],
      },
    },
    {
      ad: "sdk_bilgisi",
      aciklama: "SDK sözleşmesinde (@lonca/sdk, lonca-sdk.d.ts) bir konuyu arar; ilgili tip tanımlarını ve açıklamalarını döndürür.",
      sema: {
        type: "object",
        properties: { konu: { type: "string", description: "Aranan ad ya da kelime: harita, ekran.uc, basarim, DalisKaresi…" } },
        required: ["konu"],
      },
    },
    {
      ad: "yanit_ver",
      aciklama: "Ustaya sohbet yanıtı verir (kod yazmadan): soruyu yanıtlar, fikri tartışır, plan önerir.",
      sema: {
        type: "object",
        properties: {
          metin: { type: "string", description: "Ustaya sade Türkçe yanıt" },
          kaynaklar: { type: "array", items: { type: "string" }, description: "Yanıtta bilgisi kullanılan eserlerin id'leri (eser_ara / eser_bilgisi sonuçlarından)" },
          sdk: { type: "array", items: { type: "string" }, description: "Dayanılan SDK parçaları: \"eserler.liste\", \"ekran.uc\", düğüm tipi \"kapak\"…" },
          oneriler: { type: "array", items: { type: "string" }, description: "Ustanın tıklayıp gönderebileceği 2–3 kısa soru/istek (en çok 80 harf)" },
        },
        required: ["metin"],
      },
    },
  ];

  const ustaAraclari = [{
    ad: "eser_istegi",
    aciklama: "Bilgi bankasında olmayan bir eserin eklenmesi için ustanın admin'e göndereceği öneri kartını hazırlar (gönderen usta olur). Sohbet yanıtı olarak da kullanılır.",
    sema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "Ustaya sade yanıt: eser bilgi bankasında yok, en yakın eserler şunlar, istersen admin'e eklenmesi için öneri gönderebilirsin" },
        ad: { type: "string", description: "İstenen eserin adı (ustanın yazdığı gibi)" },
        il: { type: "string", description: "Biliniyorsa ili" },
        not: { type: "string", description: "Admin'e kısa not: usta neden istiyor, ne tür bir modül düşünüyor (tarihî bilgi yazma)" },
        kaynaklar: { type: "array", items: { type: "string" } },
        oneriler: { type: "array", items: { type: "string" } },
      },
      required: ["metin", "ad"],
    },
  }];
  const adminAraclari = [
    {
      ad: "izin_iste",
      aciklama: "Admin'den izin ister ve turu bitirir: dış kaynaktan (Vikipedi) bilgi çekmek için (tur dis_kaynak) ya da okunan maddelerin bilgi bankasına mı yalnızca bu modüle mi ekleneceği için (tur kayit; birden çok madde tek kartta). Admin karttaki düğmeyle yanıtlar.",
      sema: {
        type: "object",
        properties: {
          tur: { type: "string", enum: ["dis_kaynak", "kayit"] },
          konu: { type: "string", description: "Eserin ya da konunun adı" },
          soru: { type: "string", description: "Admin'e sade soru (neden dış kaynak gerektiğini, ne ekleneceğini söyle)" },
          kaynak_url: { type: "string", description: "tur kayit için (tek madde): dis_kaynak_oku ile okuduğun maddenin adresi" },
          kaynak_urller: { type: "array", items: { type: "string" }, maxItems: MAKS_TOPLU_KAYIT, description: `tur kayit için (birden çok madde, en çok ${MAKS_TOPLU_KAYIT}): dis_kaynak_oku ile okuduğun maddelerin adresleri; tek kartta sorulur` },
        },
        required: ["tur", "konu", "soru"],
      },
    },
    {
      ad: "dis_kaynak_liste",
      aciklama: "Bir il ya da bölgedeki tarihî yapıların (cami, han, hamam, türbe, çeşme, medrese…) Vikipedi maddelerini listeler: kategori ve arama sonuçlarından tekrarsız en çok 30 başlık ve adres (yalnızca admin dış kaynak izni verdiyse). İl düzeyinde bir istek için dis_kaynak_ara'dan önce bunu kullan.",
      sema: {
        type: "object",
        properties: {
          il: { type: "string", description: "İl ya da bölge adı, Türkçe yazımıyla (ör. \"İzmir\")" },
          tur: { type: "string", enum: ESER_TURLERI, description: "İsteğe bağlı: yalnızca bu tür (ör. \"han\")" },
          dil: { type: "string", enum: ["tr", "en"] },
        },
        required: ["il"],
      },
    },
    {
      ad: "dis_kaynak_ara",
      aciklama: "Vikipedi'de madde arar (yalnızca admin izin verdiyse). Başlık, kısa parça ve adres döndürür.",
      sema: { type: "object", properties: { sorgu: { type: "string" }, dil: { type: "string", enum: ["tr", "en"] } }, required: ["sorgu"] },
    },
    {
      ad: "dis_kaynak_oku",
      aciklama: "Bir Vikipedi maddesinin düz metnini, adresini ve varsa konumunu döndürür (yalnızca admin izin verdiyse). Kullanacağın bilgi yalnızca buradan gelir.",
      sema: { type: "object", properties: { baslik: { type: "string", description: "dis_kaynak_ara'dan gelen madde başlığı" }, dil: { type: "string", enum: ["tr", "en"] } }, required: ["baslik"] },
    },
    {
      ad: "bilgi_bankasina_ekle",
      aciklama: "Okunan Vikipedi maddesinden bilgi bankasına doğrulanmamış bir eser kaydı ekler (yalnızca admin bu madde için 'bilgi bankasına ekle' izni verdiyse). Eklenen eserin kimliğini döndürür.",
      sema: {
        type: "object",
        properties: {
          kaynak_url: { type: "string", description: "Okunan maddenin adresi" },
          ad: { type: "string" }, ad_en: { type: "string" },
          il: { type: "string" }, ilce: { type: "string" },
          tur: { type: "string", enum: ESER_TURLERI },
          yuzyil: { type: "integer", description: "Yalnızca maddede açıkça geçiyorsa (yapım yüzyılı)" },
          adres: { type: "string" },
          tarihce: { type: "string", description: "Maddedeki cümlelere sadık Türkçe tarihçe (en az 2 cümle)" },
          tarihce_en: { type: "string" },
        },
        required: ["kaynak_url", "ad", "il", "tur", "tarihce"],
      },
    },
  ];

  const kucuk = (s) => String(s ?? "").toLocaleLowerCase("tr");
  function eserAra(g = {}) {
    const limit = Math.min(Math.max(Number(g.limit) || 20, 1), 50);
    const metin = kucuk(g.metin).trim();
    const metinde = (e) => [e.ad, e.ad_en, e.tarihce?.tr, e.tarihce?.en].map(kucuk).find((m) => m.includes(metin));
    const bulunan = eserler.filter((e) =>
      (!g.il || kucuk(e.il) === kucuk(g.il)) &&
      (!g.ilce || kucuk(e.ilce) === kucuk(g.ilce)) &&
      (!g.tur || kucuk(e.tur) === kucuk(g.tur)) &&
      (!g.ad || kucuk(e.ad).includes(kucuk(g.ad)) || kucuk(e.ad_en).includes(kucuk(g.ad))) &&
      (!metin || metinde(e)));
    // Metin aramasında eşleşen yerin çevresi de döner: model hangi cümleye dayandığını görsün.
    const parca = (e) => {
      if (!metin) return undefined;
      const kaynak = [e.tarihce?.tr, e.tarihce?.en].find((m) => kucuk(m).includes(metin));
      if (!kaynak) return undefined;
      const i = kucuk(kaynak).indexOf(metin);
      return `…${kaynak.slice(Math.max(0, i - 120), i + metin.length + 160).replace(/\s+/g, " ")}…`;
    };
    return {
      toplam: bulunan.length,
      eserler: bulunan.slice(0, limit).map((e) => ({
        id: e.id, ad: e.ad, ad_en: e.ad_en ?? null, il: e.il, ilce: e.ilce, tur: e.tur, yuzyil: e.yuzyil, adres: e.adres, konum: e.konum,
        ingilizce: !!e.tarihce?.en, ...(e.dogrulanmis === false && { dogrulanmis: false, kaynakTuru: e.kaynakTuru ?? DIS_KAYNAK_ADI }), ...(parca(e) && { parca: parca(e) }),
      })),
    };
  }

  // Modül denetimi için bilgi bankasının o anki kimlik/il/tür kümeleri (eserler Studio'da düzenlenebildiği için her seferinde).
  const bilgiBankasi = () => ({
    idler: new Set(eserler.map((e) => e.id)),
    iller: new Set(eserler.map((e) => e.il)),
    ilceler: new Set(eserler.map((e) => e.ilce).filter(Boolean)),
    turler: new Set(eserler.map((e) => e.tur)),
  });

  // Bilgi bankasından bir eserin kaydı: kalfanın soruları yanıtlarken okuduğu tek kaynak.
  function eserBilgisi(g = {}) {
    const e = eserler.find((x) => x.id === g.id);
    if (!e) return null;
    const baglar = iliskiler.filter((i) => i.a === e.id || i.b === e.id).slice(0, 20).map((i) => {
      const diger = eserler.find((x) => x.id === (i.a === e.id ? i.b : i.a));
      return { diger: diger ? { id: diger.id, ad: diger.ad, il: diger.il } : null, tur: i.tur, baslik: i.baslik, aciklama: i.aciklama, kaynak: i.kaynak };
    });
    return {
      id: e.id, ad: e.ad, ad_en: e.ad_en ?? null, il: e.il, ilce: e.ilce, tur: e.tur, yuzyil: e.yuzyil ?? null, adres: e.adres ?? null, konum: e.konum ?? null,
      tarihce: String(e.tarihce?.tr ?? "").slice(0, 4000), tarihce_en: e.tarihce?.en ? String(e.tarihce.en).slice(0, 4000) : null, kaynak: e.kaynak ?? null, fotografSayisi: e.fotograflar?.length ?? 0, iliskiler: baglar,
      dogrulanmis: e.dogrulanmis !== false, ...(e.dogrulanmis === false && { kaynakTuru: e.kaynakTuru ?? DIS_KAYNAK_ADI, kaynakUrl: e.kaynakUrl ?? null }),
    };
  }

  // SDK sözleşmesinde arama: d.ts üst düzey bloklara (yorumu + interface/type/const) bölünür, konuyu içerenler döner.
  const sdkBloklari = (() => {
    const satirlar = sdkTipleri.split("\n");
    const bloklar = [];
    let parca = [], derinlik = 0;
    for (const s of satirlar) {
      parca.push(s);
      derinlik += (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length;
      if (derinlik <= 1 && /[;}]\s*$/.test(s)) { bloklar.push(parca.join("\n")); parca = []; }
    }
    if (parca.length) bloklar.push(parca.join("\n"));
    return bloklar.filter((b) => b.trim());
  })();
  function sdkBilgisi(g = {}) {
    const konu = kucuk(g.konu).trim();
    if (!konu) return { hata: "konu boş" };
    const terimler = konu.split(/[\s.]+/).filter(Boolean);
    const bulunan = sdkBloklari.filter((b) => terimler.every((t) => kucuk(b).includes(t)));
    let metin = "";
    for (const b of bulunan) { if (metin.length + b.length > 6000) break; metin += `${b}\n`; }
    return bulunan.length ? { bulunan: bulunan.length, tanimlar: metin } : { bulunan: 0, not: "Sözleşmede bu konu yok; bu özellik SDK ile yapılamıyor olabilir." };
  }

  // Yanıtın dayandığı kaynaklar sunucuda kurulur: yalnızca araçların gerçekten döndürdüğü eserler ve sözleşmede bulunan SDK adları.
  const SDK_ALANLARI = new Set(["eserler", "ekran", "sahne", "profil", "basarim", "depo", "dalislar", "oyun"]);
  function sdkAdiGecerli(ad) {
    if (DUGUM_TIPLERI.has(ad)) return true;
    const [alan, uye, fazla] = ad.split(".");
    if (fazla !== undefined || !SDK_ALANLARI.has(alan)) return false;
    if (uye === undefined) return true;
    return /^[A-Za-z_$][\w$]*$/.test(uye) && new RegExp(`\\b${uye.replace(/\$/g, "\\$")}\\s*[(<?:]`).test(sdkTipleri);
  }
  function kaynaklariKur(girdi, izler) {
    const anilan = Array.isArray(girdi?.kaynaklar) ? girdi.kaynaklar.filter((id) => typeof id === "string" && izler.gorulen.has(id)) : [];
    const kimlikler = [...new Set(anilan.length ? anilan : izler.okunan)].slice(0, 8);
    const eserKaynaklari = kimlikler.map((id) => eserler.find((e) => e.id === id)).filter(Boolean)
      .map((e) => ({ id: e.id, ad: e.ad, il: e.il, kaynak: e.kaynak ?? null, ...(e.dogrulanmis === false && { dogrulanmis: false, kaynakTuru: e.kaynakTuru ?? DIS_KAYNAK_ADI, kaynakUrl: e.kaynakUrl ?? null }) }));
    const sdk = [...new Set((Array.isArray(girdi?.sdk) ? girdi.sdk : []).filter((a) => typeof a === "string").map((a) => a.trim().replace(/\(\)$/, "")))]
      .filter(sdkAdiGecerli).slice(0, 10);
    const dis = (izler.disKullanilan ?? []).map((d) => ({ kaynak: d.kaynak, baslik: d.baslik, url: d.url }));
    return { eserler: eserKaynaklari, sdk, ...(dis.length && { dis }) };
  }

  //   baslat(konusma) → durum
  //   iste(durum) → { cagrilar: [{id, ad, girdi}], sonuclariBildir([{id, icerik, hata}]) }
  const adaptorler = {
    anthropic: anthropicAdaptoru,
    "openai-uyumlu": openaiUyumluAdaptor,
  };

  // secenek.model: yalnızca bu istek için başka bir model (model taraması kullanır); secenek.sinyal: iptal.
  // secenek.insa: usta açıkça istemiş sayılır (model taraması doğrudan modül yazdırır).
  // Dönüş: modül yazıldıysa { tur: "modul", kod, … }; sohbet yanıtıysa { tur: "sohbet", metin, … }. İkisinde de kaynaklar ve oneriler.
  // Konuşmanın şimdiki hâline göre sonraki 2–3 öneriyi yapay zekâya ayrıca sordurur (ana yanıt öneri vermediyse).
  // Hata ya da sahte modda bilgi bankasından kurulan önerilere düşer.
  const ONERI_SISTEM = `Lonca Studio'da usta, kalfayla Lonca uygulamasının içinde çalışacak bir modül (mini uygulama ya da oyun; vakıf eserleri temalı) yapıyor. Konuşmaya bakıp ustanın bir sonraki adımda tek dokunuşla gönderebileceği 3 kısa öneri yaz: biri bir soru, biri modülü yaptırmak ya da geliştirmek, biri fikri genişletmek olsun. Ustanın istediği türe sadık kal: oyun istiyorsa oyunu geliştiren öneriler ver (zorluk, bilgisayar rakibi, yeni seviye, eser fotoğraflı ödül, rekor, ses), onu bilgi yarışmasına ya da soru-cevaba çevirmeyi önerme. Ustanın ağzından, ustanın dilinde (Türkçe ya da İngilizce), en çok 80 harf. Yalnızca konuşmada ya da verilen eser listesinde geçen eserlerden söz et; tarih, kişi uydurma. oneri_ver aracıyla ver.`;
  const oneriAraci = [{ ad: "oneri_ver", aciklama: "Önerileri teslim eder.", sema: { type: "object", properties: { oneriler: { type: "array", items: { type: "string" } } }, required: ["oneriler"] } }];
  async function onerileriUret(sohbet, { yanit = "", dil = "tr", kod = false, model, sinyal } = {}) {
    const yedek = () => veridenOneriler(eserler, { dil, kod });
    let saglayici = saglayiciAl();
    if (saglayici.tur === "sahte") return yedek();
    if (model) saglayici = { ...saglayici, model };
    try {
      const ornekEserler = karistir(eserler.filter((e) => e.fotograflar?.length)).slice(0, 8).map((e) => (dil === "en" ? e.ad_en || e.ad : e.ad));
      const ozet = [...sohbet.slice(-6), ...(yanit ? [{ rol: "kalfa", metin: yanit }] : [])]
        .map((m) => `${m.rol === "usta" ? "USTA" : "KALFA"}: ${String(m.metin).slice(0, 1200)}`).join("\n\n");
      const adaptor = adaptorler[saglayici.tur]({ saglayici, sistem: ONERI_SISTEM, araclar: oneriAraci, sinyal, zamanAsimiMs: Math.min(zamanAsimiMs, 45_000) });
      const durum = adaptor.baslat([{ rol: "usta", metin: `# KONUŞMA\n${ozet}\n\n# BİLGİ BANKASINDAN BAZI ESERLER\n${ornekEserler.join(", ")}\n\nDil: ${dil === "en" ? "İngilizce" : "ustanın dili"}${kod ? "\nStudio'da yazılmış bir modül var." : ""}` }]);
      const { cagrilar, metin } = await adaptor.iste(durum);
      const girdi = cagrilar[0]?.girdi ?? jsonCoz(metin);
      const oneriler = onerileriTemizle(Array.isArray(girdi) ? girdi : girdi?.oneriler);
      return oneriler.length ? oneriler : yedek();
    } catch {
      return yedek();
    }
  }

  // secenek.dil: Studio arayüzünün dili ("tr" | "en"); ustanın yazdığı dil ve açık isteği her zaman önce gelir.
  // secenek.admin: istek admin'den (dış kaynak araçları açılır); secenek.izinDurumu: atölye oturumundaki izinler ve
  // okunmuş dış kaynaklar ({ izinler: [], disKaynaklar: [] }). Dönüşteki kalfaDurumu oturuma geri yazılır.
  async function calistir(sohbet, mevcutKod, { model, sinyal, insa = false, dil = "tr", admin = false, izinDurumu = null } = {}) {
    const sonMesaj = sohbet.at(-1)?.metin;
    const insaIzni = insa || insaIzniVar(sonMesaj);
    // Öneri dili: son mesaj İngilizceyse ya da konuşmada İngilizce istendiyse İngilizce.
    const oneriDili = ingilizceMi(sonMesaj) || sohbet.some((m) => m.rol === "usta" && /\b(ingilizce|english)\b/i.test(m.metin)) ? "en" : dil;
    let saglayici = saglayiciAl();
    if (saglayici.tur === "sahte") {
      const s = sahteYanit(sohbet, ornekOyun, { insaIzni: insa || insaIstegiMi(sonMesaj) });
      const ingilizce = oneriDili === "en" && s.tur === "sohbet";
      const oneriler = ingilizce ? [`Build it: ${String(sonMesaj).slice(0, 60)}`, ...veridenOneriler(eserler, { dil: "en" }).slice(0, 2)] : s.oneriler;
      return { ...s, oneriler: oneriler?.length ? oneriler : veridenOneriler(eserler, { dil: oneriDili, kod: !!mevcutKod }), model: "sahte" };
    }
    if (model) saglayici = { ...saglayici, model };
    const durumK = {
      izinler: (izinDurumu?.izinler ?? []).map((i) => ({ ...i })),
      disKaynaklar: (izinDurumu?.disKaynaklar ?? []).map((d) => ({ ...d })),
    };
    const kipAraclari = admin ? [...araclar, ...adminAraclari] : [...araclar, ...ustaAraclari];
    const adaptor = adaptorler[saglayici.tur]({ saglayici, sistem: admin ? sistemAdmin : sistemUsta, araclar: kipAraclari, sinyal, zamanAsimiMs });
    const tamamla = async (sonuc) => (sonuc.oneriler.length ? sonuc : {
      ...sonuc, oneriler: await onerileriUret(sohbet, { yanit: sonuc.metin ?? sonuc.aciklama_ustaya, dil: oneriDili, kod: !!(mevcutKod || sonuc.kod), model, sinyal }),
    });

    const konusma = sohbet.map((m) => ({ ...m }));
    if (mevcutKod) konusma.at(-1).metin += `\n\n(Studio'daki güncel modül kodu:)\n\`\`\`js\n${mevcutKod}\n\`\`\``;
    if (oneriDili === "en" && (ingilizceMi(sonMesaj) || /\b(ingilizce|english)\b/i.test(sonMesaj) || sohbet.some((m) => m.rol === "usta" && /\b(ingilizce|english)\b/i.test(m.metin)))) {
      konusma.at(-1).metin += "\n\n(Ustanın dili İngilizce: yanıtını, aciklama_ustaya'yı, önerileri ve modülün bütün metinlerini İngilizce yaz; eserlerin İngilizce alanlarını kullan.)";
    } else if (dil === "en") konusma.at(-1).metin += "\n\n(Studio arayüzü İngilizce: usta Türkçe yazmadıkça İngilizce yanıtla.)";
    if (insa) konusma.at(-1).metin += "\n\n(Usta modülü şimdi yazmanı istiyor: modul_yaz ile teslim et.)";
    if (admin && (durumK.izinler.length || durumK.disKaynaklar.length)) konusma.at(-1).metin += `\n\n${izinOzeti(durumK)}`;
    const maddeMetni = admin ? izinliMaddeMetinleri(durumK) : "";
    if (maddeMetni) konusma.at(-1).metin += `\n\n${maddeMetni}`;

    const durum = adaptor.baslat(konusma);
    let sonHatalar = [], deneme = 0;
    const aramalar = [];
    const izler = { gorulen: new Set(), okunan: [], disKullanilan: [] };
    const durumuEkle = (sonuc) => (admin ? { ...sonuc, kalfaDurumu: durumK } : sonuc);
    const sohbetYaniti = (girdi, metin, ek = {}) => durumuEkle({
      tur: "sohbet", metin, aramalar, kaynaklar: kaynaklariKur(girdi, izler), oneriler: onerileriTemizle(girdi?.oneriler), model: saglayici.model, ...ek,
    });
    const disIzniVar = () => durumK.izinler.some((i) => i.tur === "dis_kaynak" && i.durum === "verildi");
    const okunanKaynak = (url) => durumK.disKaynaklar.find((d) => adresAnahtari(d.url) === adresAnahtari(url));
    const ayniAdres = (a, b) => adresAnahtari(a) === adresAnahtari(b);
    // Kullanılmamış kayıt izni: her madde için bir ekleme (toplu izinde kullanilanlar listesi tutulur).
    const kayitIzni = (url, karar) => durumK.izinler.find((i) => i.tur === "kayit" && i.durum === "verildi" && i.karar === karar
      && izinUrlleri(i).some((u) => ayniAdres(u, url)) && !(i.kullanilanlar ?? []).some((u) => ayniAdres(u, url)));
    // Koddaki dış kaynak bağlantıları: usta için hiç yok; admin için yalnızca okunmuş ve izin verilmiş maddeler.
    // Yalnızca modüle özel izni verilen maddenin bağlantısı ve "Kaynak doğrulanmamış" uyarısı kodda bulunmalı.
    function disKaynakDenetimi(kod) {
      const hatalar = [];
      const baglantilar = koddakiDisBaglantilar(kod);
      if (!admin) {
        if (baglantilar.length) hatalar.push("Dış kaynak (Vikipedi) içeriği yalnızca admin modüllerinde kullanılabilir; modül yalnızca bilgi bankasındaki eserlerle çalışmalı");
        return hatalar;
      }
      for (const u of baglantilar) {
        const d = okunanKaynak(u);
        const izinli = d && durumK.izinler.some((i) => i.tur === "kayit" && ["verildi", "kullanildi"].includes(i.durum) && i.karar !== "reddet" && izinUrlleri(i).some((x) => ayniAdres(x, d.url)));
        if (!izinli) hatalar.push(`${u}: bu madde okunmadı ya da admin kullanımına izin vermedi`);
      }
      const moduleOzel = durumK.izinler.filter((x) => x.tur === "kayit" && x.durum === "verildi" && x.karar === "modul");
      for (const i of moduleOzel) {
        for (const url of izinUrlleri(i)) {
          if (!baglantilar.some((u) => ayniAdres(u, url))) hatalar.push(`Modüle özel dış içerik (${maddeAdi(i, url)}) kullanılıyor: kaynağın bağlantısını (${url}) koda ve ekrana yaz`);
        }
      }
      if (moduleOzel.length && !/Kaynak doğrulanmamış/i.test(kod)) hatalar.push("Dış kaynaklı içeriği gösterdiğin ekranın başına \"Kaynak doğrulanmamış: Vikipedi\" yaz");
      return hatalar;
    }
    const disKullan = (d) => { if (d && !izler.disKullanilan.some((x) => x.url === d.url)) izler.disKullanilan.push(d); };

    for (let adim = 1; adim <= (admin ? MAKS_ADIM_ADMIN : MAKS_ADIM) && deneme < MAKS_DENEME; adim++) {
      const { cagrilar, metin, sonuclariBildir } = await adaptor.iste(durum);
      if (!cagrilar.length) {
        // Araç çağırmadan düz metinle yanıtlayan modeller: bu bir sohbet yanıtıdır.
        if (metin?.trim()) return tamamla(sohbetYaniti({}, metin.trim()));
        sonuclariBildir([{ id: null, icerik: "Yanıtını bir araç çağrısıyla ver (yanit_ver, eser_ara, eser_bilgisi, sdk_bilgisi ya da modul_yaz).", hata: true }]);
        continue;
      }
      const sonuclar = [];
      let teslim = null, yanit = null;
      for (const c of cagrilar) {
        if (c.ad === "eser_ara") {
          const sonuc = eserAra(c.girdi);
          aramalar.push({ sorgu: c.girdi, bulunan: sonuc.toplam });
          for (const e of sonuc.eserler) izler.gorulen.add(e.id);
          sonuclar.push({ id: c.id, icerik: JSON.stringify(sonuc) });
        } else if (c.ad === "eser_bilgisi") {
          const kayit = eserBilgisi(c.girdi);
          if (kayit) {
            izler.gorulen.add(kayit.id);
            if (!izler.okunan.includes(kayit.id)) izler.okunan.push(kayit.id);
            aramalar.push({ okunan: kayit.id, ad: kayit.ad });
          }
          sonuclar.push(kayit
            ? { id: c.id, icerik: JSON.stringify(kayit) }
            : { id: c.id, hata: true, icerik: `Bilgi bankasında "${c.girdi?.id ?? ""}" kimlikli eser yok; önce eser_ara ile ara.` });
        } else if (c.ad === "sdk_bilgisi") {
          const sonuc = sdkBilgisi(c.girdi);
          aramalar.push({ sdk: String(c.girdi?.konu ?? "").slice(0, 60), bulunan: sonuc.bulunan ?? 0 });
          sonuclar.push({ id: c.id, icerik: JSON.stringify(sonuc) });
        } else if (c.ad === "eser_istegi" && !admin) {
          const m = typeof c.girdi?.metin === "string" ? c.girdi.metin.trim() : "";
          const ad = String(c.girdi?.ad ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
          if (!m || ad.length < 2) { sonuclar.push({ id: c.id, hata: true, icerik: "\"metin\" ve \"ad\" gerekli" }); continue; }
          const istek = { ad, il: String(c.girdi?.il ?? "").trim().slice(0, 40) || null, not: String(c.girdi?.not ?? "").trim().slice(0, 600) || null };
          yanit = sohbetYaniti(c.girdi, m, { eserIstegi: istek });
          sonuclar.push({ id: c.id, icerik: "Öneri kartı ustaya gösterildi." });
        } else if (c.ad === "izin_iste" && admin) {
          const tur = c.girdi?.tur, konu = String(c.girdi?.konu ?? "").trim().slice(0, 120), soru = String(c.girdi?.soru ?? "").trim().slice(0, 1500);
          const hatalar = [];
          if (!IZIN_KARARLARI[tur]) hatalar.push("tur: dis_kaynak | kayit");
          if (konu.length < 2 || !soru) hatalar.push("konu ve soru gerekli");
          // Kayıt izni: tek madde (kaynak_url) ya da birden çok madde (kaynak_urller); her biri okunmuş olmalı.
          const istenen = tur === "kayit"
            ? (Array.isArray(c.girdi?.kaynak_urller) && c.girdi.kaynak_urller.length ? c.girdi.kaynak_urller : [c.girdi?.kaynak_url]).filter((u) => typeof u === "string" && u.trim())
            : [];
          const maddeler = [];
          for (const u of istenen) {
            const k = okunanKaynak(u);
            if (!k) hatalar.push(`${u}: önce dis_kaynak_oku ile oku`);
            else if (!maddeler.some((m) => ayniAdres(m.url, k.url))) maddeler.push(k);
          }
          if (tur === "kayit" && !istenen.length) hatalar.push("kaynak_url ya da kaynak_urller: önce dis_kaynak_oku ile okuduğun maddelerin adreslerini ver");
          if (maddeler.length > MAKS_TOPLU_KAYIT) hatalar.push(`bir kartta en çok ${MAKS_TOPLU_KAYIT} madde`);
          if (hatalar.length) { sonuclar.push({ id: c.id, hata: true, icerik: hatalar.join("; ") }); continue; }
          const tek = maddeler.length === 1 ? maddeler[0] : null;
          const izin = { id: randomUUID().slice(0, 8), tur, konu, soru, durum: "bekliyor", tarih: new Date().toISOString(),
            ...(maddeler.length && { urller: maddeler.map((m) => m.url), maddeler: maddeler.map((m) => ({ url: m.url, baslik: m.baslik, kaynak: m.kaynak })), kullanilanlar: [] }),
            ...(tek && { kaynak_url: tek.url, kaynak: tek.kaynak, baslik: tek.baslik }) };
          durumK.izinler.push(izin);
          for (const m of maddeler) disKullan(m);
          yanit = sohbetYaniti(c.girdi, soru, { izin: { id: izin.id, tur, konu, kaynak_url: izin.kaynak_url, baslik: izin.baslik, kaynak: izin.kaynak, ...(izin.maddeler && { maddeler: izin.maddeler }) } });
          sonuclar.push({ id: c.id, icerik: "İzin kartı admin'e gösterildi." });
        } else if (["dis_kaynak_liste", "dis_kaynak_ara", "dis_kaynak_oku"].includes(c.ad) && admin) {
          if (!disIzniVar()) { sonuclar.push({ id: c.id, hata: true, icerik: "Admin dış kaynak için izin vermedi. Önce izin_iste (tur: dis_kaynak) ile izin iste." }); continue; }
          try {
            if (c.ad === "dis_kaynak_liste") {
              const r = await vikipediIlListesi(c.girdi, disFetch);
              aramalar.push({ dis: `${String(c.girdi?.il ?? "").slice(0, 40)} (il listesi)`, bulunan: r.bulunan ?? 0, kaynak: DIS_KAYNAK_ADI });
              sonuclar.push({ id: c.id, icerik: JSON.stringify(r) });
            } else if (c.ad === "dis_kaynak_ara") {
              const r = await vikipediAra(c.girdi, disFetch);
              aramalar.push({ dis: String(c.girdi?.sorgu ?? "").slice(0, 60), bulunan: r.bulunan ?? 0, kaynak: DIS_KAYNAK_ADI });
              sonuclar.push({ id: c.id, icerik: JSON.stringify(r) });
            } else {
              // Bu oturumda okunmuş madde yeniden çekilmez (zaman ve Vikipedi hız sınırı).
              const baslik = String(c.girdi?.baslik ?? "").trim().toLocaleLowerCase("tr");
              const r = durumK.disKaynaklar.find((d) => d.baslik.toLocaleLowerCase("tr") === baslik && d.dil === (c.girdi?.dil === "en" ? "en" : "tr"))
                ?? await vikipediOku(c.girdi, disFetch);
              if (!r) { sonuclar.push({ id: c.id, hata: true, icerik: "Bu başlıkta bir Vikipedi maddesi yok; dis_kaynak_ara ile doğru başlığı bul." }); continue; }
              if (!okunanKaynak(r.url)) {
                durumK.disKaynaklar.push(r);
                while (durumK.disKaynaklar.length > MAKS_DIS_KAYNAK) durumK.disKaynaklar.shift();
              }
              aramalar.push({ disOkunan: r.baslik, url: r.url, kaynak: DIS_KAYNAK_ADI });
              sonuclar.push({ id: c.id, icerik: JSON.stringify(r) });
            }
          } catch (h) {
            sonuclar.push({ id: c.id, hata: true, icerik: h.message });
          }
        } else if (c.ad === "bilgi_bankasina_ekle" && admin) {
          const g = c.girdi ?? {};
          const kaynak = okunanKaynak(g.kaynak_url);
          const izin = kaynak && kayitIzni(kaynak.url, "bilgi-bankasi");
          if (!kaynak) { sonuclar.push({ id: c.id, hata: true, icerik: "kaynak_url okunan bir madde değil; önce dis_kaynak_oku" }); continue; }
          if (!izin) { sonuclar.push({ id: c.id, hata: true, icerik: "Admin bu madde için bilgi bankasına ekleme izni vermedi. izin_iste (tur: kayit) ile sor." }); continue; }
          if (!eserEkle) { sonuclar.push({ id: c.id, hata: true, icerik: "Bilgi bankasına ekleme bu sunucuda kapalı" }); continue; }
          const dayanak = [
            ...kaynaktaDayanakVar(g.tarihce, kaynak.metin),
            ...kaynaktaDayanakVar(g.ad, `${kaynak.baslik} ${kaynak.metin}`, { esik: 0.5 }).map((h) => `ad: ${h}`),
          ];
          if (g.yuzyil != null && !yuzyilKaynaktaVar(g.yuzyil, kaynak.metin)) dayanak.push(`${g.yuzyil}. yüzyıl maddede açıkça geçmiyor; yuzyil alanını boş bırak`);
          if (dayanak.length) { sonuclar.push({ id: c.id, hata: true, icerik: `Kayıt okunan maddeye dayanmıyor, düzelt:\n- ${dayanak.join("\n- ")}` }); continue; }
          const r = await eserEkle({
            ad: g.ad, ad_en: g.ad_en, il: g.il, ilce: g.ilce, tur: g.tur, yuzyil: g.yuzyil ?? null, adres: g.adres,
            tarihce: { tr: g.tarihce, en: g.tarihce_en }, konum: kaynak.konum, fotograflar: [],
            kaynak: `Vikipedi, "${kaynak.baslik}" maddesi (CC BY-SA 4.0)`, dogrulanmis: false, kaynakTuru: DIS_KAYNAK_ADI, kaynakUrl: kaynak.url,
          }, { izin: izin.id });
          if (r.hatalar?.length) { sonuclar.push({ id: c.id, hata: true, icerik: `Eser doğrulamadan geçmedi: ${r.hatalar.join("; ")}` }); continue; }
          // İzin her madde için bir kez kullanılır; bütün maddeler kullanılınca izin kapanır.
          izin.kullanilanlar = [...(izin.kullanilanlar ?? []), kaynak.url];
          izin.eserIdler = { ...(izin.eserIdler ?? {}), [kaynak.url]: r.eser.id };
          if (izinUrlleri(izin).every((u) => izin.kullanilanlar.some((x) => ayniAdres(x, u)))) izin.durum = "kullanildi";
          if (izinUrlleri(izin).length === 1) izin.eserId = r.eser.id;
          izler.gorulen.add(r.eser.id);
          if (!izler.okunan.includes(r.eser.id)) izler.okunan.push(r.eser.id);
          disKullan(kaynak);
          aramalar.push({ eklenen: r.eser.id, ad: r.eser.ad, kaynak: DIS_KAYNAK_ADI });
          sonuclar.push({ id: c.id, icerik: JSON.stringify({ eklendi: true, id: r.eser.id, not: "Kayıt doğrulanmamış (kaynak: Vikipedi) olarak eklendi; modülde eserler.getir ile oku." }) });
        } else if (c.ad === "yanit_ver") {
          const m = typeof c.girdi?.metin === "string" ? c.girdi.metin.trim() : "";
          if (m) { yanit = sohbetYaniti(c.girdi, m); sonuclar.push({ id: c.id, icerik: "Yanıt iletildi." }); }
          else sonuclar.push({ id: c.id, hata: true, icerik: "\"metin\" alanı boş" });
        } else if (c.ad === "modul_yaz") {
          if (!insaIzni) {
            sonuclar.push({ id: c.id, hata: true, icerik: "Usta bir soru sordu, modülü yazmanı istemedi. Kod yazma: yanit_ver ile sorusunu yanıtla; istersen planını kısaca anlat ve hazır olduğunda yazmanı istemesini söyle." });
            continue;
          }
          deneme++;
          sonHatalar = modulDenetle(c.girdi, sdkTipleri, bilgiBankasi());
          if (typeof c.girdi?.kod === "string") sonHatalar.push(...disKaynakDenetimi(c.girdi.kod));
          if (!sonHatalar.length) teslim = c.girdi;
          sonuclar.push(sonHatalar.length
            ? { id: c.id, hata: true, icerik: `Modül doğrulamadan geçmedi, lütfen düzelt:\n- ${sonHatalar.join("\n- ")}` }
            : { id: c.id, icerik: "Modül kabul edildi." });
        } else {
          sonuclar.push({ id: c.id, hata: true, icerik: `Bilinmeyen araç: ${c.ad}` });
        }
      }
      // model: bu istekte kodu yazan model (Studio ve modül kaydı bunu gösterir)
      if (teslim) {
        const { kaynaklar, sdk, oneriler, ...modul } = teslim;
        for (const u of koddakiDisBaglantilar(modul.kod)) disKullan(okunanKaynak(u));
        for (const i of durumK.izinler) if (i.tur === "kayit" && i.durum === "verildi" && i.karar === "modul") for (const u of izinUrlleri(i)) disKullan(okunanKaynak(u));
        const disKaynaklar = izler.disKullanilan.map((d) => ({ kaynak: d.kaynak, baslik: d.baslik, url: d.url }));
        return tamamla(durumuEkle({ ...modul, tur: "modul", deneme, aramalar, kaynaklar: kaynaklariKur({ kaynaklar, sdk }, izler), oneriler: onerileriTemizle(oneriler), model: saglayici.model, disKaynaklar }));
      }
      if (yanit) return tamamla(yanit);
      sonuclariBildir(sonuclar);
    }
    const hata = new Error(deneme ? "Kalfa geçerli bir modül üretemedi" : "Kalfa bir yanıt üretemedi");
    hata.ayrintilar = sonHatalar;
    // Okunan maddeler ve izinler kaybolmasın: atölye oturumu hata durumunda da bu durumu yazar (yeniden okuma yok).
    if (admin) hata.kalfaDurumu = durumK;
    throw hata;
  }

  return {
    calistir,
    onerileriUret,
    baslangicOnerileri: (dil) => veridenOneriler(eserler, { dil }),
    dogrula: (kod) => dogrula(kod, sdkTipleri, bilgiBankasi()),
    get sahte() { return saglayiciAl().tur === "sahte"; },
    get model() { const s = saglayiciAl(); return s.tur === "sahte" ? "sahte" : s.model; },
    get saglayici() { return saglayiciAl().tur; },
    get ustagpt() { const s = saglayiciAl(); return s.tur === "openai-uyumlu" && !!s.ustagpt; },
  };
}

// İstemdeki bir satırı başka bir satırla değiştirir; eşleşmeyen değişiklik sessizce geçmesin diye hata atar
// (usta istemi değişip admin sürümü eski metni aramaya devam ederse sunucu açılırken fark edilir).
export function istemDegistir(metin, degisiklikler) {
  let sonuc = metin;
  for (const [eski, yeni] of degisiklikler) {
    if (!eski || !sonuc.includes(eski)) throw new Error(`Admin istemi kurulamadı: değiştirilecek satır bulunamadı (${String(eski).slice(0, 60)}…)`);
    sonuc = sonuc.replace(eski, () => yeni);
  }
  return sonuc;
}

// İzindeki bir maddenin adı (toplu izinde maddeler listesinden).
const maddeAdi = (i, url) => i.maddeler?.find((m) => m.url === url)?.baslik ?? i.baslik ?? i.konu;

// Kayıt izninin kapsadığı madde adresleri (tek kaynak_url'li eski izinler de).
export const izinUrlleri = (i) => (Array.isArray(i?.urller) ? i.urller : i?.kaynak_url ? [i.kaynak_url] : []);

// Karar verilmiş ama henüz kullanılmamış kayıt izinlerinin maddeleri: metinleri son mesaja eklenir. Kalfa önceki turda
// okuduğu metni görmez (yalnızca özet kalır); "modüle özel" içerik için 10 maddeyi yeniden okuması turu çok uzatıyordu.
export function izinliMaddeMetinleri({ izinler = [], disKaynaklar = [] }) {
  const urller = [];
  let modulIcin = false;
  for (const i of izinler) {
    if (i.tur !== "kayit" || i.durum !== "verildi" || !["modul", "bilgi-bankasi"].includes(i.karar)) continue;
    if (i.karar === "modul") modulIcin = true;
    for (const u of izinUrlleri(i)) {
      if (!(i.kullanilanlar ?? []).some((x) => adresAnahtari(x) === adresAnahtari(u)) && !urller.some((x) => adresAnahtari(x) === adresAnahtari(u))) urller.push(u);
    }
  }
  const parcalar = [];
  let toplam = 0;
  for (const u of urller) {
    const d = disKaynaklar.find((x) => adresAnahtari(x.url) === adresAnahtari(u));
    if (!d?.metin) continue;
    const kalan = MAKS_MADDE_TOPLAMI - toplam;
    if (kalan < 200) break;
    const metin = d.metin.length > Math.min(MAKS_MADDE_METNI, kalan) ? `${d.metin.slice(0, Math.min(MAKS_MADDE_METNI, kalan))}…` : d.metin;
    toplam += metin.length;
    parcalar.push(`### ${d.baslik} (${d.url})\n${metin}`);
  }
  if (!parcalar.length) return "";
  const olcu = modulIcin ? `\nModüle özel içerikte ölçülü ol: madde başına 2–4 kısa bilgi ya da soru, modül en çok ~${MAKS_MODUL_HEDEF} satır.` : "";
  return `(Admin'in izin verdiği maddeler zaten okundu; yeniden dis_kaynak_oku çağırma. Yalnızca aşağıdaki metinlerde geçen bilgiyi kullan.${olcu}\n\n${parcalar.join("\n\n")})`;
}

// Admin'in verdiği izinlerin ve okunan maddelerin kalfaya giden özeti (model durumu her turda buradan bilir).
function izinOzeti({ izinler, disKaynaklar }) {
  const KARAR = { ver: "izin verildi", reddet: "reddedildi", "bilgi-bankasi": "bilgi bankasına eklensin", modul: "yalnızca bu modüle özel" };
  const satirlar = izinler.slice(-8).map((i) => {
    const urller = izinUrlleri(i);
    const durum = i.durum === "bekliyor" ? "yanıt bekliyor" : i.durum === "kullanildi" ? "kullanıldı" : KARAR[i.karar] ?? i.durum;
    const ust = `- ${i.tur === "dis_kaynak" ? "Dış kaynak" : "Kayıt"} izni (${i.konu}${urller.length === 1 ? `, ${urller[0]}` : ""}): ${durum}${urller.length === 1 && i.eserId ? ` (bilgi bankasında: ${i.eserId})` : ""}`;
    if (urller.length < 2) return ust;
    // Toplu izin: her maddenin durumu ayrı (kullanılan maddeye ikinci ekleme yapılamaz).
    return [ust, ...urller.map((u) => {
      const id = i.eserIdler?.[u];
      return `  · ${u}: ${id ? `eklendi (bilgi bankasında: ${id})` : i.durum === "verildi" && i.karar === "bilgi-bankasi" ? "eklenmeyi bekliyor" : durum}`;
    })].join("\n");
  });
  const okunan = disKaynaklar.map((d) => `- ${d.kaynak}: "${d.baslik}" ${d.url}`);
  return `(İzin durumu — sunucu kaydı:\n${satirlar.join("\n") || "- yok"}\nOkunmuş dış kaynaklar:\n${okunan.join("\n") || "- yok"})`;
}

// ---------- Claude (Anthropic) ----------
function anthropicAdaptoru({ saglayici, sistem, araclar, sinyal, zamanAsimiMs }) {
  const istemci = new Anthropic();
  const tools = araclar.map((a) => ({ name: a.ad, description: a.aciklama, input_schema: a.sema }));
  return {
    baslat: (konusma) => ({ mesajlar: konusma.map((m) => ({ role: m.rol === "usta" ? "user" : "assistant", content: m.metin })) }),
    async iste(durum) {
      const yanit = await istemci.messages.stream({
        model: saglayici.model,
        max_tokens: 32000,
        system: sistem,
        tools,
        tool_choice: { type: "any" }, 
        messages: durum.mesajlar,
      }, { timeout: zamanAsimiMs, ...(sinyal && { signal: sinyal }) }).finalMessage();
      const bloklar = yanit.content.filter((b) => b.type === "tool_use");
      return {
        cagrilar: bloklar.map((b) => ({ id: b.id, ad: b.name, girdi: b.input })),
        sonuclariBildir(sonuclar) {
          durum.mesajlar.push({ role: "assistant", content: yanit.content });
          durum.mesajlar.push({
            role: "user",
            content: sonuclar.map((s) => s.id
              ? { type: "tool_result", tool_use_id: s.id, is_error: !!s.hata, content: s.icerik }
              : { type: "text", text: s.icerik }),
          });
        },
      };
    },
  };
}

function openaiUyumluAdaptor({ saglayici, sistem, araclar, sinyal, zamanAsimiMs }) {
  const tools = araclar.map((a) => ({ type: "function", function: { name: a.ad, description: a.aciklama, parameters: a.sema } }));
  // OpenCode Go (ve Zen) istekleri konuşma başına sabit bir oturum kimliği ister.
  // Anahtar "oc_sk_" ile başlıyorsa sağlayıcı OpenCode kabul edilir.
  let opencode = saglayici.anahtar.startsWith("oc_sk_");
  try { opencode ||= /(^|\.)opencode\.ai$/i.test(new URL(saglayici.url).hostname); } catch {}
  const basliklar = {
    "content-type": "application/json",
    "user-agent": "lonca-kalfa/1.0",
    ...(saglayici.anahtar && { authorization: `Bearer ${saglayici.anahtar}` }),
  };

  return {
    baslat: (konusma) => ({
      oturum: randomUUID(),
      mesajlar: [
        { role: "system", content: sistem },
        ...konusma.map((m) => ({ role: m.rol === "usta" ? "user" : "assistant", content: m.metin })),
      ],
    }),
    async iste(durum) {
      const govde = { model: saglayici.model, messages: durum.mesajlar, tools, tool_choice: "auto", max_tokens: 32000 };
      // Her istek zaman aşımına (ve varsa dışarıdan gelen iptale) bağlıdır; yanıt gövdesi de bu süre içinde okunur.
      const gonder = async () => {
        const isaret = AbortSignal.any([AbortSignal.timeout(zamanAsimiMs), ...(sinyal ? [sinyal] : [])]);
        try {
          const y = await fetch(`${saglayici.url}/chat/completions`, {
            method: "POST",
            headers: { ...basliklar, ...(opencode && { "x-opencode-session": durum.oturum }) },
            body: JSON.stringify(govde),
            signal: isaret,
          });
          return { y, metin: await y.text() };
        } catch (h) {
          if (sinyal?.aborted) throw sinyal.reason instanceof Error ? sinyal.reason : new Error("Kalfa isteği iptal edildi");
          if (h.name === "TimeoutError") throw Object.assign(new Error(`Yapay zekâ sağlayıcısı ${Math.round(zamanAsimiMs / 1000)} sn içinde yanıt vermedi (zaman aşımı)`), { zamanAsimi: true });
          throw new Error(`Yapay zekâ sağlayıcısına ulaşılamadı: ${h.cause?.code ?? h.message}`);
        }
      };
      const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

      let { y, metin } = await gonder();
      let hataGovdesi = y.ok ? "" : metin;
      // Geçici sağlayıcı hataları (5xx) için kısa beklemeyle iki kez daha dene.
      for (let deneme = 1; deneme <= 2 && !y.ok && y.status >= 500; deneme++) {
        await bekle(3000 * deneme);
        ({ y, metin } = await gonder());
        hataGovdesi = y.ok ? "" : metin;
      }
      // Bazı modeller (ör. düşünen DeepSeek) tool_choice: "required" kabul etmez.
      // "auto" de reddedilirse istekten alanı tamamen çıkarıp bir kez daha dene.
      if (!y.ok && y.status === 400 && govde.tool_choice && /tool_choice/i.test(hataGovdesi)) {
        delete govde.tool_choice;
        ({ y, metin } = await gonder());
        hataGovdesi = y.ok ? "" : metin;
      }
      if (!y.ok) {
        if (y.status === 429) throw Object.assign(new Error("Yapay zekâ sağlayıcısının istek kotası doldu (429). Biraz bekle ya da başka bir model dene."), { durumKodu: 429 });
        throw Object.assign(new Error(`Yapay zekâ sağlayıcısı hata verdi (${y.status}): ${hataMesaji(hataGovdesi)}`), { durumKodu: y.status });
      }
      const mesaj = jsonCoz(metin)?.choices?.[0]?.message;
      if (!mesaj) throw new Error("Yapay zekâ sağlayıcısından boş yanıt geldi");

      let cagrilar = (mesaj.tool_calls ?? []).map((c) => ({ id: c.id, ad: c.function?.name, girdi: jsonCoz(c.function?.arguments) ?? {} }));
      if (!cagrilar.length) {
        const json = jsonCoz(mesaj.content);
        if (json?.kod) cagrilar = [{ id: null, ad: "modul_yaz", girdi: json }];
      }
      return {
        cagrilar,
        metin: typeof mesaj.content === "string" ? mesaj.content : "",
        sonuclariBildir(sonuclar) {
          durum.mesajlar.push({ role: "assistant", content: mesaj.content ?? "", ...(mesaj.tool_calls?.length && { tool_calls: mesaj.tool_calls }) });
          const metinler = [];
          for (const s of sonuclar) {
            if (s.id) durum.mesajlar.push({ role: "tool", tool_call_id: s.id, content: s.icerik });
            else metinler.push(s.icerik);
          }
          if (metinler.length) durum.mesajlar.push({ role: "user", content: `${metinler.join("\n\n")}\n\nYanıtını bir araç çağrısıyla ver.` });
        },
      };
    },
  };
}

function hataMesaji(govde) {
  try {
    const json = JSON.parse(govde);
    return json?.error?.message || json?.message || govde.slice(0, 300);
  } catch {
    return govde.slice(0, 300);
  }
}

function jsonCoz(metin) {
  if (typeof metin !== "string") return metin && typeof metin === "object" ? metin : null;
  try { return JSON.parse(metin); } catch {}
  const parca = metin.match(/\{[\s\S]*\}/); 
  try { return parca ? JSON.parse(parca[0]) : null; } catch { return null; }
}

const kimlikGecerli = (id) => typeof id === "string" && /^[a-z0-9-]{1,64}$/.test(id);

function modulDenetle(modul, sdkTipleri, veri) {
  const hatalar = [];
  for (const alan of ["id", "ad", "aciklama", "kod", "aciklama_ustaya"]) {
    if (typeof modul?.[alan] !== "string" || !modul[alan].trim()) hatalar.push(`"${alan}" alanı eksik`);
  }
  if (hatalar.length) return hatalar;
  if (!kimlikGecerli(modul.id)) hatalar.push("id yalnızca küçük harf, rakam ve tire içermeli");
  return hatalar.concat(dogrula(modul.kod, sdkTipleri, veri));
}

const ORTAM_TIPLERI = "declare const console: { log(...x: unknown[]): void };";

const DUGUM_TIPLERI = new Set("kapak ust_cubuk sutun satir izgara kaydirma kart afis baslik metin dugme ikon_dugme eser gorsel fotograflar cipler istatistik ilerleme sure liste secenekler girdi harita graf dalis tuval rozet ayrac bosluk".split(" "));
const ZEMINLER = new Set(["acik", "parsomen", "koyu", "gece"]);
const IKONLAR = new Set("pusula harita yildiz kupa kitap soru ev kullanici zaman kamera kup oyun liste ok geri bilgi kalp konum arama tekrar".split(" "));
const ODAKLAR = new Set("genel yakin cati yan arka ust".split(" "));

// Modül yalnızca bilgi bankasındaki eserlerle çalışır: koda elle yazılmış eser kimlikleri ve liste süzgeçleri veritabanında olmalı.
function bilgiBankasiDenetimi(kod, veri) {
  if (!veri) return [];
  const hatalar = [];
  for (const [, ne, id] of kod.matchAll(/\beserler\.(getir|iliskiler)\(\s*["'`]([^"'`]*)["'`]/g)) {
    if (!veri.idler.has(id)) hatalar.push(`eserler.${ne}("${id}"): bilgi bankasında bu kimlikte bir eser yok. Yalnızca veritabanındaki eserleri kullan; gerçek kimliği eser_ara ile bul`);
  }
  for (const [, govde] of kod.matchAll(/\beserler\.liste\(\s*\{([^}]*)\}/g)) {
    for (const [alan, kume, ad] of [["il", veri.iller, "il"], ["ilce", veri.ilceler, "ilçe"], ["tur", veri.turler, "tür"]]) {
      const m = new RegExp(`\\b${alan}:\\s*["'\`]([^"'\`]*)["'\`]`).exec(govde);
      if (m && !kume.has(m[1])) hatalar.push(`eserler.liste: bilgi bankasında "${m[1]}" diye bir ${ad} yok (kayıtlı: ${[...kume].slice(0, 12).join(", ")})`);
    }
  }
  return hatalar;
}

// Tuval oyunlarındaki sık yanlışlar: çizilen tuval ekranda yok, döngü işlevi async (her kare beklenmez, sıra bozulur).
function oyunDenetimi(kod) {
  const hatalar = [];
  if (/\boyun\.dongu\(\s*async\b/.test(kod)) hatalar.push("oyun.dongu'ya async işlev verme: her kare beklemeden çalışmalı; await gereken işi (depo.yaz, sahne.ciz) döngünün dışında yap");
  if (/\[\s*oyun\.rastgele\(/.test(kod)) hatalar.push("oyun.rastgele ondalıklı sayı döndürür, dizi indeksi olmaz: diziden öğe için oyun.sec(dizi), tam sayı için oyun.tamSayi(a, b) kullan");
  const cizilen = [...kod.matchAll(/\boyun\.ciz\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  if (cizilen.length && !/\btip:\s*["'`]tuval["'`]/.test(kod)) hatalar.push("oyun.ciz bir \"tuval\" düğümüne çizer: ekrana { tip: \"tuval\", id, en, boy } koy");
  const tuvalIdleri = new Set([...kod.matchAll(/\bid:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]));
  for (const id of new Set(cizilen)) {
    if (!tuvalIdleri.has(id)) hatalar.push(`oyun.ciz("${id}"): bu kimlikte bir tuval düğümü yok; { tip: "tuval", id: "${id}" } ile aynı kimliği kullan`);
  }
  return hatalar;
}

function dogrula(kod, sdkTipleri, veri) {
  if (typeof kod !== "string" || !kod.trim()) return ["kod boş"];
  const hatalar = [];
  if (kod.split("\n").length > MAKS_SATIR) hatalar.push(`kod en fazla ${MAKS_SATIR} satır olmalı`);
  if (!/export\s+default\s+async\s+function/.test(kod)) hatalar.push("'export default async function basla()' eksik");
  for (const [, kaynak] of kod.matchAll(/\bimport\b[^"'`]*["'`]([^"'`]+)["'`]/g)) {
    if (kaynak !== "@lonca/sdk") hatalar.push(`yalnızca "@lonca/sdk" içe aktarılabilir ("${kaynak}" yasak)`);
  }
  if (/\bimport\s*\(/.test(kod)) hatalar.push("dinamik import yasak");
  if (/\b(eval|Function)\s*\(/.test(kod)) hatalar.push("eval / Function yasak");
  const bilinmeyen = (desen, kume, ne) => {
    for (const [, ad] of kod.matchAll(desen)) if (!kume.has(ad)) hatalar.push(`bilinmeyen ${ne}: "${ad}" (geçerli: ${[...kume].join(", ")})`);
  };
  bilinmeyen(/\btip:\s*["'`]([^"'`]+)["'`]/g, DUGUM_TIPLERI, "düğüm tipi");
  bilinmeyen(/\bikon:\s*["'`]([^"'`]+)["'`]/g, IKONLAR, "ikon");
  bilinmeyen(/\bodak:\s*["'`]([^"'`]+)["'`]/g, ODAKLAR, "3B odak");
  bilinmeyen(/\bzemin:\s*["'`]([^"'`]+)["'`]/g, ZEMINLER, "tema zemini");
  const dongu = /^([ \t]*)for\s+await\s*\(.*sahne\.olaylar\(\)/m.exec(kod);
  if (dongu) {
    const girinti = dongu[1];
    const sonrasi = kod.slice(dongu.index + dongu[0].length);
    for (const [, ad] of sonrasi.matchAll(new RegExp(`^${girinti}(?:const|let)\\s+([A-Za-z_$][\\w$]*)`, "gm"))) {
      hatalar.push(`"${ad}" olay döngüsünden sonra const/let ile tanımlanmış; döngü bitmediği için hiç tanımlanmaz. Döngüden önce tanımla ya da "function ${ad}()" yaz`);
    }
  }
  hatalar.push(...bilgiBankasiDenetimi(kod, veri));
  hatalar.push(...oyunDenetimi(kod));
  if (!/sahne\.ayarla\s*\(/.test(kod)) hatalar.push("modül bir uygulama olmalı: önce sahne.ayarla({ baslik, tema }) çağır, sonra sahne.ciz ile kendi ekranını çiz");
  return hatalar.concat(tipDenetimi(kod, sdkTipleri));
}

// "let oyun = null;" yazıp değeri iç içe bir fonksiyonda (oyunuKur()) atamak geçerli JavaScript'tir; ama TypeScript
// o atamayı görmediği için değişkeni hep null sanır ve "oyun && oyun.cevap" ifadesinde oyun'u never'a daraltır.
// Kalfanın ürettiği geçerli modüller bu yüzden reddediliyordu; never üzerindeki "özellik yok" (TS2339) yok sayılır.
const neverYanilgisi = (d) => d.code === 2339 && /'never'/.test(ts.flattenDiagnosticMessageText(d.messageText, " "));

function tipDenetimi(kod, sdkTipleri) {
  const dosyalar = { "/modul.js": kod, "/lonca-sdk.d.ts": sdkTipleri, "/ortam.d.ts": ORTAM_TIPLERI };
  const ayarlar = {
    allowJs: true, checkJs: true, noEmit: true, strict: false, noImplicitAny: false,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"], types: [], skipLibCheck: true,
  };
  const host = ts.createCompilerHost(ayarlar);
  const asilGetir = host.getSourceFile.bind(host);
  host.getSourceFile = (ad, surum) =>
    dosyalar[ad] != null ? ts.createSourceFile(ad, dosyalar[ad], surum, true) : asilGetir(ad, surum);
  host.fileExists = (ad) => dosyalar[ad] != null || ts.sys.fileExists(ad);
  host.readFile = (ad) => dosyalar[ad] ?? ts.sys.readFile(ad);

  const program = ts.createProgram(Object.keys(dosyalar), ayarlar, host);
  return ts.getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName === "/modul.js" && !neverYanilgisi(d))
    .slice(0, 8)
    .map((d) => {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      return `satır ${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
}

function sahteYanit(sohbet, ornekOyun, { insaIzni = true } = {}) {
  const ham = String(sohbet.at(-1)?.metin ?? "").replace(/\s+/g, " ").trim();
  // Usta modülü açıkça istemediyse sahte kalfa da yalnızca sohbet eder.
  if (!insaIzni) {
    const fikir = ham.length > 60 ? `${ham.slice(0, 59)}…` : ham;
    return {
      tur: "sohbet",
      metin: "(Sahte kalfa: yapay zekâ bağlı değil.) Fikrini konuşabiliriz: hangi eserler, kimin için, oyun mu rehber mi olsun? Hazır olduğunda yazmamı iste (“yap”, “hazırla”, “başlayalım”…), modülü yazayım.",
      aramalar: [],
      kaynaklar: { eserler: [], sdk: [] },
      oneriler: onerileriTemizle([`${fikir} yap`, "Hangi eserler var?", "Oyun mu rehber mi olsun?"]),
    };
  }
  const istek = ham.toLocaleLowerCase("tr");
  const sahteEk = { tur: "modul", kaynaklar: { eserler: [], sdk: ["sahne.ayarla", "sahne.ciz", "eserler.liste"] }, oneriler: ["Renkleri değiştir", "Bir başarım ekle", "Bu modül nasıl çalışıyor?"] };
  if (istek.includes("harita")) {
    const il = ["bursa", "izmir", "manisa"].find((x) => istek.includes(x));
    const ilAdi = { bursa: "Bursa", izmir: "İzmir", manisa: "Manisa" }[il] ?? null;
    return {
      id: `${il ?? "eser"}-haritasi`,
      ad: `${ilAdi ?? "Vakıf"} Eserleri Haritası`,
      aciklama: `${ilAdi ?? "Tüm"} vakıf eserlerini haritada keşfet.`,
      kod: `import { sahne, eserler } from "@lonca/sdk";

export default async function basla() {
  const liste = (await eserler.liste(${ilAdi ? `{ il: "${ilAdi}" }` : ""})).filter((e) => e.konum);
  let yigin = ["kapak"], secili = null;
  await sahne.ayarla({ baslik: "${ilAdi ?? "Vakıf"} Haritası", tema: { zemin: "koyu", renk: "firuze" } });

  const ekranlar = {
    kapak: () => ({ tip: "kapak", ust: "Harita", baslik: "${ilAdi ?? "Vakıf"} eserleri", eser: liste.find((e) => e.fotograflar.length),
      alt: \`\${liste.length} eser haritada seni bekliyor.\`, cocuklar: [{ tip: "dugme", id: "harita", metin: "Haritayı aç", ikon: "harita" }] }),
    harita: () => ({ tip: "sutun", cocuklar: [
      { tip: "ust_cubuk", baslik: "Harita", alt: "Bir pine dokun", geri: "geri" },
      { tip: "harita", id: "harita-pin", eserler: liste, secili: secili?.id },
      secili ? { tip: "eser", eser: secili, id: "ayrinti", boyut: "satir" } : { tip: "metin", metin: "Konumlar yaklaşıktır.", soluk: true },
    ] }),
    ayrinti: () => ({ tip: "sutun", cocuklar: [
      { tip: "ust_cubuk", baslik: secili.ad, geri: "geri" },
      { tip: "fotograflar", eser: secili },
      ...secili.tarihce.tr.split(/\\n+/).slice(0, 3).map((p) => ({ tip: "metin", metin: p })),
      { tip: "metin", metin: secili.kaynak, soluk: true },
    ] }),
  };
  const ciz = () => sahne.ciz(ekranlar[yigin[yigin.length - 1]]());
  await ciz();
  for await (const olay of sahne.olaylar()) {
    if (olay.id === "geri" && yigin.length > 1) yigin.pop();
    else if (olay.id === "harita") yigin.push("harita");
    else if (olay.tur === "dokun" && olay.id === "harita-pin" && olay.eser) secili = olay.eser;
    else if (olay.id === "ayrinti" && secili) yigin.push("ayrinti");
    await ciz();
  }
}
`,
      aciklama_ustaya: "(Sahte kalfa) Kapaklı bir harita uygulaması hazırladım: pine dokununca eser altta beliriyor, dokununca fotoğraflı ayrıntı sayfası açılıyor.",
      renk: "firuze",
      ikon: "genel",
      deneme: 1,
      aramalar: [],
      ...sahteEk,
    };
  }
  const tur = ["han", "cami", "hamam", "medrese", "çeşme", "türbe"].find((t) => istek.includes(t));
  const turKod = tur === "çeşme" ? "cesme" : tur === "türbe" ? "turbe" : tur;
  const turAdi = tur ? tur[0].toLocaleUpperCase("tr") + tur.slice(1) : null;
  let kod = ornekOyun;
  if (turKod) {
    kod = kod.replace('eserler.liste({ il: "Bursa" })', `eserler.liste({ il: "Bursa", tur: "${turKod}" })`)
      .replaceAll('"Yüzyıl Avı"', `"${turAdi} Avı"`);
  }
  return {
    id: `${turKod ?? "eser"}-yarismasi`,
    ad: `${turAdi ?? "Eser"} Bilgi Yarışması`,
    aciklama: `${turAdi ? turAdi + (/[aıou][^aeıioöuü]*$/.test(turAdi) ? "ların" : "lerin") : "Eserlerin"} yüzyılını tahmin ettiğin, rekorlu ve başarımlı bir oyun.`,
    kod,
    aciklama_ustaya: "(Sahte kalfa: yapay zekâ bağlı değil, hazır bir şablon döndü.) Lobisi, seri bonusu, rekoru ve başarımları olan bir yüzyıl tahmin oyunu hazırladım.",
    renk: "mercan",
    ikon: turKod ?? "genel",
    deneme: 1,
    aramalar: [],
    ...sahteEk,
  };
}
