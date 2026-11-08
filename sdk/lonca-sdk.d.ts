// Lonca SDK tip tanımları — modüllerin (ve yapay zekâ kalfasının) gördüğü sözleşme.
// <genis> … </genis> arası "genişletilmiş mod"dur (tuval, oyun.*): kalfa bunları ancak usta onay kartında açınca görür ve kullanır.
//
// Her modül kendi başına bir UYGULAMADIR: açılınca tüm ekran onundur (Lonca'dan yalnızca köşede küçük bir kapat
// kapsülü kalır). Modül kendi temasını seçer, kendi üst çubuğunu / kapağını / sekmelerini çizer ve olayları dinler:
//
//   import { sahne, eserler } from "@lonca/sdk";
//   export default async function basla() {
//     const durum = { ekran: "kapak" };
//     await sahne.ayarla({ baslik: "Hanlar", tema: { zemin: "gece", renk: "altin" } });
//     const ciz = () => sahne.ciz(arayuz(durum));   // arayüz = durumdan üretilen düğüm ağacı
//     await ciz();
//     for await (const olay of sahne.olaylar()) { /* durumu güncelle */ await ciz(); }
//   }
//
// <genis>
// Gerçek zamanlı oyunlar ve dokunmatik mini uygulamalar (ping pong, yılan, sürükle-bırak, çizim…) için "tuval" düğümü
// ve oyun.* vardır: oyun.dongu ile her karede güncelle, oyun.ciz ile tuvale çiz, oyun.dokunmalar / oyun.dinle ile
// parmağı (tut-sürükle) ve klavyeyi oku, oyun.ses ile efekt çal, oyun.titres ile titret (aşağıda "Oyun").
//
// </genis>
// ekran.* (soru, kart, uc gezisi…) uygulamanın üstünde açılan, kullanıcının her an kapatabileceği bir penceredir.
// Kullanıcı kapatırsa çağrı boş sonuçla döner (soru → { secim: -1, dogru: null }, harita/galeri → null).

declare module "@lonca/sdk" {
  export type EserTuru =
    | "cami" | "mescit" | "medrese" | "han" | "hamam" | "cesme" | "turbe" | "kulliye" | "imaret"
    | "kopru" | "tekke" | "hazire" | "carsi" | "kutuphane" | "sivil" | "diger";

  export interface Eser {
    id: string;
    il: string;
    ilce?: string | null;
    ad: string;
    /** İngilizce adı */
    ad_en?: string | null;
    tur: EserTuru;
    /** Örn. 16 = 16. yüzyıl. Kitapta açık bir yapım tarihi yoksa null: soru sorarken null olanları atla. */
    yuzyil: number | null;
    /** Konumu bilinmeyen eserlerde null (haritada gösterilmez). */
    konum: { lat: number; lng: number; yaklasik?: boolean } | null;
    /** Envanter kitabından tarihçe (Türkçe / İngilizce). */
    tarihce: { tr: string; en: string | null };
    fotograflar: string[];
    sergi: string | null;
    /** Kaynak gösterimi, örn. "Vakıf Katılım, Bursa Vakıf Eserleri Envanteri, Cilt 1, s. 37" */
    kaynak: string;
    /** Açık adres (kitapta varsa) */
    adres?: string | null;
    /** Yalnızca yakindaki() sonuçlarında: kullanıcının konumu alınamadı, uzaklıklar örnek konuma (Bursa merkezi) göre */
    ornek_konum?: boolean;
    /** Yalnızca yakindaki() sonuçlarında: kullanıcıya uzaklık (metre) */
    mesafe_m?: number;
  }

  export interface Secenek { metin: string; dogru?: boolean; }
  /** Veri tamlığı alanları. Temel: ad, tur, il, ilce, yuzyil, konum, adres, tarihce. Ek: fotograf, ad_en, tarihce_en. */
  export type VeriAlani = "ad" | "tur" | "il" | "ilce" | "yuzyil" | "konum" | "adres" | "tarihce" | "fotograf" | "ad_en" | "tarihce_en";
  export interface Cevap { secim: number; metin: string; dogru: boolean | null; }

