//
//   anthropic     → Claude (ANTHROPIC_API_KEY)
import Anthropic from "@anthropic-ai/sdk";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

ts.validateLocaleAndSetLanguage("tr", ts.sys);

const MAKS_DENEME = 3;   
const MAKS_ADIM = 8;     
const MAKS_SATIR = 2000;

function saglayiciSec(ortam = process.env) {
  if (ortam.KALFA_SAHTE === "1") return { tur: "sahte" };
  // KALFA_* tanımlı değilse dalış kalfasıyla aynı UstaGPT (OpenAI uyumlu) uç noktası kullanılır;
  // böylece yalnızca USTAGPT_* dolu bir .env'de modül kalfası sessizce sahte kipe düşmez.
  const e = { ...ortam };
  if (!e.KALFA_SAGLAYICI && !e.ANTHROPIC_API_KEY && !e.KALFA_API_URL && e.USTAGPT_BASE_URL && e.USTAGPT_API_KEY) {
    Object.assign(e, { KALFA_SAGLAYICI: "openai-uyumlu", KALFA_API_URL: e.USTAGPT_BASE_URL, KALFA_API_ANAHTARI: e.USTAGPT_API_KEY, KALFA_MODEL: e.KALFA_MODEL || "gemini-3.8-flash" });
  }
  const secilen = e.KALFA_SAGLAYICI || (e.ANTHROPIC_API_KEY ? "anthropic" : e.KALFA_API_URL ? "openai-uyumlu" : "sahte");
  if (secilen === "anthropic") {
    if (!e.ANTHROPIC_API_KEY) throw new Error("KALFA_SAGLAYICI=anthropic için ANTHROPIC_API_KEY gerekli");
    return { tur: "anthropic", model: e.KALFA_MODEL || "claude-sonnet-5-5" };
  }
  if (secilen === "openai-uyumlu") {
    if (!e.KALFA_API_URL || !e.KALFA_MODEL) throw new Error("openai-uyumlu için KALFA_API_URL ve KALFA_MODEL gerekli");
    return { tur: "openai-uyumlu", url: e.KALFA_API_URL.replace(/\/+$/, ""), anahtar: e.KALFA_API_ANAHTARI || "", model: e.KALFA_MODEL };
  }
  if (secilen === "sahte") return { tur: "sahte" };
  throw new Error(`Bilinmeyen KALFA_SAGLAYICI: ${secilen}`);
}

