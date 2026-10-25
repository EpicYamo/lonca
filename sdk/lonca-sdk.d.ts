// Lonca SDK tip tanımları — modüllerin (ve yapay zekâ kalfasının) gördüğü sözleşme.
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
    harita(eserler: Eser[], secenek?: { baslik?: string; rota?: boolean }): Promise<Eser | null>;
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
    | { tip: "harita"; id: string; eserler: Eser[]; rota?: boolean; secili?: string }               // pin → { tur:"dokun", id, eser }
    | { tip: "rozet"; ad: string; aciklama?: string; kazanildi: boolean }
    | { tip: "ayrac" }
    | { tip: "bosluk" };

  /** sahne.ciz düz JS nesnelerini de kabul eder; tip adları ve alanlar yukarıdaki Dugum ile aynıdır (kalfa ayrıca denetler). */
  export type GevsekDugum = { tip: string; [alan: string]: any };

  export type Olay =
    | { tur: "dokun"; id: string; eser?: Eser }
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

  export const eserler: Eserler;
  export const ekran: Ekran;
  export const sahne: Sahne;
  export const profil: Profil;
  export const basarim: Basarim;
  export const depo: Depo;
}