  /** İki eser arasındaki tarihsel bağın türü. */
  export type IliskiTuru = "kulliye" | "bani" | "mimar" | "vakif" | "aile" | "ticaret" | "metin" | "komsu" | "tipoloji";
  /** Sunucudaki küratörlü tarihsel bağ kaydı. a/b eser kimlikleridir. */
  export interface Iliski {
    id: string;
    a: string;
    b: string;
    tur: IliskiTuru;
    baslik: string;
    aciklama: string;
    kaynak?: string;
  }
  /** Tek eser için bağ listesi: diğer eser ve bağın yönü eklenir. */
  export interface IliskiDetay extends Iliski { diger: Eser | null; yon: "a" | "b"; }
  /** Haritada çizilecek kaynaklı bağ. id verilirse çizgiye dokununca bag olayı gönderilir; bu çizgi bir rota değildir. */
  export interface HaritaBaglantisi { id?: string; a: string; b: string; tur?: IliskiTuru | (string & {}); etiket?: string; baslik?: string; aciklama?: string; kaynak?: string; }
  /** Sis perdesinin açık kalan alanı (metre yarıçaplı daire). */
  export interface SisAlani { lat: number; lng: number; yaricap: number; }
  /** Haritada şehir/alan etiketi. */
  export interface HaritaEtiketi { lat: number; lng: number; metin: string; alt?: string; acik?: boolean; }
  /** Açılmamış şehirleri de birbirine bağlayan soluk "hayalet" ağ çizgisi. */
  export interface HayaletBaglanti { a: { lat: number; lng: number }; b: { lat: number; lng: number }; tur?: IliskiTuru | (string & {}); }

  export type Renk = "kobalt" | "firuze" | "mercan" | "altin" | "zumrut" | "murdum";
  export type Ikon =
    | "pusula" | "harita" | "yildiz" | "kupa" | "kitap" | "soru" | "ev" | "kullanici" | "zaman" | "kamera"
    | "kup" | "oyun" | "liste" | "ok" | "geri" | "bilgi" | "kalp" | "konum" | "arama" | "tekrar";

  export interface Eserler {
    /** Kullanıcıya en yakın, konumu bilinen eserler (en yakından uzağa). */
    yakindaki(secenek?: { tur?: EserTuru; limit?: number }): Promise<Eser[]>;
    getir(id: string): Promise<Eser>;
    /**
     * Filtreli liste. ad: ad içinde geçen kelime.
     * Veri tamlığına göre: tam (bütün temel alanlar biliniyor), eksik (yalnızca bu alan eksik, diğerleri tam),
     * gerekli (bu alanlar biliniyor), olmayan (bu alanlar bilinmiyor). Örn. haritalı oyun için { gerekli: ["konum", "fotograf"] }.
     */
    liste(secenek?: { il?: string; ilce?: string; tur?: EserTuru; ad?: string; yuzyil?: number;
      tam?: boolean; eksik?: VeriAlani; gerekli?: VeriAlani[]; olmayan?: VeriAlani[] }): Promise<Eser[]>;
    /** Bütün küratörlü tarihsel bağlar. */
    iliskiler(): Promise<Iliski[]>;
    /** Bir eserin bağları; diğer eser ve bağ yönü eklenir. */
    iliskiler(id: string): Promise<IliskiDetay[]>;
    /** Eserin veri tamlığı (yerel, istek atmaz). */
    tamlik(eser: Eser): { tam: boolean; eksikler: VeriAlani[]; oran: number; var: Record<VeriAlani, boolean> };
    /** Tamlık için bakılan temel alanlar: ad, tur, il, ilce, yuzyil, konum, adres, tarihce */
    readonly TEMEL_ALANLAR: readonly VeriAlani[];
    /** Yüzyıl sorusu için karışık şıklar (biri doğru). Eserin yüzyılı yoksa boş dizi. */
    yuzyilSecenekleri(eser: Eser, adet?: number): Secenek[];
    /** Dizinin karıştırılmış kopyası. */
    karistir<T>(dizi: T[]): T[];
  }

  // ---------- 3B ----------
  /** Gerçek 3B'de bakış açıları (yapının parçaları bilinmez, kamera yönleri vardır). */
  export type UcOdak = "genel" | "yakin" | "cati" | "yan" | "arka" | "ust";