export function kalfaHazirla({ kok, eserler, ortam = process.env }) {
  const sdkTipleri = readFileSync(path.join(kok, "sdk", "lonca-sdk.d.ts"), "utf8");
  const ornek = (ad) => readFileSync(path.join(kok, "sdk", "ornekler", `${ad}.js`), "utf8");
  const ornekUygulama = ornek("hanlar-rehberi"), ornekOyun = ornek("yuzyil-avi");
  const iller = [...new Set(eserler.map((e) => e.il))];
  const turler = [...new Set(eserler.map((e) => e.tur))];
  const saglayici = saglayiciSec(ortam);

  const sistem = `Sen Lonca platformunun "kalfa"sısın. Usta (kullanıcı) bir fikir anlatır; sen o fikri vakıf eserleri hakkında küçük bir Lonca modülüne dönüştürürsün. Usta kod bilmeyebilir: ona sade Türkçe ile konuş.

- Tek bir JavaScript dosyası. Yalnızca şu satırla içe aktarma yapılır: import { ... } from "@lonca/sdk";
- Dosya şunu dışa aktarır: export default async function basla() { ... }
- Modül yalıtılmış bir ortamda çalışır: document, window, fetch, localStorage, setTimeout gibi tarayıcı API'leri YOKTUR. Her şey SDK ile yapılır (kalıcı veri için depo, puan için profil).
- Ekranı uygulama çizer; HTML yazma. Yalnızca sözleşmedeki ekran.* bileşenleri ve sahne.ciz düğüm tipleri vardır.
- Tarihî bilgi UYDURMA. Belirli bir esere ait ad, yüzyıl, tarih, kişi, sayı, tarihçe ve kaynak her zaman SDK'dan gelen eser verisinden okunur. Genel kavramları (kubbe, revak, kitabe nedir gibi) kendi cümlelerinle açıklayabilirsin.
- Liste boş gelebilir; bu durumu nazikçe karşıla. Her eserde her bilgi yoktur: ihtiyacın olan alanları sunucuda süz — eserler.liste({ gerekli: ["konum"] }) harita için, { gerekli: ["yuzyil"] } yüzyıl sorusu için, { gerekli: ["fotograf"] } görsel oyunlar için, { tam: true } bütün bilgileri bilinen eserler için. eserler.tamlik(eser) bir eserde neyin bilindiğini söyler.
- Zengin ve ayrıntılı yaz: ustanın fikrini derinlemesine işle (birden çok bölüm, ilerleme, puanlama, başarımlar, kayıtlı rekor…). En fazla ${MAKS_SATIR} satır. Açıklayıcı Türkçe adlar ve kısa yorumlar kullan; ekranları ayrı fonksiyonlara böl.
- id: küçük harf, rakam ve tire (örn. "cesme-avi").

Lonca bir uygulama mağazası gibidir: modül açılınca TÜM EKRAN modülündür, Lonca'dan yalnızca sağ üstte küçük bir kapatma kapsülü kalır. Kullanıcı bir web sayfasında "ileri-geri" gezdiğini değil, ayrı bir uygulamaya/oyuna girdiğini hissetmeli.
Her modülde şunlar ZORUNLU:
1. İlk iş sahne.ayarla({ baslik, tema: { zemin, renk, yazi } }). Temayı konuya göre seç: oyun/gece gezisi → "gece" ya da "koyu"; tarih/arşiv → "parsomen"; ferah rehber → "acik". renk: kobalt | firuze | mercan | altin | zumrut | murdum. yazi: "serif" (zarif) ya da "sans" (oyun gibi).
2. Açılış ekranı bir "kapak" düğümü: tam ekran, eserin gerçek fotoğrafı (eser verilirse), büyük başlık ve alttaki düğmeler (Başla, Koleksiyon…). Oyunlarda lobi budur.
3. Kapak dışındaki her ekranın başında modülün kendi "ust_cubuk"u; derin ekranlarda geri: "geri" ile ← düğmesi. Gezinmeyi bir ekran yığınıyla yap (ileri → push, ← → pop). Uygulama ileri/geri geçişleri kendisi canlandırır.
4. Durumu bir nesnede tut; arayüzü durumdan üreten fonksiyonlar yaz; her olaydan sonra sahne.ciz. for await (const olay of sahne.olaylar()) döngüsü bitmez; kullanıcı kapsülden kapatır. Bu yüzden döngüden sonra yazılan yardımcılar "function ad()" olmalı (const/let döngüden sonra hiç tanımlanmaz).
5. Alt sekmeler (sahne.ayarla sekmeler) yalnızca gerçekten 3+ eşdeğer bölüm varsa; çoğu modülde kapak + yığın daha iyidir.
6. ekran.* (soru, kart, uc, harita…) uygulamanın ÜSTÜNDE açılan bir penceredir ve kullanıcı her an kapatabilir: dönüş değeri boş olabilir (soru → { secim: -1, dogru: null }, harita/galeri → null). Asıl deneyimi sahne düğümleriyle kur; pencereleri kısa anlar (3B gezi, tek bir soru) için kullan. Uygulama açılır açılmaz pencere AÇMA.
7. Fotoğraf: eserlerin çoğunda kitaptan gerçek fotoğraflar var (eser.fotograflar). Ayrıntı ekranında "fotograflar" düğümünü kullan; listelerde "eser" düğümü fotoğrafı kendisi gösterir.
8. Bir eserin ayrıntısını gösterdiğin ekranda kaynağı (eser.kaynak) yaz ve "Bir hata mı gördün? Bildir" düğmesiyle ekran.duzeltme(eser) çağır (topluluk düzeltmeleri editör onayına gider).

- Oyunlarda: "sure" ile geri sayım, seri/bonus puanı, sahne.efekt("yildiz") doğruda, "titre" yanlışta, "konfeti" büyük başarıda; depo ile rekor; profil.puanEkle ile oyuncuya puan.
- basarim.tanimla ile 3–6 başarım; anlamlı anlarda basarim.kazan; bir koleksiyon/başarımlar ekranında "rozet" düğümleri (durumu basarim.liste() ile oku).
- Keşif uygulamalarında: "izgara" içinde "eser" kartları, "secenekler" ile filtre, "girdi" ile arama, gömülü "harita".
- 3B: Yalnızca GERÇEK 3B vardır (Google'ın uydu fotoğraflarından modeli, eserin konumunda). Her ortamda bulunmaz: önce "await ekran.ucVarMi(eser)" ile sor; false ise 3B düğmesi GÖSTERME, 3B'den hiç söz etme. true ise ekran.uc({ eser, duraklar: [{ odak: "genel", metin }, { odak: "yakin", metin }, { odak: "ust", metin }] }) (odaklar: genel, yakin, cati, yan, arka, ust). Kubbe, minare gibi parçalara odaklanılamaz; duraklarda yapının parçalarından değil bakış açısından söz et.
- Tarihsel bağlar hazır veridir: "await eserler.iliskiler()" bütün bağları, "await eserler.iliskiler(eser.id)" bir eserin bağlarını (diger eser ve yon ile) verir. Bağları kendin uydurma, ad benzerliğinden çıkarma; yalnızca bu veriyi kullan. Bağ türleri: kulliye (aynı külliye), bani (aynı bani), mimar (aynı mimar), vakif (bir vakfın geliri), aile (hanedan), ticaret (ticaret ağı), metin (envanterde açıkça anılıyor), komsu (tarihî komşuluk), tipoloji (mimari gelenek). Her bağda baslik ve aciklama vardır.
- Harita düğümünde harita üstünde bağ çizmek için baglantilar: [{ a: eserId, b: eserId, tur }] ver; sis perdesi için sis: { acik: [{ lat, lng, yaricap }], minPiksel?: number } ver; şehir etiketleri için etiketler: [{ lat, lng, metin, alt? }] ver. Veri artık Bursa dışında İzmir, Edirne, İstanbul, Konya, Mardin, Balıkesir, Kütahya ve Bilecik eserlerini de içerir; şehirler arası bağları da kullan. Bir eserin bağlarını görsel ağ olarak göstermek için "graf" düğümü: { tip: "graf", merkez: eser, iliskiler: [{ eser, tur, baslik }] }; düğüme dokununca { tur:"dokun", id, eser } gelir. Detay ekranında graf + bağ listesi birlikte iyi çalışır.
- Dalışlar: bazı eserlerin uydudan içine inen kaydırmalı gezisi ("dalış") hazırdır: "await dalislar.liste()". Bir dalışı göstermek için "dalis" düğümünü kullan ve sözleşmedeki DalisTanimi açıklamasındaki gibi kareleri DalisKaresi'ne çevir; uydu karelerinin (k.u) bakışları boş gelebilir. dalis düğümü tam ekran kaydırmalıdır: ekranda ondan önce yalnızca "ust_cubuk" olsun, kaynak/düğmeleri cocuklar ile sahnenin sonuna koy. Dalış yoksa (liste boşsa ya da istenen eser listede değilse) bunu söyle; yeni dalışı editörler Studio'daki Dalışlar sekmesinden dalış kalfasıyla hazırlar.
- Metinler kısa, sıcak ve davetkâr. Cevabı ele vermemek için yüzyılı cevaptan SONRA göster.
modul_yaz'da "renk" (ana ekrandaki çini karonun rengi), "ikon" (karodaki çizim; modülün konusuna en yakın eser türü) ve "kategori" (rehber | oyun | gezi | ogren) seç.

# Veri
Şu an kayıtlı iller: ${iller.join(", ")}. Kayıtlı eser türleri: ${turler.join(", ")} (veri setiyle artacak).

\`\`\`ts
${sdkTipleri}
\`\`\`

\`\`\`js
${ornekUygulama}
\`\`\`

\`\`\`js
${ornekOyun}
\`\`\`

- eser_ara: Veritabanında hangi eserlerin bulunduğunu öğrenmek için (il, tür ya da ad ile). Usta belirli eserlerden, bir ilçeden ya da "hangi eserler var" gibi bir şeyden söz ediyorsa ÖNCE bunu kullan. Sonuçlar yalnızca eser kimliklerini ve varlığını öğrenmen içindir: ekranda gösterilecek bilgiyi koda elle YAZMA, modül çalışırken eserler.getir / eserler.liste ile oku.
- modul_yaz: Modülü teslim eder. Konuşmanın sonunda mutlaka bununla bitir.

"aciklama_ustaya" alanında ustaya modülün ne yaptığını 1–3 cümleyle anlat. İstediği bir şey SDK ile yapılamıyorsa bunu dürüstçe söyle ve yapabildiğin en yakın şeyi yap. Harita istenirse harita düğümünü (ya da ekran.harita) kullan.`;

  const araclar = [
    {
      ad: "modul_yaz",
      aciklama: "Lonca modülünü (kod + kimlik bilgileri) teslim eder.",
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
          kategori: { type: "string", enum: ["rehber", "oyun", "gezi", "ogren"], description: "Ana ekrandaki kategori: rehber (keşif/bilgi), oyun (yarışma), gezi (harita/rota), ogren (ders/sözlük)" },
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
          ad: { type: "string", description: "Ad içinde geçen kelime" },
          limit: { type: "integer", description: "En fazla kaç sonuç (varsayılan 20, en çok 50)" },
        },
      },
    },
  ];

  const kucuk = (s) => String(s ?? "").toLocaleLowerCase("tr");
  function eserAra(g = {}) {
    const limit = Math.min(Math.max(Number(g.limit) || 20, 1), 50);
    const bulunan = eserler.filter((e) =>
      (!g.il || kucuk(e.il) === kucuk(g.il)) &&
      (!g.ilce || kucuk(e.ilce) === kucuk(g.ilce)) &&
      (!g.tur || kucuk(e.tur) === kucuk(g.tur)) &&
      (!g.ad || kucuk(e.ad).includes(kucuk(g.ad))));
    return {
      toplam: bulunan.length,
      eserler: bulunan.slice(0, limit).map(({ id, ad, il, ilce, tur, yuzyil, adres, konum }) => ({ id, ad, il, ilce, tur, yuzyil, adres, konum })),
    };
  }

  //   baslat(konusma) → durum
  //   iste(durum) → { cagrilar: [{id, ad, girdi}], sonuclariBildir([{id, icerik, hata}]) }
  const adaptor = {
    anthropic: anthropicAdaptoru,
    "openai-uyumlu": openaiUyumluAdaptor,
  }[saglayici.tur]?.({ saglayici, sistem, araclar });

  async function calistir(sohbet, mevcutKod) {
    if (saglayici.tur === "sahte") return { ...sahteYanit(sohbet, ornekOyun), model: "sahte" };

    const konusma = sohbet.map((m) => ({ ...m }));
    if (mevcutKod) konusma.at(-1).metin += `\n\n(Studio'daki güncel modül kodu:)\n\`\`\`js\n${mevcutKod}\n\`\`\``;

    const durum = adaptor.baslat(konusma);
    let sonHatalar = [], deneme = 0;
    const aramalar = []; 

    for (let adim = 1; adim <= MAKS_ADIM && deneme < MAKS_DENEME; adim++) {
      const { cagrilar, sonuclariBildir } = await adaptor.iste(durum);
      if (!cagrilar.length) {
        sonuclariBildir([{ id: null, icerik: "Yanıtını bir araç çağrısıyla ver (eser_ara ya da modul_yaz).", hata: true }]);
        continue;
      }
      const sonuclar = [];
      let teslim = null;
      for (const c of cagrilar) {
        if (c.ad === "eser_ara") {
          const sonuc = eserAra(c.girdi);
          aramalar.push({ sorgu: c.girdi, bulunan: sonuc.toplam });
          sonuclar.push({ id: c.id, icerik: JSON.stringify(sonuc) });
        } else if (c.ad === "modul_yaz") {
          deneme++;
          sonHatalar = modulDenetle(c.girdi, sdkTipleri);
          if (!sonHatalar.length) teslim = c.girdi;
          sonuclar.push(sonHatalar.length
            ? { id: c.id, hata: true, icerik: `Modül doğrulamadan geçmedi, lütfen düzelt:\n- ${sonHatalar.join("\n- ")}` }
            : { id: c.id, icerik: "Modül kabul edildi." });
        } else {
          sonuclar.push({ id: c.id, hata: true, icerik: `Bilinmeyen araç: ${c.ad}` });
        }
      }
      // model: bu istekte kodu yazan model (Studio ve modül kaydı bunu gösterir)
      if (teslim) return { ...teslim, deneme, aramalar, model: saglayici.model };
      sonuclariBildir(sonuclar);
    }
    const hata = new Error("Kalfa geçerli bir modül üretemedi");
    hata.ayrintilar = sonHatalar;
    throw hata;
  }

  const etiket = saglayici.tur === "sahte" ? "sahte" : `${saglayici.model}`;
  return { calistir, dogrula: (kod) => dogrula(kod, sdkTipleri), sahte: saglayici.tur === "sahte", model: etiket, saglayici: saglayici.tur };
}

// ---------- Claude (Anthropic) ----------
function anthropicAdaptoru({ saglayici, sistem, araclar }) {
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
      }).finalMessage();
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

function openaiUyumluAdaptor({ saglayici, sistem, araclar }) {
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
      const gonder = () => fetch(`${saglayici.url}/chat/completions`, {
        method: "POST",
        headers: { ...basliklar, ...(opencode && { "x-opencode-session": durum.oturum }) },
        body: JSON.stringify(govde),
      });

      let y = await gonder();
      let hataGovdesi = y.ok ? "" : await y.text();
      // Geçici sağlayıcı hataları (5xx) için kısa beklemeyle iki kez daha dene.
      for (let deneme = 1; deneme <= 2 && !y.ok && y.status >= 500; deneme++) {
        await new Promise((r) => setTimeout(r, 3000 * deneme));
        y = await gonder();
        hataGovdesi = y.ok ? "" : await y.text();
      }
      // Bazı modeller (ör. düşünen DeepSeek) tool_choice: "required" kabul etmez.
      // "auto" de reddedilirse istekten alanı tamamen çıkarıp bir kez daha dene.
      if (!y.ok && y.status === 400 && govde.tool_choice && /tool_choice/i.test(hataGovdesi)) {
        delete govde.tool_choice;
        y = await gonder();
        hataGovdesi = y.ok ? "" : await y.text();
      }
      if (!y.ok) {
        if (y.status === 429) throw new Error("Yapay zekâ sağlayıcısının istek kotası doldu (429). Biraz bekle ya da başka bir model dene.");
        throw new Error(`Yapay zekâ sağlayıcısı hata verdi (${y.status}): ${hataMesaji(hataGovdesi)}`);
      }
      const mesaj = (await y.json()).choices?.[0]?.message;
      if (!mesaj) throw new Error("Yapay zekâ sağlayıcısından boş yanıt geldi");

      let cagrilar = (mesaj.tool_calls ?? []).map((c) => ({ id: c.id, ad: c.function?.name, girdi: jsonCoz(c.function?.arguments) ?? {} }));
      if (!cagrilar.length) {
        const json = jsonCoz(mesaj.content);
        if (json?.kod) cagrilar = [{ id: null, ad: "modul_yaz", girdi: json }];
      }
      return {
        cagrilar,
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

function modulDenetle(modul, sdkTipleri) {
  const hatalar = [];
  for (const alan of ["id", "ad", "aciklama", "kod", "aciklama_ustaya"]) {
    if (typeof modul?.[alan] !== "string" || !modul[alan].trim()) hatalar.push(`"${alan}" alanı eksik`);
  }
  if (hatalar.length) return hatalar;
  if (!kimlikGecerli(modul.id)) hatalar.push("id yalnızca küçük harf, rakam ve tire içermeli");
  return hatalar.concat(dogrula(modul.kod, sdkTipleri));
}

const ORTAM_TIPLERI = "declare const console: { log(...x: unknown[]): void };";

const DUGUM_TIPLERI = new Set("kapak ust_cubuk sutun satir izgara kaydirma kart afis baslik metin dugme ikon_dugme eser gorsel fotograflar cipler istatistik ilerleme sure liste secenekler girdi harita graf dalis rozet ayrac bosluk".split(" "));
const ZEMINLER = new Set(["acik", "parsomen", "koyu", "gece"]);
const IKONLAR = new Set("pusula harita yildiz kupa kitap soru ev kullanici zaman kamera kup oyun liste ok geri bilgi kalp konum arama tekrar".split(" "));
const ODAKLAR = new Set("genel yakin cati yan arka ust".split(" "));

function dogrula(kod, sdkTipleri) {
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
  if (!/sahne\.ayarla\s*\(/.test(kod)) hatalar.push("modül bir uygulama olmalı: önce sahne.ayarla({ baslik, tema }) çağır, sonra sahne.ciz ile kendi ekranını çiz");
  return hatalar.concat(tipDenetimi(kod, sdkTipleri));
}

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
    .filter((d) => d.file?.fileName === "/modul.js")
    .slice(0, 8)
    .map((d) => {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      return `satır ${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
}

function sahteYanit(sohbet, ornekOyun) {
  const istek = (sohbet.at(-1)?.metin ?? "").toLocaleLowerCase("tr");
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
  };
}