  export interface Ekran {
    metin(metin: string): Promise<void>;
    /** Eser kartı: fotoğraf ya da türüne göre çizim, tür, yüzyıl, yer, tarihçe, kaynak. */
    kart(eser: Eser): Promise<void>;
    soru(soru: string, secenekler: (string | Secenek)[]): Promise<Cevap>;
    /** Etkileşimli harita; seçilen eserle ya da kapatılınca null ile çözülür. */
    harita(eserler: Eser[], secenek?: { baslik?: string; rota?: boolean; baglantilar?: HaritaBaglantisi[]; hayaletBaglantilar?: HayaletBaglanti[]; sis?: { acik: SisAlani[]; opaklik?: number; minPiksel?: number }; etiketler?: HaritaEtiketi[]; odak?: { lat: number; lng: number; zoom?: number } }): Promise<Eser | null>;
    /** Yana kaydırılan büyük kartlar; seçilen eser ya da null. */
    galeri(eserler: Eser[], secenek?: { baslik?: string }): Promise<Eser | null>;
    /** Yüzyıllara göre dikey zaman çizelgesi. */
    zaman(eserler: Eser[], secenek?: { baslik?: string }): Promise<void>;
    /** Animasyonlu puan halkası; tam puanda konfeti. */
    sonuc(secenek: { baslik?: string; puan: number; toplam?: number; mesaj?: string }): Promise<void>;
    /** Mühür animasyonlu rozet; kullanıcının profiline kaydedilir. */
    rozet(secenek: { ad: string; aciklama?: string }): Promise<void>;
    /** İlerleme çubuğu (beklemez); toplam 0 ise gizler. */
    ilerleme(adim: number, toplam: number): Promise<void>;
    /**
     * GERÇEK 3B gezi: Google'ın uydu ve uçak fotoğraflarından oluşan fotogerçekçi modeli, eserin konumunda açılır.
     * Yalnızca sunucuda Google anahtarı varsa ve eserin konumu biliniyorsa çalışır: önce ucVarMi(eser) ile sor,
     * false ise 3B düğmesi gösterme. Temsilî/çizim 3B model YOKTUR.
     * duraklar örn: [{ odak: "genel", metin: "…" }, { odak: "yakin", metin: "…" }, { odak: "ust", metin: "…" }]
     */
    uc(secenek: { eser: Eser; baslik?: string; duraklar: { odak: UcOdak; baslik?: string; metin: string }[] }): Promise<{ acildi: boolean }>;
    /** Bu eser için gerçek 3B açılabilir mi? (pencere açmaz) */
    ucVarMi(eser: Eser): Promise<boolean>;
    /** "Hata bildir" formu: kullanıcı eserdeki yanlış/eksik bilgiyi editörlere iletir. Ayrıntı ekranlarına bir düğme koy. */
    duzeltme(eser: Eser): Promise<{ gonderildi: boolean }>;
  }

  // ---------- Uygulama modu: arayüz ağacı ----------
  export type Dugum =
    // --- Uygulama iskeleti ---
    | { tip: "kapak"; baslik: string; alt?: string; ust?: string; eser?: Eser; renk?: Renk; desen?: string; cocuklar?: Dugum[] } // tam ekran açılış/lobi; cocuklar = alttaki düğmeler
    | { tip: "ust_cubuk"; baslik: string; alt?: string; geri?: string; sag?: { id: string; ikon: Ikon; etiket: string }[] } // modülün kendi üst çubuğu; geri verilirse ← düğmesi { tur:"dokun", id: geri }
    // --- Düzen ---
    | { tip: "sutun"; cocuklar: Dugum[]; aralik?: "dar" | "normal" | "genis" }
    | { tip: "satir"; cocuklar: Dugum[]; hizala?: "bas" | "orta" | "son" | "yay" }
    | { tip: "izgara"; cocuklar: Dugum[]; sutun?: 1 | 2 | 3 }
    | { tip: "kaydirma"; cocuklar: Dugum[] }                         // yatay kaydırılan şerit
    | { tip: "kart"; cocuklar: Dugum[]; renk?: Renk; id?: string }   // id verilirse dokunulabilir
    | { tip: "afis"; baslik: string; alt?: string; eser?: Eser; renk?: Renk; desen?: string } // büyük kapak alanı
    | { tip: "baslik"; metin: string; boyut?: 1 | 2 | 3 }
    | { tip: "metin"; metin: string; soluk?: boolean; ortali?: boolean }
    | { tip: "dugme"; id: string; metin: string; tur?: "ana" | "ikincil" | "hayalet"; ikon?: Ikon; devre_disi?: boolean }
    | { tip: "ikon_dugme"; id: string; ikon: Ikon; etiket: string }
    | { tip: "eser"; eser: Eser; id?: string; boyut?: "buyuk" | "kucuk" | "satir" } // dokununca { tur:"dokun", id, eser }
    | { tip: "gorsel"; eser: Eser }
    | { tip: "fotograflar"; eser: Eser }                               // eserin bütün gerçek fotoğrafları, kaydırmalı
    | { tip: "sure"; id: string; saniye: number }                      // geri sayım; bitince { tur:"sure", id } (yeni sayım için id'yi değiştir)
    | { tip: "cipler"; ogeler: string[] }
    | { tip: "istatistik"; deger: string | number; etiket: string; ikon?: Ikon }
    | { tip: "ilerleme"; deger: number; toplam: number; etiket?: string }
    | { tip: "liste"; ogeler: { id: string; metin: string; alt?: string; ikon?: Ikon; sag?: string }[] }
    | { tip: "secenekler"; id: string; secenekler: { id: string; metin: string }[]; secili?: string } // { tur:"sec", id, deger }
    | { tip: "girdi"; id: string; ipucu?: string; deger?: string; dugme?: string }                  // { tur:"gonder", id, deger }
    | { tip: "harita"; id: string; eserler: Eser[]; rota?: boolean; secili?: string;
        baglantilar?: HaritaBaglantisi[]; hayaletBaglantilar?: HayaletBaglanti[]; sis?: { acik: SisAlani[]; opaklik?: number; minPiksel?: number };
        etiketler?: HaritaEtiketi[]; odak?: { lat: number; lng: number; zoom?: number } } // pin → { tur:"dokun", id, eser }
    | { tip: "graf"; id?: string; merkez: Eser; iliskiler: { eser: Eser; tur?: IliskiTuru | (string & {}); baslik?: string; aciklama?: string; kaynak?: string }[] } // kaynaklı bağ açıklamaları ve künyeleri; düğüm → { tur:"dokun", id, eser }
    | { tip: "rozet"; ad: string; aciklama?: string; kazanildi: boolean }
    | { tip: "dalis"; id?: string; etiket?: string; kareler: DalisKaresi[]; cocuklar?: Dugum[] } // kaydırdıkça eserin içine giren tam ekran sahne; cocuklar sahnenin bitiminde gösterilir
    // <genis>
    | { tip: "tuval"; id: string; en?: number; boy?: number; tam?: boolean; arkaplan?: string; etiket?: string; cocuklar?: Dugum[] } // oyun alanı. en/boy VERME: tuval tam ekrandır, ekranı doldurur ve boyutu ekranın gerçek boyutudur (telefonda dar-uzun, web'de geniş; değişebilir) → her karede const { en, boy } = oyun.boyut(id) ile oku, yerleşimi en/boy oranıyla kur. en/boy verilirse o oranda sabit kalır, ekrana orantılı sığar (kenarlarda boşluk kalır). oyun.ciz(id, …) ile çizilir; cocuklar tuvalin ÜSTÜNDE katman (ör. gol kartı, duraklat menüsü); kısa dokunuş { tur:"dokun", id, x, y }
    // </genis>
    | { tip: "ayrac" }
    | { tip: "bosluk" };

  /**
   * Dalış sahnesinin bir karesi (bir durak). gorsel yalnızca sunucudaki /medya/... yolu olabilir (ör. /medya/dalis/<eser>/k1.jpg).
   * Oranlar 0–1'dir; [x, y, g] bir kare bölgedir (g hem en hem boy oranı).
   * portal: bu karede bir SONRAKİ karenin kapladığı bölge (kamera içine dalar).
   * cikis: BU karenin bir sonraki karede kapladığı bölge (kamera geri çekilir); verilirse portal yerine kullanılır.
   * bakislar: durakta sırayla gezilen ayrıntılar (en çok 6). alan: kameranın kayacağı bölge; nokta: [x, y] ok ve halkayla
   *   gösterilen yer; ust/baslik/metin/kaynak: bilgi kartı. Kart kaydırınca silinir, sıradaki bakışa geçilir.
   * etiket: karenin kaynağı, rozet olarak gösterilir. yazi: "ust" ise başlık kartı üstte durur.
   * Bütün metinler kaynaklı bilgiye dayanmalı; kaynak alanını doldur.
   */
  export interface DalisBakisi { alan?: [number, number, number]; nokta?: [number, number]; ust?: string; baslik?: string; metin: string; kaynak?: string }
  export interface DalisKaresi {
    gorsel: string; portal?: [number, number, number]; cikis?: [number, number, number];
    baslik?: string; metin?: string; yazi?: "alt" | "ust";
    etiket?: "gercek" | "genisletilmis" | "netlestirilmis" | "yeniden-cizim" | "canlandirma"; canlandirma?: boolean;
    bakislar?: DalisBakisi[];
  }

  /**
   * Bir dalış tanımı (data/dalislar). Kareler kısaltılmış alanlarla gelir:
   * g görsel adı (/medya/dalis/<eser>/<g>.jpg), t etiket, p portal, c cikis, u uydu [lat, lng, z, cikisMi],
   * b başlık, y yazı konumu, k bakışlar [{ n: nokta, a: alan, u: üst etiket, b: başlık, m: metin, k: kaynak (E | V | G) }].
   * "dalis" düğümüne vermek için her kareyi DalisKaresi'ne çevir:
   * { gorsel: `/medya/dalis/${d.eser}/${k.g}.jpg`, etiket: k.t, portal: k.p, cikis: k.c, baslik: k.b, yazi: k.y,
   *   bakislar: (k.k ?? []).map((x) => ({ nokta: x.n, alan: x.a, ust: x.u, baslik: x.b, metin: x.m, kaynak: x.k })) }
   */
  export interface DalisTanimi {
    eser: string; ozet: string; hedef: { lat: number; lng: number; ad?: string; not?: string } | null;
    durum: "bekliyor" | "onayli" | "kaldirildi"; kaynak: "el" | "kalfa";
    kareler: { g: string; t: string; p?: [number, number, number]; c?: [number, number, number]; u?: [number, number, number, number];
      b?: string; y?: "alt" | "ust"; k?: { n?: [number, number]; a?: [number, number, number]; u?: string; b?: string; m: string; k?: string }[] }[];
  }
  export interface Dalislar {
    /** Yayındaki dalışlar (Studio önizlemesinde onay bekleyenler de). Bir eserin dalışı yoksa listede olmaz. */
    liste(): Promise<DalisTanimi[]>;
  }

  /** sahne.ciz düz JS nesnelerini de kabul eder; tip adları ve alanlar yukarıdaki Dugum ile aynıdır (kalfa ayrıca denetler). */
  export type GevsekDugum = { tip: string; [alan: string]: any };

  export type Olay =
    | { tur: "dokun"; id: string; eser?: Eser; x?: number; y?: number } // tuvalde kısa dokunuşta x, y tuval koordinatıdır
    | { tur: "sekme"; id: string }
    | { tur: "sec"; id: string; deger: string }
    | { tur: "gonder"; id: string; deger: string }
    | { tur: "sure"; id: string };

  /** Modülün görünümü. zemin: acik (çini beyazı) | parsomen (eski kâğıt) | koyu (gece mavisi) | gece (siyah). */
  export interface Tema { zemin?: "acik" | "parsomen" | "koyu" | "gece" | (string & {}); renk?: Renk | (string & {}); yazi?: "serif" | "sans" | (string & {}); }

  export interface Sahne {
    /** Uygulama kabuğu: başlık, tema ve isteğe bağlı alt sekme çubuğu (sekme değişince { tur:"sekme", id } olayı gelir). */
    ayarla(secenek: { baslik?: string; tema?: Tema; sekmeler?: { id: string; ad: string; ikon?: Ikon | (string & {}) }[]; sekme?: string }): Promise<void>;
    /** Arayüz ağacını çizer. Durum her değiştiğinde yeniden çağır. */
    ciz(agac: Dugum | GevsekDugum): Promise<void>;
    /** Sıradaki kullanıcı olayı. */
    olay(): Promise<Olay>;
    olaylar(): AsyncGenerator<Olay, never, void>;
    /** Kısa bildirim (toast). */
    bildir(metin: string): Promise<void>;
    /** Görsel efekt: doğru cevapta "yildiz", büyük başarıda "konfeti", yanlışta "titre". */
    efekt(ad: "konfeti" | "yildiz" | "titre" | "parla" | (string & {})): Promise<void>;
  }

  export interface Profil {
    bilgi(): Promise<{ ad: string; seviye: number; puan: number; renk: Renk }>;
    puanEkle(puan: number, neden?: string): Promise<{ puan: number; seviye: number; seviyeAtladi: boolean }>;
  }
  export interface Basarim {
    tanimla(liste: { id: string; ad: string; aciklama?: string }[]): Promise<void>;
    kazan(id: string): Promise<boolean>;
    liste(): Promise<{ id: string; ad: string; aciklama?: string; kazanildi: boolean }[]>;
  }
  export interface Depo {
    /** Kayıt yoksa null. */
    oku(anahtar: string): Promise<any>;
    yaz(anahtar: string, deger: unknown): Promise<void>;
  }

  // <genis>
  // ---------- Oyun: tuval, oyun döngüsü, dokunma, klavye, ses, titreşim ----------
  /**
   * Tuval çizim kalemi (oyun.ciz içinde). Koordinatlar tuvalin mantıksal birimidir (0,0 sol üst; tuval en × boy).
   * renk: CSS rengi ("#ffcc00", "rgba(0,0,0,.5)", "white"); "yok" dolgu yapmaz. Her çağrı kalemi döndürür (zincirlenebilir).
   */
  export interface Kalem {
    /** Bütün tuvali bu renkle doldurur (renk yoksa saydam temizler). Her karenin başında çağır. */
    temizle(renk?: string): Kalem;
    dikdortgen(x: number, y: number, en: number, boy: number, renk: string, secenek?: { yuvarlak?: number; cizgi?: string; kalinlik?: number }): Kalem;
    /** x, y merkez; r yarıçap. */
    daire(x: number, y: number, r: number, renk: string, secenek?: { cizgi?: string; kalinlik?: number }): Kalem;
    cizgi(x1: number, y1: number, x2: number, y2: number, renk: string, kalinlik?: number, secenek?: { kesikli?: number }): Kalem;
    /** Çokgen / çizgi dizisi: noktalar [[x, y], …]. dolgu: true ise içi boyanır. */
    yol(noktalar: [number, number][], renk: string, secenek?: { kapali?: boolean; dolgu?: boolean; kalinlik?: number }): Kalem;
    /** Yazı: hiza x'e göre (sol | orta | sag), taban y'ye göre (ust | orta | alt; varsayılan orta). */
    yazi(metin: string | number, x: number, y: number, secenek?: { boyut?: number; renk?: string; hiza?: "sol" | "orta" | "sag"; kalin?: boolean; yazi?: "sans" | "serif" | "mono"; taban?: "ust" | "orta" | "alt" }): Kalem;
    /**
     * Eserin gerçek fotoğrafını (ya da sunucudaki bir /medya/... görselini) dikdörtgene çizer. kaynak bir Eser ise ilk
     * fotoğrafı kullanılır; fotoğrafı yoksa hiçbir şey çizilmez. kirp: "kapla" (doldurur, kırpar; varsayılan) | "sigdir".
     * Görsel ilk çizimde yüklenir, yüklenince tuval kendiliğinden yenilenir.
     */
    gorsel(kaynak: Eser | string, x: number, y: number, en: number, boy: number, secenek?: { yuvarlak?: number; kirp?: "kapla" | "sigdir" }): Kalem;
    /** Bundan sonraki çizimlerin saydamlığı (0–1). */
    saydamlik(a: number): Kalem;
    /** Dönüşümler: kaydet → tasi/dondur(radyan)/olcekle → çiz → geriYukle. */
    kaydet(): Kalem;
    geriYukle(): Kalem;
    tasi(x: number, y: number): Kalem;
    dondur(aci: number): Kalem;
    olcekle(sx: number, sy?: number): Kalem;
  }
  /** Tuvale değen bir parmak (ya da basılı fare). x, y: şimdiki konum; ilkX, ilkY: dokunuşun başladığı yer (tuval koordinatı). */
  export interface Dokunma { parmak: number; tuval: string; x: number; y: number; ilkX: number; ilkY: number; }
  /** Girdi olayı: basla (parmak değdi / fare basıldı), surukle (parmak kayıyor), birak (kalktı), tus / tus_birak (klavye). */
  export interface GirdiOlayi {
    tur: "basla" | "surukle" | "birak" | "tus" | "tus_birak" | "odak_kaybi" | "boyut";
    tuval?: string; parmak?: number; x?: number; y?: number; tip?: "touch" | "mouse" | "pen" | (string & {});
    /** "boyut": tuvalin yeni gerçek boyutu (ekran döndü, pencere büyüdü). */
    en?: number; boy?: number;
    /** Klavye: "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter", "Escape", harfler küçük ("w", "a"…) */
    tus?: string;
  }
  /** Hazır ses efektleri (WebAudio ile üretilir, dosya gerekmez). */
  export type SesEfekti = "bip" | "tik" | "vurus" | "duvar" | "puan" | "para" | "zipla" | "gol" | "kazandin" | "kaybettin" | "hata" | "patlama";
  export interface Oyun {
    /**
     * Oyun döngüsü: fn her ekran karesinde (saniyede ~60) çağrılır. dt: geçen süre (saniye, en çok 0.05), t: toplam süre.
     * Hareketi dt ile çarp (x += hiz * dt). fn içinde oyun.ciz ile çiz; await KULLANMA. Dönen işlev döngüyü durdurur.
     * Sekme gizlenince kare gelmez; modül kapanınca döngü durur. Aynı anda tek döngü vardır (yeni çağrı eskisinin yerine geçer).
     */
    dongu(fn: (dt: number, t: number) => void): () => void;
    /** Döngüyü durdurur (duraklatma, oyun sonu). */
    durdur(): void;
    readonly calisiyor: boolean;
    /** "tuval" düğümüne (id) çizer: tuval her seferinde baştan çizilir (kalem.temizle ile başla). */
    ciz(tuval: string, fn: (kalem: Kalem) => void): void;
    /** Şu an tuvale değen parmaklar (çoklu dokunma). Döngüde oku: tut-sürükle için en kolay yol. */
    dokunmalar(tuval?: string): Dokunma[];
    /**
     * Tuvalin şu anki gerçek boyutu (mantıksal birim). Tam ekran tuvalde ekranın boyutudur: telefonda ör. 390 × 760,
     * web'de ör. 1280 × 820. Sabit sayı (360, 640) YAZMA: her karede oku; konum ve büyüklükleri en/boy'a oranla kur
     * (ör. const o = Math.min(en, boy) / 400; raket genişliği 90 * o; raket y = boy - 80 * o).
     */
    boyut(tuval?: string): { en: number; boy: number };
    /** Klavye tuşu şu an basılı mı? (web'de ok tuşları: "ArrowUp"…, boşluk "Space") */
    tus(ad: string): boolean;
    /** Girdi dinleyicisi; dönen işlev dinlemeyi bırakır. Örn. oyun.dinle("basla", (o) => zipla()). */
    dinle(tur: GirdiOlayi["tur"], fn: (olay: GirdiOlayi) => void): () => void;
    /** Kısa ses efekti ya da ton: { frekans: 440, sure: 0.1, dalga?: "sine" | "square" | "triangle" | "sawtooth", ses?: 0–1, bitis?: frekans }. */
    ses(efekt: SesEfekti | (string & {}) | { frekans: number; sure?: number; dalga?: "sine" | "square" | "triangle" | "sawtooth" | (string & {}); ses?: number; bitis?: number }): void;
    /** Titreşim (Android'de dokunsal geri bildirim; yoksa sessizce geçer). Sayı verilirse milisaniye. */
    titres(tur?: "hafif" | "orta" | "guclu" | "basari" | "hata" | (string & {}) | number): void;
    /** a–b arasında rastgele ONDALIKLI sayı (b yoksa 0–a). Dizi indeksi için KULLANMA: oyun.sec / oyun.tamSayi. */
    rastgele(a: number, b?: number): number;
    /** a–b arasında (ikisi dahil) rastgele tam sayı: ızgara hücresi, zar. */
    tamSayi(a: number, b: number): number;
    /** Diziden rastgele bir öğe (dizi boşsa undefined). */
    sec<T>(dizi: T[]): T | undefined;
    sinirla(x: number, en_az: number, en_cok: number): number;
    /** İki dikdörtgen ({ x, y, en, boy }) çakışıyor mu? */
    carpisir(a: { x: number; y: number; en: number; boy: number }, b: { x: number; y: number; en: number; boy: number }): boolean;
    /** Bekler (saniye, en çok 10). setTimeout yerine. */
    bekle(saniye: number): Promise<void>;
  }
  // </genis>

  export const eserler: Eserler;
  export const ekran: Ekran;
  export const sahne: Sahne;
  export const profil: Profil;
  export const basarim: Basarim;
  export const depo: Depo;
  export const dalislar: Dalislar;
  // <genis>
  export const oyun: Oyun;
  // </genis>
}
